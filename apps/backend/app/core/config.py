"""Application configuration via environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "PRism"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: Literal["development", "production", "test"] = "development"

    # API
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] | str = ["http://localhost:3000", "http://localhost:3001"]

    # Database
    database_url: str = "postgresql+asyncpg://prism:prism@localhost:5433/prism"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # GitHub Integration
    github_token: str = ""
    github_webhook_secret: str = ""

    # Authentication & JWT
    secret_key: str = "prism-dev-secret-key-change-in-production-12345"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    frontend_url: str = "http://localhost:3000"

    # OAuth Providers
    github_client_id: str = ""
    github_client_secret: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""

    # LLM (OpenAI by default, Anthropic or Gemini optional)
    llm_provider: Literal["openai", "anthropic", "gemini"] = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str | None = None
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-haiku-20241022"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Embeddings / RAG
    embedding_provider: Literal["openai", "gemini", "mock"] = "gemini"
    embedding_model: str = "text-embedding-3-small"
    gemini_embedding_model: str = "gemini-embedding-001"
    embedding_dimensions: int = 1536
    max_retrieved_chunks: int = 10
    embedding_batch_size: int = 25

    # Analysis
    max_file_size_bytes: int = 500_000  # 500 KB per file
    max_repo_size_mb: int = 500
    analysis_timeout_seconds: int = 300
    max_context_tokens: int = 100_000

    # Paths
    repo_clone_dir: str = "/tmp/prism_repos"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
