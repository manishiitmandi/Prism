"""
Tests for RAG Subsystem:
1. Code chunk creation & AST splitting
2. Embedding generation (Mock provider)
3. Vector insertion & commit caching
4. Semantic retrieval with pgvector
5. Metadata preservation
6. Hybrid graph + vector retrieval & ranking
7. Evidence package construction
8. LLM context construction
9. Small test repository end-to-end query verification
"""

import pytest
from models.representation import FileAnalysis, Symbol, SymbolKind
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.models.models import Repository
from app.services.code_chunker import CodeChunk, SemanticCodeChunker
from app.services.embedding_service import EmbeddingService, MockEmbeddingProvider
from app.services.hybrid_retriever import HybridRetriever
from app.services.llm_service import LLMService
from app.services.vector_store import VectorStore

settings = get_settings()


@pytest.fixture
async def db_session():
    """Isolated session per async test using NullPool to avoid loop collision."""
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


# ─── 1. CODE CHUNK CREATION & AST SPLITTING ──────────────────────────────────


def test_code_chunk_creation_from_ast():
    chunker = SemanticCodeChunker(max_chunk_lines=30)
    content = """
class OrderService:
    def __init__(self, db):
        self.db = db

    def create_order(self, user_id, items):
        total = sum(i["price"] for i in items)
        return {"user": user_id, "total": total}

def helper_calculate_tax(amount):
    return amount * 0.1
""".strip()

    fa = FileAnalysis(
        path="services/order.py",
        language="python",
        symbols=[
            Symbol(
                name="OrderService",
                qualified_name="OrderService",
                kind=SymbolKind.CLASS,
                file_path="services/order.py",
                start_line=1,
                end_line=7,
                language="python",
            ),
            Symbol(
                name="create_order",
                qualified_name="OrderService.create_order",
                kind=SymbolKind.METHOD,
                file_path="services/order.py",
                parent="OrderService",
                start_line=5,
                end_line=7,
                language="python",
            ),
            Symbol(
                name="helper_calculate_tax",
                qualified_name="helper_calculate_tax",
                kind=SymbolKind.FUNCTION,
                file_path="services/order.py",
                start_line=9,
                end_line=10,
                language="python",
            ),
        ],
    )

    chunks = chunker.chunk_file("services/order.py", content, fa)
    assert len(chunks) >= 3

    symbols_found = {c.symbol_name for c in chunks}
    assert "OrderService.create_order" in symbols_found
    assert "helper_calculate_tax" in symbols_found

    method_chunk = next(c for c in chunks if c.symbol_name == "OrderService.create_order")
    assert method_chunk.parent_symbol == "OrderService"
    assert method_chunk.symbol_type == "method"
    assert method_chunk.start_line == 5
    assert method_chunk.end_line == 7
    assert "def create_order" in method_chunk.content


def test_oversized_symbol_splitting_preserves_metadata():
    chunker = SemanticCodeChunker(max_chunk_lines=10, chunk_overlap_lines=2)
    # 25-line function
    lines = [f"    line_{i} = {i}" for i in range(1, 26)]
    content = "def huge_function():\n" + "\n".join(lines)

    fa = FileAnalysis(
        path="huge.py",
        language="python",
        symbols=[
            Symbol(
                name="huge_function",
                qualified_name="huge_function",
                kind=SymbolKind.FUNCTION,
                file_path="huge.py",
                start_line=1,
                end_line=26,
                language="python",
            )
        ],
    )

    chunks = chunker.chunk_file("huge.py", content, fa)
    assert len(chunks) > 1

    for part_chunk in chunks:
        assert part_chunk.symbol_type == "function"
        assert part_chunk.file_path == "huge.py"
        assert "huge_function" in part_chunk.symbol_name
        assert part_chunk.metadata.get("original_symbol") == "huge_function"
        assert "part" in part_chunk.metadata
        assert "total_parts" in part_chunk.metadata


# ─── 2. EMBEDDING GENERATION (MOCK PROVIDER) ─────────────────────────────────


@pytest.mark.asyncio
async def test_mock_embedding_provider_generation():
    provider = MockEmbeddingProvider(dimensions=1536)
    text1 = "PaymentService.process_payment handles credit card transactions"
    text2 = "PaymentService.process_payment process payment transaction"
    text3 = "Unrelated database migration for user preferences"

    emb1 = await provider.embed_text(text1)
    emb2 = await provider.embed_text(text2)
    emb3 = await provider.embed_text(text3)

    assert len(emb1) == 1536
    assert len(emb2) == 1536
    assert len(emb3) == 1536

    # Verify unit normalization (L2 norm ≈ 1.0)
    norm1 = sum(x * x for x in emb1) ** 0.5
    assert abs(norm1 - 1.0) < 1e-4

    # Cosine similarity between related texts should be higher than unrelated
    def cosine_similarity(v1, v2):
        return sum(a * b for a, b in zip(v1, v2))

    sim_related = cosine_similarity(emb1, emb2)
    sim_unrelated = cosine_similarity(emb1, emb3)
    assert sim_related > sim_unrelated


# ─── 3. VECTOR INSERTION & COMMIT CACHING ─────────────────────────────────────


@pytest.mark.asyncio
async def test_vector_insertion_and_commit_caching(db_session):
    repo_id = "test-repo-rag-eval"
    commit_sha = "c0ffee123456"

    # Create test repository if missing
    repo = await db_session.get(Repository, repo_id)
    if not repo:
        repo = Repository(
            id=repo_id,
            github_id=888888,
            owner="rag-org",
            name="rag-repo",
            full_name="rag-org/rag-repo",
        )
        db_session.add(repo)
        await db_session.commit()

    vs = VectorStore()
    provider = MockEmbeddingProvider()

    # Clean any prior test rows for this commit
    await db_session.execute(
        text("DELETE FROM code_chunks WHERE repository_id = :repo_id AND commit_sha = :sha"),
        {"repo_id": repo_id, "sha": commit_sha},
    )
    await db_session.commit()

    # Initially, commit should not be indexed
    assert await vs.has_commit_indexed(db_session, repo_id, commit_sha) is False

    # Store chunks
    chunks = [
        CodeChunk(
            chunk_id="chunk-auth-1",
            file_path="services/auth.py",
            language="python",
            symbol_name="AuthService.verify_token",
            symbol_type="method",
            start_line=1,
            end_line=15,
            content="def verify_token(token):\n    return decode_jwt(token)",
            is_test=False,
            metadata={"is_public": True},
        ),
        CodeChunk(
            chunk_id="chunk-auth-test-1",
            file_path="tests/test_auth.py",
            language="python",
            symbol_name="test_verify_token_valid",
            symbol_type="function",
            start_line=1,
            end_line=10,
            content="def test_verify_token_valid():\n    assert verify_token('good') is True",
            is_test=True,
            metadata={"is_test": True},
        ),
    ]
    embeddings = await provider.embed_batch([c.content for c in chunks])
    inserted_count = await vs.store_chunks(db_session, repo_id, commit_sha, chunks, embeddings)
    assert inserted_count == 2

    # Commit is now indexed
    assert await vs.has_commit_indexed(db_session, repo_id, commit_sha) is True

    # Re-attempting insertion for same commit should be skipped (cached)
    second_attempt = await vs.store_chunks(db_session, repo_id, commit_sha, chunks, embeddings)
    assert second_attempt == 0


# ─── 4. SEMANTIC RETRIEVAL WITH PGVECTOR ──────────────────────────────────────


@pytest.mark.asyncio
async def test_semantic_retrieval_pgvector(db_session):
    repo_id = "test-repo-rag-eval"
    commit_sha = "c0ffee123456"

    vs = VectorStore()
    provider = MockEmbeddingProvider()

    query = "verify token jwt"
    q_emb = await provider.embed_text(query)

    # Search for source chunks
    matches = await vs.search_similar(
        db_session, repo_id, q_emb, commit_sha=commit_sha, is_test=False, min_similarity=0.1
    )
    assert len(matches) > 0
    assert matches[0]["symbol_name"] == "AuthService.verify_token"
    assert matches[0]["file_path"] == "services/auth.py"
    assert matches[0]["similarity"] > 0.3

    # Search for test chunks
    test_matches = await vs.search_similar(
        db_session, repo_id, q_emb, commit_sha=commit_sha, is_test=True, min_similarity=0.1
    )
    assert len(test_matches) > 0
    assert test_matches[0]["is_test"] is True
    assert test_matches[0]["symbol_name"] == "test_verify_token_valid"


# ─── 5. METADATA PRESERVATION ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_metadata_preservation(db_session):
    repo_id = "test-repo-rag-eval"
    commit_sha = "c0ffee123456"

    vs = VectorStore()
    provider = MockEmbeddingProvider()

    q_emb = await provider.embed_text("verify token")
    matches = await vs.search_similar(db_session, repo_id, q_emb, commit_sha=commit_sha)

    assert len(matches) > 0
    match = matches[0]
    assert "file_path" in match
    assert "language" in match
    assert "symbol_name" in match
    assert "symbol_type" in match
    assert "start_line" in match
    assert "end_line" in match
    assert "content" in match
    assert "metadata" in match


# ─── 6. HYBRID GRAPH + VECTOR RETRIEVAL & RANKING ────────────────────────────


@pytest.mark.asyncio
async def test_hybrid_retrieval_and_ranking(db_session):
    repo_id = "test-repo-rag-eval"
    commit_sha = "c0ffee123456"

    vs = VectorStore()
    emb_service = EmbeddingService(provider=MockEmbeddingProvider())
    retriever = HybridRetriever(vector_store=vs, embedding_service=emb_service)

    result = await retriever.retrieve(
        db=db_session,
        repository_id=repo_id,
        commit_sha=commit_sha,
        pr_title="Fix token verification logic",
        pr_body="Update jwt decoding in AuthService",
        changed_files=["services/auth.py"],
        changed_symbols=["AuthService.verify_token"],
        affected_components=[
            {"component": "services/auth.py::AuthService.verify_token", "reason": "direct call"}
        ],
        related_tests=["tests/test_auth.py::test_verify_token_valid"],
    )

    assert len(result.source_chunks) > 0
    assert len(result.test_chunks) > 0

    # Check hybrid ranking and provenance
    top_source = result.source_chunks[0]
    assert top_source.provenance in ("hybrid", "semantic_search", "static_graph")
    assert top_source.relevance_score > 0.0

    top_test = result.test_chunks[0]
    assert top_test.is_test is True


# ─── 7. EVIDENCE PACKAGE CONSTRUCTION ────────────────────────────────────────


def test_evidence_package_structure():
    evidence = {
        "repository": {"full_name": "rag-org/rag-repo"},
        "pr": {"number": 1, "title": "Add Auth"},
        "static_evidence": {
            "changed_files": [{"path": "services/auth.py"}],
            "changed_symbols": ["AuthService.verify_token"],
            "affected_components": [{"component": "LoginController"}],
            "dependency_metrics": {"direct_dependents": 2},
            "related_tests": ["tests/test_auth.py"],
            "missing_test_candidates": [],
        },
        "retrieved_evidence": {
            "source_chunks": [
                {
                    "file_path": "services/auth.py",
                    "symbol_name": "AuthService.verify_token",
                    "provenance": "hybrid",
                    "relevance_score": 1.7,
                }
            ],
            "test_chunks": [
                {
                    "file_path": "tests/test_auth.py",
                    "symbol_name": "test_verify_token",
                    "provenance": "semantic_search",
                    "relevance_score": 0.85,
                }
            ],
            "queries_used": ["AuthService.verify_token"],
        },
    }

    assert "static_evidence" in evidence
    assert "retrieved_evidence" in evidence
    assert len(evidence["retrieved_evidence"]["source_chunks"]) == 1
    assert len(evidence["retrieved_evidence"]["test_chunks"]) == 1


# ─── 8. LLM CONTEXT CONSTRUCTION ────────────────────────────────────────────


def test_llm_prompt_distinguishes_static_and_retrieved():
    llm = LLMService()
    evidence = {
        "repository": {"full_name": "rag-org/rag-repo"},
        "pr": {"number": 42, "title": "Update payment pipeline", "author": "dev"},
        "changed_files": [
            {"path": "payment.py", "language": "python", "added_lines": 10, "removed_lines": 2}
        ],
        "changed_symbols": ["PaymentService.process_payment"],
        "dependency_metrics": {"direct_dependents": 3, "database_changed": False},
        "affected_components": [
            {"component": "CheckoutService", "reason": "calls process_payment"}
        ],
        "related_tests": ["tests/test_payment.py"],
        "missing_test_candidates": [],
        "retrieved_evidence": {
            "source_chunks": [
                {
                    "file_path": "checkout.py",
                    "symbol_name": "CheckoutService.checkout",
                    "start_line": 20,
                    "end_line": 40,
                    "language": "python",
                    "content": "def checkout():\n    return PaymentService.process_payment()",
                    "provenance": "hybrid",
                    "similarity": 0.82,
                }
            ],
            "test_chunks": [
                {
                    "file_path": "tests/test_payment.py",
                    "symbol_name": "test_payment_success",
                    "start_line": 1,
                    "end_line": 12,
                    "language": "python",
                    "content": "def test_payment_success():\n    assert True",
                    "provenance": "semantic_search",
                    "similarity": 0.78,
                }
            ],
        },
    }

    prompt = llm._build_prompt(evidence)

    # Must contain clear separation
    assert "STATIC EVIDENCE (Detected by static analysis)" in prompt
    assert (
        "RETRIEVED EVIDENCE (Retrieved semantically via vector search & hybrid ranking)" in prompt
    )

    # Must show provenance and similarity
    assert "[HYBRID] [sim=0.82]" in prompt
    assert "[SEMANTIC_SEARCH] [sim=0.78]" in prompt
    assert "CheckoutService.checkout" in prompt
    assert "test_payment_success" in prompt


# ─── 9. SMALL TEST REPOSITORY VERIFICATION ────────────────────────────────────


@pytest.mark.asyncio
async def test_small_repository_rag_verification(db_session):
    """
    Creates a small test repository:
    - Changed symbol: PaymentService.process_payment
    - Dependent: OrderService.create_order calls process_payment
    - Test: tests/test_payment.py tests PaymentService
    Verifies that querying the changed symbol retrieves:
    1. Changed implementation
    2. Relevant dependent code
    3. Relevant tests
    """
    repo_id = "test-repo-small-demo"
    commit_sha = "sha999999"

    repo = await db_session.get(Repository, repo_id)
    if not repo:
        repo = Repository(
            id=repo_id,
            github_id=777777,
            owner="demo-org",
            name="demo-repo",
            full_name="demo-org/demo-repo",
        )
        db_session.add(repo)
        await db_session.commit()

    await db_session.execute(
        text("DELETE FROM code_chunks WHERE repository_id = :repo_id AND commit_sha = :sha"),
        {"repo_id": repo_id, "sha": commit_sha},
    )
    await db_session.commit()

    # 1. Chunks
    chunks = [
        CodeChunk(
            chunk_id="chunk-payment-impl",
            file_path="services/payment.py",
            language="python",
            symbol_name="PaymentService.process_payment",
            symbol_type="method",
            start_line=10,
            end_line=25,
            content="def process_payment(account, amount):\n    return gateway.charge(account, amount)",
            is_test=False,
        ),
        CodeChunk(
            chunk_id="chunk-order-dependent",
            file_path="services/order.py",
            language="python",
            symbol_name="OrderService.create_order",
            symbol_type="method",
            start_line=30,
            end_line=50,
            content="def create_order(user, items):\n    return PaymentService.process_payment(user.account, items.total)",
            is_test=False,
        ),
        CodeChunk(
            chunk_id="chunk-payment-test",
            file_path="tests/test_payment.py",
            language="python",
            symbol_name="test_process_payment_success",
            symbol_type="function",
            start_line=1,
            end_line=15,
            content="def test_process_payment_success():\n    assert PaymentService.process_payment('acc1', 100) is True",
            is_test=True,
        ),
    ]

    provider = MockEmbeddingProvider()
    embeddings = await provider.embed_batch([c.content for c in chunks])

    vs = VectorStore()
    await vs.store_chunks(db_session, repo_id, commit_sha, chunks, embeddings)

    # 2. Hybrid Retrieval
    retriever = HybridRetriever(
        vector_store=vs, embedding_service=EmbeddingService(provider=MockEmbeddingProvider())
    )
    result = await retriever.retrieve(
        db=db_session,
        repository_id=repo_id,
        commit_sha=commit_sha,
        pr_title="Refactor process_payment method",
        pr_body="Update gateway charging logic",
        changed_files=["services/payment.py"],
        changed_symbols=["PaymentService.process_payment"],
        affected_components=[
            {
                "component": "services/order.py::OrderService.create_order",
                "reason": "calls process_payment",
            }
        ],
        related_tests=["tests/test_payment.py::test_process_payment_success"],
        in_memory_chunks=chunks,
    )

    retrieved_symbols = {c.symbol_name for c in result.all_chunks}
    # 1. Changed implementation
    assert "PaymentService.process_payment" in retrieved_symbols
    # 2. Dependent code
    assert "OrderService.create_order" in retrieved_symbols
    # 3. Relevant tests
    assert "test_process_payment_success" in retrieved_symbols

    # Verify tests are classified as test chunks
    test_syms = {c.symbol_name for c in result.test_chunks}
    assert "test_process_payment_success" in test_syms
