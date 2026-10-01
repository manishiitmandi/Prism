"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import analyses, repositories, webhooks
from app.core.config import get_settings
from app.core.database import Base, engine
from app.core.logging import configure_logging, get_logger
from app.schemas.schemas import HealthResponse

settings = get_settings()
configure_logging(debug=settings.debug)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup/shutdown lifecycle."""
    logger.info("PRism starting up", version=settings.app_version)
    # Create tables (use Alembic for production migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")
    yield
    logger.info("PRism shutting down")
    await engine.dispose()


app = FastAPI(
    title="PRism API",
    description="AI-powered GitHub Pull Request Risk Analyzer",
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
prefix = settings.api_v1_prefix
app.include_router(repositories.router, prefix=prefix)
app.include_router(analyses.router, prefix=prefix)
app.include_router(webhooks.router, prefix=prefix)


@app.get(f"{prefix}/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        environment=settings.environment,
    )


@app.get("/", tags=["root"])
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }
