"""Hybrid retrieval engine combining static graph analysis with pgvector semantic search."""

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.services.embedding_service import EmbeddingService
from app.services.vector_store import VectorStore

logger = get_logger(__name__)


@dataclass
class RetrievedChunk:
    """A retrieved code chunk with provenance and relevance ranking."""

    file_path: str
    symbol_name: str
    symbol_type: str
    start_line: int
    end_line: int
    content: str
    is_test: bool
    provenance: str  # "static_graph", "semantic_search", or "hybrid"
    relevance_score: float
    parent_symbol: str | None = None
    similarity: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_path": self.file_path,
            "symbol_name": self.symbol_name,
            "symbol_type": self.symbol_type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "content": self.content,
            "is_test": self.is_test,
            "provenance": self.provenance,
            "relevance_score": round(self.relevance_score, 4),
            "similarity": self.similarity,
            "parent_symbol": self.parent_symbol,
            "metadata": self.metadata,
        }


@dataclass
class HybridRetrievalResult:
    """Consolidated retrieval result separating source and test evidence."""

    source_chunks: list[RetrievedChunk] = field(default_factory=list)
    test_chunks: list[RetrievedChunk] = field(default_factory=list)
    queries_used: list[str] = field(default_factory=list)

    @property
    def all_chunks(self) -> list[RetrievedChunk]:
        return self.source_chunks + self.test_chunks

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_chunks": [c.to_dict() for c in self.source_chunks],
            "test_chunks": [c.to_dict() for c in self.test_chunks],
            "queries_used": self.queries_used,
        }


class HybridRetriever:
    """
    Orchestrates static call-graph retrieval and vector semantic retrieval.
    Deduplicates results, identifies provenance, and ranks the final evidence.
    """

    def __init__(
        self,
        vector_store: VectorStore,
        embedding_service: EmbeddingService,
    ) -> None:
        self._vector_store = vector_store
        self._embeddings = embedding_service

    async def retrieve(
        self,
        db: AsyncSession,
        repository_id: str,
        commit_sha: str,
        pr_title: str,
        pr_body: str | None,
        changed_files: list[str],
        changed_symbols: list[str],
        affected_components: list[dict[str, Any]],
        related_tests: list[str],
        in_memory_chunks: list[Any] | None = None,
        max_source_chunks: int = 8,
        max_test_chunks: int = 5,
    ) -> HybridRetrievalResult:
        """
        Execute contextual hybrid retrieval.
        """
        result = HybridRetrievalResult()

        # 1. Build contextual search queries based on actual PR details
        queries: list[str] = []
        if changed_symbols:
            queries.append(" ".join(changed_symbols[:5]))
        if pr_title:
            title_clean = pr_title.replace("🐛", "").replace("✨", "").replace("Fix", "").strip()
            queries.append(f"{title_clean} {pr_body[:100] if pr_body else ''}".strip())
        if affected_components:
            comp_names = [
                c.get("component", "") for c in affected_components[:4] if c.get("component")
            ]
            if comp_names:
                queries.append(" ".join(comp_names))

        result.queries_used = queries

        # 2. Semantic Search via Vector Store
        vector_source_matches: dict[str, dict[str, Any]] = {}
        vector_test_matches: dict[str, dict[str, Any]] = {}

        for q in queries:
            try:
                q_emb = await self._embeddings.embed_query(q)
                # Search source code chunks
                sources = await self._vector_store.search_similar(
                    db=db,
                    repository_id=repository_id,
                    commit_sha=commit_sha,
                    query_embedding=q_emb,
                    limit=max_source_chunks,
                    is_test=False,
                    min_similarity=0.2,
                )
                for s in sources:
                    key = f"{s['file_path']}::{s['symbol_name']}"
                    if (
                        key not in vector_source_matches
                        or s["similarity"] > vector_source_matches[key]["similarity"]
                    ):
                        vector_source_matches[key] = s

                # Search test chunks
                tests = await self._vector_store.search_similar(
                    db=db,
                    repository_id=repository_id,
                    commit_sha=commit_sha,
                    query_embedding=q_emb,
                    limit=max_test_chunks,
                    is_test=True,
                    min_similarity=0.2,
                )
                for t in tests:
                    key = f"{t['file_path']}::{t['symbol_name']}"
                    if (
                        key not in vector_test_matches
                        or t["similarity"] > vector_test_matches[key]["similarity"]
                    ):
                        vector_test_matches[key] = t
            except Exception as e:
                logger.error("Semantic vector search failed for query", query=q, error=str(e))

        # 3. Static Graph & Changed Code Retrieval index
        changed_keys: set[str] = set(changed_symbols)
        graph_source_keys: set[str] = {
            c.get("component", "") for c in affected_components if c.get("component")
        }
        graph_test_keys: set[str] = set(related_tests)

        # Build in-memory lookup if available
        chunk_by_key: dict[str, Any] = {}
        if in_memory_chunks:
            for ch in in_memory_chunks:
                chunk_by_key[f"{ch.file_path}::{ch.symbol_name}"] = ch
                chunk_by_key[ch.symbol_name] = ch

        # 4. Consolidate and Rank Source Chunks
        all_source_keys = set(vector_source_matches.keys())
        for comp in graph_source_keys:
            all_source_keys.add(comp)
        for sym in changed_keys:
            all_source_keys.add(sym)

        merged_source_chunks: list[RetrievedChunk] = []
        seen_source_chunks: set[str] = set()

        for key in all_source_keys:
            v_match = vector_source_matches.get(key)
            in_mem = chunk_by_key.get(key)
            if not in_mem and in_memory_chunks:
                in_mem = next(
                    (
                        c
                        for c in in_memory_chunks
                        if not c.is_test
                        and (key in c.symbol_name or c.symbol_name in key or key in c.file_path)
                    ),
                    None,
                )

            # Determine match provenance and relevance score
            is_changed = (
                any(sym in key or key in sym for sym in changed_keys) if changed_keys else False
            )
            in_graph = (
                any(g_key in key or key in g_key for g_key in graph_source_keys)
                if graph_source_keys
                else False
            )
            in_vector = v_match is not None

            sim = v_match["similarity"] if v_match else None

            if is_changed:
                provenance = "hybrid" if (in_graph or in_vector) else "static_graph"
                score = 2.0 + (sim if sim is not None else 0.5)
            elif in_graph and in_vector:
                provenance = "hybrid"
                score = 1.0 + (sim if sim is not None else 0.5)
            elif in_graph:
                provenance = "static_graph"
                score = 0.85
            else:
                provenance = "semantic_search"
                score = sim if sim is not None else 0.5

            if v_match:
                chunk_id = f"{v_match['file_path']}::{v_match['symbol_name']}"
                if chunk_id not in seen_source_chunks:
                    seen_source_chunks.add(chunk_id)
                    chunk = RetrievedChunk(
                        file_path=v_match["file_path"],
                        symbol_name=v_match["symbol_name"],
                        symbol_type=v_match["symbol_type"],
                        start_line=v_match["start_line"],
                        end_line=v_match["end_line"],
                        content=v_match["content"],
                        is_test=False,
                        provenance=provenance,
                        relevance_score=score,
                        similarity=sim,
                        parent_symbol=v_match.get("parent_symbol"),
                        metadata=v_match.get("metadata", {}),
                    )
                    merged_source_chunks.append(chunk)
            elif in_mem:
                chunk_id = f"{in_mem.file_path}::{in_mem.symbol_name}"
                if chunk_id not in seen_source_chunks:
                    seen_source_chunks.add(chunk_id)
                    chunk = RetrievedChunk(
                        file_path=in_mem.file_path,
                        symbol_name=in_mem.symbol_name,
                        symbol_type=in_mem.symbol_type,
                        start_line=in_mem.start_line,
                        end_line=in_mem.end_line,
                        content=in_mem.content,
                        is_test=False,
                        provenance=provenance,
                        relevance_score=score,
                        similarity=sim,
                        parent_symbol=in_mem.parent_symbol,
                        metadata=in_mem.metadata,
                    )
                    merged_source_chunks.append(chunk)

        # Sort source chunks by score descending and limit
        merged_source_chunks.sort(key=lambda c: c.relevance_score, reverse=True)
        result.source_chunks = merged_source_chunks[:max_source_chunks]

        # 5. Consolidate and Rank Test Chunks
        all_test_keys = set(vector_test_matches.keys())
        for test in graph_test_keys:
            all_test_keys.add(test)

        merged_test_chunks: list[RetrievedChunk] = []
        seen_test_chunks: set[str] = set()

        for key in all_test_keys:
            v_match = vector_test_matches.get(key)
            in_mem = chunk_by_key.get(key)
            if not in_mem and in_memory_chunks:
                in_mem = next(
                    (
                        c
                        for c in in_memory_chunks
                        if c.is_test
                        and (key in c.symbol_name or c.symbol_name in key or key in c.file_path)
                    ),
                    None,
                )

            in_graph = (
                any(g_key in key or key in g_key for g_key in graph_test_keys)
                if graph_test_keys
                else False
            )
            in_vector = v_match is not None
            sim = v_match["similarity"] if v_match else None

            if in_graph and in_vector:
                provenance = "hybrid"
                score = 1.0 + (sim if sim is not None else 0.5)
            elif in_graph:
                provenance = "static_graph"
                score = 0.85
            else:
                provenance = "semantic_search"
                score = sim if sim is not None else 0.5

            if v_match:
                chunk_id = f"{v_match['file_path']}::{v_match['symbol_name']}"
                if chunk_id not in seen_test_chunks:
                    seen_test_chunks.add(chunk_id)
                    chunk = RetrievedChunk(
                        file_path=v_match["file_path"],
                        symbol_name=v_match["symbol_name"],
                        symbol_type=v_match["symbol_type"],
                        start_line=v_match["start_line"],
                        end_line=v_match["end_line"],
                        content=v_match["content"],
                        is_test=True,
                        provenance=provenance,
                        relevance_score=score,
                        similarity=sim,
                        parent_symbol=v_match.get("parent_symbol"),
                        metadata=v_match.get("metadata", {}),
                    )
                    merged_test_chunks.append(chunk)
            elif in_mem:
                chunk_id = f"{in_mem.file_path}::{in_mem.symbol_name}"
                if chunk_id not in seen_test_chunks:
                    seen_test_chunks.add(chunk_id)
                    chunk = RetrievedChunk(
                        file_path=in_mem.file_path,
                        symbol_name=in_mem.symbol_name,
                        symbol_type=in_mem.symbol_type,
                        start_line=in_mem.start_line,
                        end_line=in_mem.end_line,
                        content=in_mem.content,
                        is_test=True,
                        provenance=provenance,
                        relevance_score=score,
                        similarity=sim,
                        parent_symbol=in_mem.parent_symbol,
                        metadata=in_mem.metadata,
                    )
                    merged_test_chunks.append(chunk)

        merged_test_chunks.sort(key=lambda c: c.relevance_score, reverse=True)
        result.test_chunks = merged_test_chunks[:max_test_chunks]

        logger.info(
            "Hybrid retrieval complete",
            sources=len(result.source_chunks),
            tests=len(result.test_chunks),
            queries=len(queries),
        )
        return result
