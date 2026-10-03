"""SQLAlchemy ORM models for PRism."""

import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class AnalysisStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    CLONING = "CLONING"
    PARSING = "PARSING"
    ANALYZING = "ANALYZING"
    RETRIEVING = "RETRIEVING"
    AI_ANALYSIS = "AI_ANALYSIS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    github_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    default_branch: Mapped[str] = mapped_column(String(255), default="main")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(100), nullable=True)
    private: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    pull_requests: Mapped[list["PullRequest"]] = relationship(
        "PullRequest", back_populates="repository"
    )
    code_chunks: Mapped[list["CodeChunkModel"]] = relationship(
        "CodeChunkModel", back_populates="repository", cascade="all, delete-orphan"
    )
    tracked_by_users: Mapped[list["UserRepository"]] = relationship(
        "UserRepository", back_populates="repository", cascade="all, delete-orphan"
    )


class PullRequest(Base):
    __tablename__ = "pull_requests"
    __table_args__ = (UniqueConstraint("repository_id", "number", name="uq_pr_repo_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    repository_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repositories.id"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(1024), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    base_branch: Mapped[str] = mapped_column(String(255), nullable=False)
    head_branch: Mapped[str] = mapped_column(String(255), nullable=False)
    base_sha: Mapped[str] = mapped_column(String(40), nullable=False)
    head_sha: Mapped[str] = mapped_column(String(40), nullable=False)
    state: Mapped[str] = mapped_column(String(50), default="open")
    additions: Mapped[int] = mapped_column(Integer, default=0)
    deletions: Mapped[int] = mapped_column(Integer, default=0)
    changed_files: Mapped[int] = mapped_column(Integer, default=0)
    github_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    repository: Mapped["Repository"] = relationship("Repository", back_populates="pull_requests")
    analyses: Mapped[list["Analysis"]] = relationship("Analysis", back_populates="pull_request")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    pull_request_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("pull_requests.id"), nullable=False
    )
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus), default=AnalysisStatus.QUEUED
    )
    risk_level: Mapped[RiskLevel | None] = mapped_column(Enum(RiskLevel), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON fields for complex data
    changed_files_data: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    changed_symbols: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    affected_components: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    risk_factors: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    recommended_tests: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    edge_cases: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    dependency_metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    related_tests: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    evidence: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    graph_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    pull_request: Mapped["PullRequest"] = relationship("PullRequest", back_populates="analyses")


class CodeChunkModel(Base):
    __tablename__ = "code_chunks"
    __table_args__ = (Index("ix_code_chunks_repo_commit", "repository_id", "commit_sha"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    repository_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repositories.id"), nullable=False, index=True
    )
    commit_sha: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(64), nullable=False)
    symbol_name: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    symbol_type: Mapped[str] = mapped_column(String(64), nullable=False)
    parent_symbol: Mapped[str | None] = mapped_column(String(512), nullable=True)
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_test: Mapped[bool] = mapped_column(Boolean, default=False)
    chunk_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    repository: Mapped["Repository"] = relationship("Repository", back_populates="code_chunks")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    auth_provider: Mapped[str] = mapped_column(String(50), default="github")  # github, google, demo
    github_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    github_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    monitored_repositories: Mapped[list["UserRepository"]] = relationship(
        "UserRepository", back_populates="user", cascade="all, delete-orphan"
    )


class UserRepository(Base):
    """User's tracked/pinned repositories on their dashboard."""
    __tablename__ = "user_repositories"
    __table_args__ = (UniqueConstraint("user_id", "repository_id", name="uq_user_repository"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    repository_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), default="tracked_oss")  # owner, collaborator, tracked_oss
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="monitored_repositories")
    repository: Mapped["Repository"] = relationship("Repository", back_populates="tracked_by_users")

