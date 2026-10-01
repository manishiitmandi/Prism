"""SQLAlchemy ORM models for PRism."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
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
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    pull_requests: Mapped[list["PullRequest"]] = relationship("PullRequest", back_populates="repository")


class PullRequest(Base):
    __tablename__ = "pull_requests"
    __table_args__ = (UniqueConstraint("repository_id", "number", name="uq_pr_repo_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    repository_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id"), nullable=False)
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
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    repository: Mapped["Repository"] = relationship("Repository", back_populates="pull_requests")
    analyses: Mapped[list["Analysis"]] = relationship("Analysis", back_populates="pull_request")


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    pull_request_id: Mapped[str] = mapped_column(String(36), ForeignKey("pull_requests.id"), nullable=False)
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
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    pull_request: Mapped["PullRequest"] = relationship("PullRequest", back_populates="analyses")
