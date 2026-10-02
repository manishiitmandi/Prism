"""GitHub webhook endpoint."""

import json

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.models import Repository
from app.schemas.schemas import WebhookResponse
from app.services.github_service import GitHubService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = get_logger(__name__)


@router.post("/github", response_model=WebhookResponse, status_code=status.HTTP_202_ACCEPTED)
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_github_event: str = Header(default=""),
    x_hub_signature_256: str = Header(default=""),
) -> WebhookResponse:
    """
    Receive GitHub webhook events.

    Handles: pull_request opened/synchronize/reopened
    Returns 202 immediately; analysis runs in background.
    """
    body = await request.body()

    # Validate webhook signature
    github = GitHubService()
    if x_hub_signature_256:
        if not github.verify_webhook_signature(body, x_hub_signature_256):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    if x_github_event != "pull_request":
        return WebhookResponse(message=f"Event '{x_github_event}' ignored")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    action = payload.get("action")
    if action not in ("opened", "synchronize", "reopened"):
        return WebhookResponse(message=f"Action '{action}' ignored")

    pr_data = payload.get("pull_request", {})
    repo_data = payload.get("repository", {})

    owner = repo_data.get("owner", {}).get("login")
    name = repo_data.get("name")
    github_id = repo_data.get("id")
    pr_number = pr_data.get("number")

    if not all([owner, name, github_id, pr_number]):
        raise HTTPException(status_code=400, detail="Missing required payload fields")

    # Find or create repository record
    stmt = select(Repository).where(Repository.github_id == github_id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()

    if not repo:
        # Auto-register repository
        repo = Repository(
            github_id=github_id,
            owner=owner,
            name=name,
            full_name=repo_data.get("full_name", f"{owner}/{name}"),
            default_branch=repo_data.get("default_branch", "main"),
            description=repo_data.get("description"),
            language=repo_data.get("language"),
            private=repo_data.get("private", False),
        )
        db.add(repo)
        await db.flush()

    # Trigger analysis (reuse the analyses endpoint logic)
    import uuid

    from app.api.v1.analyses import _run_analysis_background
    from app.core.config import get_settings
    from app.models.models import Analysis, AnalysisStatus, PullRequest

    # Find or create PR
    stmt = select(PullRequest).where(
        PullRequest.repository_id == repo.id,
        PullRequest.number == pr_number,
    )
    pr_result = await db.execute(stmt)
    pull_request = pr_result.scalar_one_or_none()

    if not pull_request:
        head = pr_data.get("head", {})
        base = pr_data.get("base", {})
        pull_request = PullRequest(
            repository_id=repo.id,
            number=pr_number,
            title=pr_data.get("title", ""),
            description=pr_data.get("body"),
            author=pr_data.get("user", {}).get("login", ""),
            base_branch=base.get("ref", ""),
            head_branch=head.get("ref", ""),
            base_sha=base.get("sha", ""),
            head_sha=head.get("sha", ""),
            state=pr_data.get("state", "open"),
            additions=pr_data.get("additions", 0),
            deletions=pr_data.get("deletions", 0),
            changed_files=pr_data.get("changed_files", 0),
            github_url=pr_data.get("html_url", ""),
        )
        db.add(pull_request)
        await db.flush()

    # Create analysis
    analysis = Analysis(
        id=str(uuid.uuid4()),
        pull_request_id=pull_request.id,
        status=AnalysisStatus.QUEUED,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    settings = get_settings()
    background_tasks.add_task(
        _run_analysis_background,
        analysis.id,
        settings.database_url,
    )

    logger.info("Webhook triggered analysis", analysis_id=analysis.id, pr=pr_number)
    return WebhookResponse(message="Analysis queued", analysis_id=analysis.id)
