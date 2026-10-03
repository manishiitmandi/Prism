"""Pydantic schemas for API request/response validation."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# ─── Repository Schemas ───────────────────────────────────────────────────────


class RepositoryCreate(BaseModel):
    owner: str = Field(..., description="GitHub repository owner/org")
    name: str = Field(..., description="GitHub repository name")


class RepositoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    github_id: int
    owner: str
    name: str
    full_name: str
    default_branch: str
    description: str | None
    language: str | None
    private: bool
    created_at: datetime
    updated_at: datetime


# ─── Pull Request Schemas ─────────────────────────────────────────────────────


class PullRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    repository_id: str
    number: int
    title: str
    description: str | None
    author: str
    base_branch: str
    head_branch: str
    base_sha: str
    head_sha: str
    state: str
    additions: int
    deletions: int
    changed_files: int
    github_url: str
    created_at: datetime


# ─── Analysis Schemas ─────────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    """Request to trigger PR analysis."""

    pass  # PR info comes from path params


class RiskFactor(BaseModel):
    title: str
    description: str
    evidence: list[str] = []


class AffectedComponent(BaseModel):
    component: str
    reason: str
    evidence: list[str] = []


class RecommendedTest(BaseModel):
    test_name: str
    reason: str
    priority: str = Field(..., pattern="^(HIGH|MEDIUM|LOW)$")


class ChangedFileInfo(BaseModel):
    path: str
    language: str | None
    added_lines: int
    removed_lines: int
    changed_symbols: list[str] = []


class DependencyMetrics(BaseModel):
    direct_dependents: int = 0
    transitive_dependents: int = 0
    affected_modules: int = 0
    affected_tests: int = 0
    public_api_changed: bool = False
    database_changed: bool = False
    config_changed: bool = False
    auth_changed: bool = False
    tests_present: bool = False


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pull_request_id: str
    status: str
    risk_level: str | None
    summary: str | None
    error_message: str | None
    changed_files_data: list[dict] | None
    changed_symbols: list[str] | None
    affected_components: list[dict] | None
    risk_factors: list[dict] | None
    recommended_tests: list[dict] | None
    edge_cases: list[str] | None
    dependency_metrics: dict | None
    related_tests: list[str] | None
    evidence: dict | None
    graph_data: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: float | None
    created_at: datetime
    updated_at: datetime


class AnalysisStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    risk_level: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


# ─── Webhook Schemas ──────────────────────────────────────────────────────────


class WebhookResponse(BaseModel):
    message: str
    analysis_id: str | None = None


# ─── Health ───────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    environment: str


# ─── LLM Structured Output ───────────────────────────────────────────────────


class LLMRiskAnalysis(BaseModel):
    """Structured output from the LLM risk analysis."""

    summary: str
    risk_level: str = Field(..., pattern="^(LOW|MEDIUM|HIGH)$")
    risk_factors: list[RiskFactor] = []
    affected_components: list[AffectedComponent] = []
    recommended_tests: list[RecommendedTest] = []
    edge_cases: list[str] = []


# ─── Auth & User Schemas ──────────────────────────────────────────────────────


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    auth_provider: str
    username: str
    name: str | None = None
    email: str | None = None
    avatar_url: str | None = None
    created_at: datetime


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class EmailLoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=4, description="User password")


class EmailRegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="User password")
    name: str | None = Field(None, description="User full display name")


class TrackRepoRequest(BaseModel):
    owner: str = Field(..., description="Repository owner or organization")
    name: str = Field(..., description="Repository name")
    role: str = Field("tracked_oss", description="Role: 'owner', 'collaborator', or 'tracked_oss'")


class UserMonitoredRepoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    repository: RepositoryResponse
    role: str
    is_pinned: bool
    created_at: datetime

