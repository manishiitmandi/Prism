"""
PR Analysis Pipeline — orchestrates the full analysis flow.

Steps:
1. Fetch PR metadata & diff from GitHub
2. Identify changed files + languages
3. Fetch source files & parse with Tree-sitter
4. Build code dependency graph
5. Identify changed symbols
6. Perform impact analysis
7. Build evidence package
8. Call LLM for risk reasoning
9. Persist results
"""

import sys
import os
from datetime import datetime, timezone
from pathlib import Path

# Add packages to path so we can import code-analysis
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent / "packages" / "code-analysis"))

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.models import Analysis, AnalysisStatus, PullRequest, Repository
from app.services.diff_parser import FileDiff, identify_changed_symbols, parse_patch
from app.services.github_service import GitHubService, PRData
from app.services.impact_analyzer import ImpactAnalyzer
from app.services.llm_service import LLMService

logger = get_logger(__name__)
settings = get_settings()


class AnalysisPipeline:
    """
    Orchestrates the full PR analysis pipeline.
    
    Designed to be called from the worker but can be called directly.
    Updates analysis status at each stage.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._github = GitHubService()
        self._llm = LLMService()

    async def run(self, analysis_id: str) -> None:
        """Run the full analysis pipeline for an analysis record."""
        from sqlalchemy import select

        # Load analysis with PR and repo
        stmt = select(Analysis).where(Analysis.id == analysis_id)
        result = await self._db.execute(stmt)
        analysis = result.scalar_one_or_none()
        if not analysis:
            logger.error("Analysis not found", analysis_id=analysis_id)
            return

        stmt = select(PullRequest).where(PullRequest.id == analysis.pull_request_id)
        pr_result = await self._db.execute(stmt)
        pull_request = pr_result.scalar_one_or_none()

        stmt = select(Repository).where(Repository.id == pull_request.repository_id)
        repo_result = await self._db.execute(stmt)
        repository = repo_result.scalar_one_or_none()

        started_at = datetime.now(timezone.utc)
        analysis.started_at = started_at

        try:
            await self._run_pipeline(analysis, pull_request, repository)
        except Exception as e:
            logger.error(
                "Analysis pipeline failed",
                analysis_id=analysis_id,
                error=str(e),
                exc_info=True,
            )
            analysis.status = AnalysisStatus.FAILED
            analysis.error_message = str(e)

        analysis.completed_at = datetime.now(timezone.utc)
        analysis.duration_seconds = (analysis.completed_at - started_at).total_seconds()
        await self._db.commit()

    async def _run_pipeline(
        self,
        analysis: Analysis,
        pull_request: PullRequest,
        repository: Repository,
    ) -> None:
        owner, name = repository.owner, repository.name
        pr_number = pull_request.number

        # ─── STEP 1-3: Fetch PR data ──────────────────────────────────────────
        await self._update_status(analysis, AnalysisStatus.CLONING)
        logger.info("Fetching PR data", pr=pr_number, repo=repository.full_name)

        pr_data: PRData = await self._github.get_pull_request(owner, name, pr_number)

        # ─── STEP 4-5: Identify files and languages ───────────────────────────
        await self._update_status(analysis, AnalysisStatus.PARSING)

        from adapters.registry import LanguageRegistry
        registry = LanguageRegistry()

        changed_file_diffs: list[FileDiff] = []
        changed_files_data: list[dict] = []

        for f in pr_data.files:
            if f.status == "removed":
                continue
            diff = parse_patch(
                filename=f.filename,
                patch=f.patch,
                status=f.status,
                additions=f.additions,
                deletions=f.deletions,
            )
            changed_file_diffs.append(diff)
            lang = registry.detect_language(f.filename)
            changed_files_data.append({
                "path": f.filename,
                "language": lang,
                "status": f.status,
                "added_lines": f.additions,
                "removed_lines": f.deletions,
                "changed_symbols": [],  # filled later
            })

        # ─── STEP 6-8: Parse repo and build graph ────────────────────────────
        await self._update_status(analysis, AnalysisStatus.ANALYZING)
        logger.info("Parsing repository files", repo=repository.full_name)

        from models.representation import RepositoryAnalysis
        from graph.code_graph import CodeGraph

        repo_analysis = RepositoryAnalysis(root_path=f"{owner}/{name}")
        code_graph = CodeGraph()

        # Fetch and parse changed files + their direct dependencies
        files_to_analyze: set[str] = {f.filename for f in pr_data.files if f.status != "removed"}

        # Try to get a broader view by listing repo tree (up to 200 files)
        try:
            tree_items = await self._github.list_repo_files(
                owner, name, ref=pull_request.head_sha
            )
            # Prioritize analyzable files, limit total
            analyzable_extensions = set(registry.supported_extensions())
            for item in tree_items[:200]:
                path = item.get("path", "")
                if Path(path).suffix.lower() in analyzable_extensions:
                    files_to_analyze.add(path)
        except Exception as e:
            logger.warning("Could not list repo tree, analyzing changed files only", error=str(e))

        # Fetch and analyze files
        for file_path in list(files_to_analyze)[:150]:  # safety cap
            if not registry.get_analyzer(file_path):
                continue
            try:
                content = await self._github.get_file_content(
                    owner, name, file_path, ref=pull_request.head_sha
                )
                if content and len(content) <= settings.max_file_size_bytes:
                    fa = registry.analyze_file(file_path, content)
                    if fa:
                        repo_analysis.files[file_path] = fa
            except Exception as e:
                logger.debug("Failed to fetch/parse file", path=file_path, error=str(e))

        code_graph.build_from_analysis(repo_analysis)
        logger.info(
            "Graph built",
            nodes=code_graph.node_count,
            edges=code_graph.edge_count,
        )

        # ─── STEP 9: Identify changed symbols ────────────────────────────────
        all_changed_symbols: list[str] = []
        for i, diff in enumerate(changed_file_diffs):
            fa = repo_analysis.files.get(diff.filename)
            if fa:
                syms = identify_changed_symbols(diff, fa.symbols)
                all_changed_symbols.extend(syms)
                # Update changed_files_data
                for cfd in changed_files_data:
                    if cfd["path"] == diff.filename:
                        cfd["changed_symbols"] = syms
                        break

        # Deduplicate
        all_changed_symbols = list(dict.fromkeys(all_changed_symbols))
        logger.info("Changed symbols detected", count=len(all_changed_symbols))

        # ─── STEP 10-12: Impact analysis ─────────────────────────────────────
        impact_analyzer = ImpactAnalyzer(code_graph)
        impact = impact_analyzer.analyze(
            changed_files=[f.filename for f in pr_data.files],
            changed_symbols=all_changed_symbols,
            all_file_paths=list(repo_analysis.files.keys()),
        )

        # ─── STEP 13: Build evidence package ─────────────────────────────────
        await self._update_status(analysis, AnalysisStatus.RETRIEVING)

        # Collect relevant code snippets (changed symbols from changed files)
        relevant_code: list[dict] = []
        for cfd in changed_files_data[:5]:
            fa = repo_analysis.files.get(cfd["path"])
            if fa and cfd["changed_symbols"]:
                content = await self._github.get_file_content(
                    owner, name, cfd["path"], ref=pull_request.head_sha
                )
                if content:
                    lines = content.splitlines()
                    for sym_name in cfd["changed_symbols"][:2]:
                        sym = next(
                            (s for s in fa.symbols if s.qualified_name == sym_name), None
                        )
                        if sym:
                            snippet_lines = lines[sym.start_line - 1 : sym.end_line]
                            relevant_code.append({
                                "file": cfd["path"],
                                "symbol": sym_name,
                                "language": cfd["language"],
                                "start_line": sym.start_line,
                                "end_line": sym.end_line,
                                "code": "\n".join(snippet_lines[:50]),  # max 50 lines
                            })

        evidence = {
            "repository": {
                "full_name": repository.full_name,
                "owner": owner,
                "name": name,
            },
            "pr": {
                "number": pr_number,
                "title": pull_request.title,
                "author": pull_request.author,
                "additions": pr_data.additions,
                "deletions": pr_data.deletions,
            },
            "changed_files": changed_files_data,
            "changed_symbols": all_changed_symbols,
            "affected_components": impact.affected_components,
            "dependency_metrics": impact.dependency_metrics,
            "related_tests": impact.related_tests,
            "missing_test_candidates": impact.missing_test_candidates,
            "relevant_code": relevant_code,
        }

        # ─── STEP 14-15: LLM risk analysis ───────────────────────────────────
        await self._update_status(analysis, AnalysisStatus.AI_ANALYSIS)
        logger.info("Calling LLM for risk analysis", analysis_id=analysis.id)

        llm_result = await self._llm.analyze_pr_risk(evidence)

        # ─── STEP 16: Persist results ─────────────────────────────────────────
        analysis.status = AnalysisStatus.COMPLETED
        analysis.risk_level = llm_result.risk_level
        analysis.summary = llm_result.summary
        analysis.changed_files_data = changed_files_data
        analysis.changed_symbols = all_changed_symbols
        analysis.affected_components = [
            {"component": c.component, "reason": c.reason, "evidence": c.evidence}
            for c in llm_result.affected_components
        ] or impact.affected_components[:10]
        analysis.risk_factors = [
            {"title": rf.title, "description": rf.description, "evidence": rf.evidence}
            for rf in llm_result.risk_factors
        ]
        analysis.recommended_tests = [
            {"test_name": rt.test_name, "reason": rt.reason, "priority": rt.priority}
            for rt in llm_result.recommended_tests
        ]
        analysis.edge_cases = llm_result.edge_cases
        analysis.dependency_metrics = impact.dependency_metrics
        analysis.related_tests = impact.related_tests
        analysis.evidence = evidence
        analysis.graph_data = impact.graph_data

        logger.info(
            "Analysis completed",
            analysis_id=analysis.id,
            risk_level=analysis.risk_level,
        )

    async def _update_status(self, analysis: Analysis, status: AnalysisStatus) -> None:
        analysis.status = status
        await self._db.commit()
        logger.info("Analysis status updated", status=status.value, id=analysis.id)
