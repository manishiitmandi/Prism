"""Dedicated embedding service with provider-independent interface.

Supports:
- OpenAI (text-embedding-3-small)
- Google Gemini (gemini-embedding-001 via OpenAI-compatible endpoint)
- Mock (deterministic, unit-normalized vectors for testing & offline mode)
"""

import hashlib
import math
from abc import ABC, abstractmethod

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

DIMENSIONS = 1536


class BaseEmbeddingProvider(ABC):
    """Abstract interface for embedding generation."""

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        pass

    async def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        results = await self.embed_batch([text])
        return results[0]


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic embedding provider for testing and offline environments.
    Produces unit-normalized 1536-dimensional vectors based on token hashing.
    Text with overlapping tokens/keywords will have higher cosine similarity.
    """

    def __init__(self, dimensions: int = DIMENSIONS) -> None:
        self.dimensions = dimensions

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_single(t) for t in texts]

    def _embed_single(self, text: str) -> list[float]:
        vec = [0.0] * self.dimensions
        if not text.strip():
            vec[0] = 1.0
            return vec

        import re

        tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
        for token in tokens:
            h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
            for i in range(8):
                idx = (h >> (i * 16)) % self.dimensions
                weight = 1.0 if (h >> (i * 4)) & 1 else -1.0
                vec[idx] += weight

        # Normalize to unit length (L2 norm) so cosine similarity is well-defined
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            return [x / norm for x in vec]
        vec[0] = 1.0
        return vec


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """OpenAI embeddings client."""

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
        self.model = settings.embedding_model
        self.dimensions = settings.embedding_dimensions

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        cleaned = [t if t.strip() else " " for t in texts]
        resp = await self._client.embeddings.create(
            model=self.model,
            input=cleaned,
            dimensions=self.dimensions,
        )
        return [item.embedding for item in resp.data]


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Google Gemini embeddings client using OpenAI-compatible endpoint."""

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        api_key = settings.gemini_api_key or settings.openai_api_key
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )
        self.model = settings.gemini_embedding_model or "gemini-embedding-001"
        self.dimensions = settings.embedding_dimensions

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        cleaned = [t if t.strip() else " " for t in texts]
        resp = await self._client.embeddings.create(
            model=self.model,
            input=cleaned,
            dimensions=self.dimensions,
        )
        return [item.embedding for item in resp.data]


class EmbeddingService:
    """
    High-level embedding service orchestrating provider selection and batching.
    """

    def __init__(self, provider: BaseEmbeddingProvider | None = None) -> None:
        if provider:
            self._provider = provider
        else:
            self._provider = self._create_provider()

    def _create_provider(self) -> BaseEmbeddingProvider:
        prov_name = settings.embedding_provider.lower()

        if prov_name == "gemini" and (settings.gemini_api_key or settings.openai_api_key):
            try:
                return GeminiEmbeddingProvider()
            except Exception as e:
                logger.warning(
                    "Failed to initialize Gemini embedding provider, falling back to mock",
                    error=str(e),
                )
                return MockEmbeddingProvider()

        elif prov_name == "openai" and settings.openai_api_key:
            try:
                return OpenAIEmbeddingProvider()
            except Exception as e:
                logger.warning(
                    "Failed to initialize OpenAI embedding provider, falling back to mock",
                    error=str(e),
                )
                return MockEmbeddingProvider()

        elif prov_name == "mock":
            return MockEmbeddingProvider()

        # Fallback to available key
        if settings.gemini_api_key:
            return GeminiEmbeddingProvider()
        elif settings.openai_api_key:
            return OpenAIEmbeddingProvider()

        logger.info("No embedding API key found, using MockEmbeddingProvider")
        return MockEmbeddingProvider()

    async def embed_chunks(self, texts: list[str], batch_size: int = 25) -> list[list[float]]:
        """Embed a list of texts in batches."""
        if not texts:
            return []

        all_embeddings: list[list[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                batch_res = await self._provider.embed_batch(batch)
                all_embeddings.extend(batch_res)
            except Exception as e:
                logger.error(
                    "Embedding batch failed, falling back to mock embeddings", error=str(e)
                )
                mock = MockEmbeddingProvider()
                all_embeddings.extend(await mock.embed_batch(batch))

        return all_embeddings

    async def embed_batch(self, texts: list[str], batch_size: int = 25) -> list[list[float]]:
        """Alias for embed_chunks."""
        return await self.embed_chunks(texts, batch_size=batch_size)

    async def embed_query(self, query: str) -> list[float]:
        """Embed a search query string."""
        try:
            return await self._provider.embed_text(query)
        except Exception as e:
            logger.error("Embedding query failed, falling back to mock", error=str(e))
            mock = MockEmbeddingProvider()
            return await mock.embed_text(query)
