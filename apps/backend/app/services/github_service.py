"""GitHub API integration service."""

import base64
import hashlib
import hmac
from dataclasses import dataclass
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


@dataclass
class PRFile:
    filename: str
    status: str  # added, modified, removed, renamed
    additions: int
    deletions: int
    patch: str | None  # unified diff


@dataclass
class PRData:
    number: int
    title: str
    body: str | None
    author: str
    base_branch: str
    head_branch: str
    base_sha: str
    head_sha: str
    state: str
    additions: int
    deletions: int
    changed_files: int
    html_url: str
    files: list[PRFile]


@dataclass
class RepoData:
    github_id: int
    owner: str
    name: str
    full_name: str
    default_branch: str
    description: str | None
    language: str | None
    private: bool


class GitHubService:
    """
    Wraps GitHub REST API calls.
    
    Uses a PAT for authentication (OAuth can be added later).
    Implements retries with exponential backoff for rate limits.
    """

    BASE_URL = "https://api.github.com"

    def __init__(self, token: str | None = None) -> None:
        self._token = token or settings.github_token
        self._headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self._token:
            self._headers["Authorization"] = f"Bearer {self._token}"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers=self._headers,
            timeout=30.0,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def get_repository(self, owner: str, name: str) -> RepoData:
        """Fetch repository metadata."""
        async with self._client() as client:
            resp = await client.get(f"/repos/{owner}/{name}")
            resp.raise_for_status()
            data = resp.json()

        return RepoData(
            github_id=data["id"],
            owner=data["owner"]["login"],
            name=data["name"],
            full_name=data["full_name"],
            default_branch=data.get("default_branch", "main"),
            description=data.get("description"),
            language=data.get("language"),
            private=data.get("private", False),
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def get_pull_request(self, owner: str, name: str, pr_number: int) -> PRData:
        """Fetch PR metadata and file list."""
        async with self._client() as client:
            resp = await client.get(f"/repos/{owner}/{name}/pulls/{pr_number}")
            resp.raise_for_status()
            pr = resp.json()

            # Fetch files (paginated, max 300 for MVP)
            files_resp = await client.get(
                f"/repos/{owner}/{name}/pulls/{pr_number}/files",
                params={"per_page": 100},
            )
            files_resp.raise_for_status()
            raw_files = files_resp.json()

        pr_files = [
            PRFile(
                filename=f["filename"],
                status=f["status"],
                additions=f.get("additions", 0),
                deletions=f.get("deletions", 0),
                patch=f.get("patch"),
            )
            for f in raw_files
        ]

        return PRData(
            number=pr["number"],
            title=pr["title"],
            body=pr.get("body"),
            author=pr["user"]["login"],
            base_branch=pr["base"]["ref"],
            head_branch=pr["head"]["ref"],
            base_sha=pr["base"]["sha"],
            head_sha=pr["head"]["sha"],
            state=pr["state"],
            additions=pr.get("additions", 0),
            deletions=pr.get("deletions", 0),
            changed_files=pr.get("changed_files", 0),
            html_url=pr["html_url"],
            files=pr_files,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def get_file_content(
        self, owner: str, name: str, file_path: str, ref: str
    ) -> str | None:
        """Fetch file content at a specific commit/branch."""
        async with self._client() as client:
            resp = await client.get(
                f"/repos/{owner}/{name}/contents/{file_path}",
                params={"ref": ref},
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()

        if data.get("encoding") == "base64":
            content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return content
        return data.get("content")

    async def list_pull_requests(
        self, owner: str, name: str, state: str = "open", per_page: int = 30
    ) -> list[dict]:
        """List pull requests for a repository."""
        async with self._client() as client:
            resp = await client.get(
                f"/repos/{owner}/{name}/pulls",
                params={"state": state, "per_page": per_page},
            )
            resp.raise_for_status()
            return resp.json()

    async def list_repo_files(
        self, owner: str, name: str, ref: str, path: str = ""
    ) -> list[dict]:
        """List files in a directory recursively via Git Trees API."""
        async with self._client() as client:
            resp = await client.get(
                f"/repos/{owner}/{name}/git/trees/{ref}",
                params={"recursive": "1"},
            )
            resp.raise_for_status()
            data = resp.json()
        return [item for item in data.get("tree", []) if item.get("type") == "blob"]

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify GitHub webhook HMAC-SHA256 signature."""
        secret = settings.github_webhook_secret
        if not secret:
            return True  # No secret configured = skip validation (dev mode)
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()
        # Note: hmac.new() is the correct Python API
        return hmac.compare_digest(expected, signature)
