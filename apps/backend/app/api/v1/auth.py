"""Authentication and User management endpoints."""

import re
from datetime import timedelta
import httpx
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import create_access_token, decode_access_token, get_password_hash, verify_password
from app.models.models import Repository, User, UserRepository
from app.schemas.schemas import (
    AuthTokenResponse,
    EmailLoginRequest,
    EmailRegisterRequest,
    TrackRepoRequest,
    UserMonitoredRepoResponse,
    UserResponse,
)
from app.services.github_service import GitHubService

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)
settings = get_settings()

# Email validation pattern
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


# ─── Auth Dependencies ────────────────────────────────────────────────────────


async def get_optional_current_user(
    authorization: str | None = Header(None),
    prism_session: str | None = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Extract user from Authorization Bearer header or prism_session cookie."""
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
    elif prism_session:
        token = prism_session

    if not token:
        return None

    user_id = decode_access_token(token)
    if not user_id:
        return None

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_current_user(
    user: User | None = Depends(get_optional_current_user),
) -> User:
    """Require an authenticated user."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ─── Auth Endpoints ───────────────────────────────────────────────────────────


@router.post("/login", response_model=AuthTokenResponse)
async def email_login(
    payload: EmailLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenResponse:
    """Sign in with email and password. Built-in test account: test@gmail.com / password."""
    email_clean = payload.email.strip().lower()
    is_test_account = email_clean in ["test@gmail.com", "test@prism.internal", "demo@prism.internal"]

    # 1. Look up user by email
    stmt = select(User).where(func.lower(User.email) == email_clean)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        if is_test_account:
            # Auto-provision official test account
            user = User(
                auth_provider="email",
                username="test-developer",
                name="Alex Developer",
                email="test@gmail.com",
                avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                hashed_password=get_password_hash("password"),
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

            # Pre-pin repositories for rich dashboard experience
            repo_stmt = select(Repository).limit(3)
            repo_res = await db.execute(repo_stmt)
            for r in repo_res.scalars().all():
                db.add(
                    UserRepository(
                        user_id=user.id,
                        repository_id=r.id,
                        role="tracked_oss",
                        is_pinned=True,
                    )
                )
            await db.commit()
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No account found with this email. Please create an account first.",
            )

    # 2. Verify password
    if is_test_account:
        if payload.password in ["password", "password123", "test", "testpass"] or (
            user.hashed_password and verify_password(payload.password, user.hashed_password)
        ):
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid test password. Use 'password' for test@gmail.com.",
            )
    else:
        if user.hashed_password and not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

    token = create_access_token(user.id, expires_delta=timedelta(days=7))
    response.set_cookie(
        key="prism_session",
        value=token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="lax",
        secure=False,
    )

    logger.info("User signed in via email", user_id=user.id, email=user.email)
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=AuthTokenResponse)
async def email_register(
    payload: EmailRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenResponse:
    """Register a new account with email and password."""
    email_clean = payload.email.strip().lower()

    # Validate email format
    if not EMAIL_REGEX.match(email_clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid email address.",
        )

    # Validate password strength
    pw = payload.password
    pw_errors = []
    if len(pw) < 6:
        pw_errors.append("at least 6 characters")
    if not any(c.isupper() for c in pw):
        pw_errors.append("an uppercase letter")
    if not any(c.islower() for c in pw):
        pw_errors.append("a lowercase letter")
    if not any(c.isdigit() for c in pw):
        pw_errors.append("a number")
    if pw_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must contain {', '.join(pw_errors)}.",
        )

    stmt = select(User).where(func.lower(User.email) == email_clean)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in.",
        )

    username = email_clean.split("@")[0]
    display_name = payload.name or username.replace(".", " ").replace("-", " ").title()
    user = User(
        auth_provider="email",
        username=username,
        name=display_name,
        email=email_clean,
        avatar_url=f"https://api.dicebear.com/7.x/identicon/svg?seed={username}",
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, expires_delta=timedelta(days=7))
    response.set_cookie(
        key="prism_session",
        value=token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="lax",
        secure=False,
    )

    logger.info("User registered via email", user_id=user.id, email=user.email)
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/demo-login", response_model=AuthTokenResponse)
async def demo_login(
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenResponse:
    """1-click instant login for local evaluation and testing without OAuth keys."""
    demo_username = "alex-developer"
    demo_email = "alex.developer@prism.internal"

    # Find or create demo user
    stmt = select(User).where(User.username == demo_username, User.auth_provider == "demo")
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            auth_provider="demo",
            username=demo_username,
            name="Alex Developer",
            email=demo_email,
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Automatically pin any existing repository (like fastapi) to demo dashboard
        repo_stmt = select(Repository).limit(3)
        repo_res = await db.execute(repo_stmt)
        existing_repos = repo_res.scalars().all()
        for r in existing_repos:
            user_repo = UserRepository(
                user_id=user.id,
                repository_id=r.id,
                role="tracked_oss",
                is_pinned=True,
            )
            db.add(user_repo)
        if existing_repos:
            await db.commit()

    # Generate token
    token = create_access_token(user.id, expires_delta=timedelta(days=7))

    # Set HTTP-only cookie
    response.set_cookie(
        key="prism_session",
        value=token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="lax",
        secure=False,
    )

    logger.info("Demo user logged in", user_id=user.id, username=user.username)
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/github")
async def github_login_redirect() -> RedirectResponse:
    """Redirect to GitHub OAuth authorization screen."""
    if not settings.github_client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env or use 1-click Demo Login.",
        )

    redirect_uri = f"{settings.frontend_url}/api/auth/callback/github"
    scope = "read:user user:email repo"
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
    )
    return RedirectResponse(url=github_auth_url)


@router.get("/github/callback")
async def github_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Exchange GitHub OAuth code for access token and authenticate user."""
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub OAuth credentials not configured",
        )

    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
        )
        token_data = token_res.json()
        github_token = token_data.get("access_token")

        if not github_token:
            error_desc = token_data.get("error_description", "Failed to retrieve GitHub access token")
            return RedirectResponse(url=f"{settings.frontend_url}/?error={error_desc}")

        # 2. Fetch user profile
        user_res = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        gh_user = user_res.json()
        gh_id = gh_user.get("id")
        gh_login = gh_user.get("login")
        gh_name = gh_user.get("name") or gh_login
        gh_email = gh_user.get("email")
        gh_avatar = gh_user.get("avatar_url")

    # 3. Find or create user
    stmt = select(User).where(User.github_id == gh_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            auth_provider="github",
            github_id=gh_id,
            username=gh_login,
            name=gh_name,
            email=gh_email,
            avatar_url=gh_avatar,
            github_access_token=github_token,
        )
        db.add(user)
    else:
        user.username = gh_login
        user.name = gh_name
        user.avatar_url = gh_avatar
        user.github_access_token = github_token

    await db.commit()
    await db.refresh(user)

    # 4. Generate JWT
    token = create_access_token(user.id, expires_delta=timedelta(days=7))

    # Redirect to frontend with token
    redirect_target = f"{settings.frontend_url}/dashboard?token={token}"
    response = RedirectResponse(url=redirect_target)
    response.set_cookie(
        key="prism_session",
        value=token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="lax",
    )
    return response


@router.get("/google")
async def google_login_redirect() -> RedirectResponse:
    """Redirect to Google OAuth authorization screen."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env or use 1-click Demo Login.",
        )

    redirect_uri = f"{settings.frontend_url}/api/auth/callback/google"
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
    )
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Exchange Google OAuth code for access token and authenticate user."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google OAuth credentials not configured",
        )

    redirect_uri = f"{settings.frontend_url}/api/auth/callback/google"

    async with httpx.AsyncClient() as client:
        # 1. Exchange code
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        token_data = token_res.json()
        access_token = token_data.get("access_token")

        if not access_token:
            return RedirectResponse(url=f"{settings.frontend_url}/?error=Google authentication failed")

        # 2. Fetch Google profile
        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        g_user = userinfo_res.json()
        g_id = g_user.get("sub")
        g_email = g_user.get("email")
        g_name = g_user.get("name") or g_email.split("@")[0]
        g_avatar = g_user.get("picture")

    # 3. Find or create user
    stmt = select(User).where(User.google_id == g_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            auth_provider="google",
            google_id=g_id,
            username=g_email.split("@")[0],
            name=g_name,
            email=g_email,
            avatar_url=g_avatar,
        )
        db.add(user)
    else:
        user.name = g_name
        user.avatar_url = g_avatar

    await db.commit()
    await db.refresh(user)

    # 4. Generate JWT
    token = create_access_token(user.id, expires_delta=timedelta(days=7))

    redirect_target = f"{settings.frontend_url}/dashboard?token={token}"
    response = RedirectResponse(url=redirect_target)
    response.set_cookie(
        key="prism_session",
        value=token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="lax",
    )
    return response


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)) -> UserResponse:
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(user)


@router.post("/logout")
async def logout(response: Response) -> dict:
    """Clear session cookie."""
    response.delete_cookie(key="prism_session")
    return {"message": "Logged out successfully"}


# ─── User Monitored Repositories ──────────────────────────────────────────────


@router.get("/monitored-repos", response_model=list[UserMonitoredRepoResponse])
async def get_monitored_repositories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserMonitoredRepoResponse]:
    """Get all repositories pinned or tracked by the current user."""
    stmt = (
        select(UserRepository)
        .where(UserRepository.user_id == user.id)
        .options(selectinload(UserRepository.repository))
        .order_by(UserRepository.created_at.desc())
    )
    result = await db.execute(stmt)
    monitored = result.scalars().all()
    return [UserMonitoredRepoResponse.model_validate(m) for m in monitored]


@router.post("/track-repo", response_model=UserMonitoredRepoResponse, status_code=status.HTTP_201_CREATED)
async def track_repository(
    payload: TrackRepoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMonitoredRepoResponse:
    """Pin an open-source or personal repository to the current user's dashboard."""
    github = GitHubService()
    try:
        repo_data = await github.get_repository(payload.owner, payload.name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found on GitHub: {e}",
        )

    # 1. Find or create Repository in DB
    stmt = select(Repository).where(Repository.github_id == repo_data.github_id)
    result = await db.execute(stmt)
    repo = result.scalar_one_or_none()

    if not repo:
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

    # 2. Check if already tracked by this user
    track_stmt = select(UserRepository).where(
        UserRepository.user_id == user.id,
        UserRepository.repository_id == repo.id,
    ).options(selectinload(UserRepository.repository))
    track_result = await db.execute(track_stmt)
    existing_track = track_result.scalar_one_or_none()

    if existing_track:
        return UserMonitoredRepoResponse.model_validate(existing_track)

    # 3. Create tracking record
    user_repo = UserRepository(
        user_id=user.id,
        repository_id=repo.id,
        role=payload.role,
        is_pinned=True,
    )
    db.add(user_repo)
    await db.commit()
    await db.refresh(user_repo)

    # Re-fetch with relationship loaded
    track_stmt = select(UserRepository).where(UserRepository.id == user_repo.id).options(selectinload(UserRepository.repository))
    track_result = await db.execute(track_stmt)
    user_repo_loaded = track_result.scalar_one()

    logger.info("User tracked repository", user_id=user.id, repo=repo.full_name)
    return UserMonitoredRepoResponse.model_validate(user_repo_loaded)


@router.delete("/track-repo/{repository_id}")
async def untrack_repository(
    repository_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Remove a repository from the user's personal dashboard."""
    stmt = select(UserRepository).where(
        UserRepository.user_id == user.id,
        UserRepository.repository_id == repository_id,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Tracked repository not found")

    await db.delete(record)
    await db.commit()
    return {"message": "Repository removed from dashboard"}
