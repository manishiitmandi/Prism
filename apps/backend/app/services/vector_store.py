"""Vector storage and semantic retrieval using PostgreSQL + pgvector."""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.models import CodeChunkModel
from app.services.code_chunker import CodeChunk

logger = get_logger(__name__)


class VectorStore:
    """
    Manages storage and semantic search of code chunks in pgvector.
    Indexes repositories by (repository_id, commit_sha).
    """

    async def has_commit_indexed(
        self,
        db: AsyncSession,
        repository_id: str,
        commit_sha: str,
    ) -> bool:
        """
        Check if the repository commit has already been indexed.
        Reuses existing embeddings if present.
        """
        stmt = select(func.count(CodeChunkModel.id)).where(
            CodeChunkModel.repository_id == repository_id,
            CodeChunkModel.commit_sha == commit_sha,
        )
        result = await db.execute(stmt)
        count = result.scalar_one_or_none() or 0
        return count > 0

    async def store_chunks(
        self,
        db: AsyncSession,
        repository_id: str,
        commit_sha: str,
        chunks: list[CodeChunk],
        embeddings: list[list[float]],
    ) -> int:
        """
        Persist code chunks and their embeddings into pgvector.
        """
        if not chunks or not embeddings or len(chunks) != len(embeddings):
            return 0

        # Avoid duplicate chunk insertion if already indexed
        if await self.has_commit_indexed(db, repository_id, commit_sha):
            logger.info(
                "Commit already indexed, skipping chunk storage",
                repo=repository_id,
                commit=commit_sha,
            )
            return 0

        records: list[CodeChunkModel] = []
        for chunk, emb in zip(chunks, embeddings, strict=False):
            rec = CodeChunkModel(
                id=chunk.chunk_id,
                repository_id=repository_id,
                commit_sha=commit_sha,
                file_path=chunk.file_path,
                language=chunk.language,
                symbol_name=chunk.symbol_name,
                symbol_type=chunk.symbol_type,
                parent_symbol=chunk.parent_symbol,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                content=chunk.content,
                is_test=chunk.is_test,
                chunk_metadata=chunk.metadata,
                embedding=emb,
            )
            records.append(rec)

        # Batch insert to avoid overloading database
        batch_size = 100
        for i in range(0, len(records), batch_size):
            db.add_all(records[i : i + batch_size])
            await db.flush()

        await db.commit()
        logger.info(
            "Stored code chunks in pgvector",
            count=len(records),
            repo=repository_id,
            commit=commit_sha,
        )
        return len(records)

    async def search_similar(
        self,
        db: AsyncSession,
        repository_id: str,
        query_embedding: list[float],
        commit_sha: str | None = None,
        limit: int = 10,
        is_test: bool | None = None,
        min_similarity: float = 0.2,
    ) -> list[dict[str, Any]]:
        """
        Perform vector cosine distance similarity search in PostgreSQL + pgvector.
        Returns top matching chunks with similarity score in [0, 1].
        """
        # In pgvector, cosine distance <=> ranges from 0 (identical) to 2 (opposite)
        # Cosine similarity = 1 - cosine_distance
        distance_expr = CodeChunkModel.embedding.cosine_distance(query_embedding)
        similarity_expr = (1.0 - distance_expr).label("similarity")

        stmt = select(
            CodeChunkModel,
            similarity_expr,
        ).where(CodeChunkModel.repository_id == repository_id)

        if commit_sha:
            stmt = stmt.where(CodeChunkModel.commit_sha == commit_sha)

        if is_test is not None:
            stmt = stmt.where(CodeChunkModel.is_test == is_test)

        # Order by closest distance (highest similarity)
        stmt = stmt.order_by(distance_expr.asc()).limit(limit)

        result = await db.execute(stmt)
        rows = result.all()

        matches: list[dict[str, Any]] = []
        for model_chunk, similarity in rows:
            sim_val = float(similarity) if similarity is not None else 0.0
            if sim_val >= min_similarity:
                matches.append(
                    {
                        "chunk_id": model_chunk.id,
                        "file_path": model_chunk.file_path,
                        "language": model_chunk.language,
                        "symbol_name": model_chunk.symbol_name,
                        "symbol_type": model_chunk.symbol_type,
                        "parent_symbol": model_chunk.parent_symbol,
                        "start_line": model_chunk.start_line,
                        "end_line": model_chunk.end_line,
                        "content": model_chunk.content,
                        "is_test": model_chunk.is_test,
                        "similarity": round(sim_val, 4),
                        "metadata": model_chunk.chunk_metadata or {},
                    }
                )

        return matches
