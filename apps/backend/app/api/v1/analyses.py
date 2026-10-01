"""Analysis API endpoints."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.models.models import Analysis, AnalysisStatus, PullRequest, Repository
from app.schemas.schemas import AnalysisResponse, AnalysisStatusResponse
from app.services.github_service import GitHubService

router = APIRouter(tags=["analyses"])
logger = get_logger(__name__)


async def _run_analysis_background(analysis_id: str, db_url: str) -> None:
    """Background task that runs the full analysis pipeline."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from app.services.analysis_pipeline import AnalysisPipeline

    engine = create_async_engine(db_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async with SessionLocal() as session:
        pipeline = AnalysisPipeline(session)
        await pipeline.run(analysis_id)

    await engine.dispose()


@router.post(
    "/repositories/{repo_id}/pull-requests/{pr_number}/analyze",
    response_model=AnalysisStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_analysis(
    repo_id: str,
    pr_number: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> AnalysisStatusResponse:
    """Trigger analysis of a pull request. Returns immediately with analysis ID."""
    # Verify repo exists
    stmt = select(Repository).where(Repository.id == repo_id)
    result = await db.execute(stmt)
    repository = result.scalar_one_or_none()
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Fetch or create PullRequest record
    github = GitHubService()
    try:
        pr_data = await github.get_pull_request(repository.owner, repository.name, pr_number)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"PR not found: {e}")

    # Find or create PR record
    stmt = select(PullRequest).where(
        PullRequest.repository_id == repo_id,
        PullRequest.number == pr_number,
    )
    pr_result = await db.execute(stmt)
    pull_request = pr_result.scalar_one_or_none()

    if not pull_request:
        pull_request = PullRequest(
            repository_id=repo_id,
            number=pr_number,
            title=pr_data.title,
            description=pr_data.body,
            author=pr_data.author,
            base_branch=pr_data.base_branch,
            head_branch=pr_data.head_branch,
            base_sha=pr_data.base_sha,
            head_sha=pr_data.head_sha,
            state=pr_data.state,
            additions=pr_data.additions,
            deletions=pr_data.deletions,
            changed_files=pr_data.changed_files,
            github_url=pr_data.html_url,
        )
        db.add(pull_request)
        await db.flush()

    # Create analysis record
    analysis = Analysis(
        id=str(uuid.uuid4()),
        pull_request_id=pull_request.id,
        status=AnalysisStatus.QUEUED,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    # Schedule background task
    from app.core.config import get_settings
    settings = get_settings()
    background_tasks.add_task(
        _run_analysis_background,
        analysis.id,
        settings.database_url,
    )

    logger.info("Analysis queued", analysis_id=analysis.id, pr=pr_number)
    return AnalysisStatusResponse.model_validate(analysis)


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> AnalysisResponse:
    """Get full analysis result."""
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return AnalysisResponse.model_validate(analysis)


@router.get("/analyses/{analysis_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> AnalysisStatusResponse:
    """Poll analysis status (lightweight)."""
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return AnalysisStatusResponse.model_validate(analysis)


@router.get("/analyses/{analysis_id}/risk")
async def get_analysis_risk(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get risk analysis portion."""
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {
        "risk_level": analysis.risk_level,
        "summary": analysis.summary,
        "risk_factors": analysis.risk_factors,
        "edge_cases": analysis.edge_cases,
    }


@router.get("/analyses/{analysis_id}/impact")
async def get_analysis_impact(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get impact analysis portion."""
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {
        "changed_files": analysis.changed_files_data,
        "changed_symbols": analysis.changed_symbols,
        "affected_components": analysis.affected_components,
        "dependency_metrics": analysis.dependency_metrics,
        "graph_data": analysis.graph_data,
    }


@router.get("/analyses/{analysis_id}/tests")
async def get_analysis_tests(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get test analysis portion."""
    stmt = select(Analysis).where(Analysis.id == analysis_id)
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {
        "related_tests": analysis.related_tests,
        "recommended_tests": analysis.recommended_tests,
    }
