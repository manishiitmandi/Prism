"""Application configuration via environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Database
    database_url: str = "postgresql+asyncpg://prism:prism@localhost:5432/prism"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # GitHub
    github_token: str = ""
    github_webhook_secret: str = ""

    # LLM (OpenAI by default, Anthropic optional)
    llm_provider: Literal["openai", "anthropic"] = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-haiku-20241022"

    # Embeddings
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

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
