"""Repository API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.models import Repository
from app.schemas.schemas import RepositoryCreate, RepositoryResponse
from app.services.github_service import GitHubService

router = APIRouter(prefix="/repositories", tags=["repositories"])
logger = get_logger(__name__)


@router.post("", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def create_repository(
    payload: RepositoryCreate,
    db: AsyncSession = Depends(get_db),
) -> RepositoryResponse:
    """Add a GitHub repository for analysis."""
    github = GitHubService()
    try:
        repo_data = await github.get_repository(payload.owner, payload.name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found or GitHub API error: {e}",
        )

    # Check if already exists
    stmt = select(Repository).where(Repository.github_id == repo_data.github_id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return RepositoryResponse.model_validate(existing)

    repo = Repository(
        github_id=repo_data.github_id,
        owner=repo_data.owner,
        name=repo_data.name,
        full_name=repo_data.full_name,
        default_branch=repo_data.default_branch,
        description=repo_data.description,
        language=repo_data.language,
        private=repo_data.private,
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return RepositoryResponse.model_validate(repo)


@router.get("", response_model=list[RepositoryResponse])
async def list_repositories(
    db: AsyncSession = Depends(get_db),
) -> list[RepositoryResponse]:
    """List all tracked repositories."""
    stmt = select(Repository).order_by(Repository.created_at.desc())
    result = await db.execute(stmt)
    repos = result.scalars().all()
    return [RepositoryResponse.model_validate(r) for r in repos]


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(
    repo_id: str,
    db: AsyncSession = Depends(get_db),
) -> RepositoryResponse:
    """Get a repository by ID."""
    stmt = select(Repository).where(Repository.id == repo_id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return RepositoryResponse.model_validate(repo)


@router.get("/{repo_id}/pull-requests")
async def list_pull_requests(
    repo_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List open PRs for a repository from GitHub."""
    stmt = select(Repository).where(Repository.id == repo_id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    github = GitHubService()
    try:
        prs = await github.list_pull_requests(repo.owner, repo.name, state="open")
        return [
            {
                "number": pr["number"],
                "title": pr["title"],
                "author": pr["user"]["login"],
                "state": pr["state"],
                "base_branch": pr["base"]["ref"],
                "head_branch": pr["head"]["ref"],
                "additions": pr.get("additions", 0),
                "deletions": pr.get("deletions", 0),
                "changed_files": pr.get("changed_files", 0),
                "html_url": pr["html_url"],
                "created_at": pr["created_at"],
                "updated_at": pr["updated_at"],
            }
            for pr in prs
        ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GitHub API error: {e}")
