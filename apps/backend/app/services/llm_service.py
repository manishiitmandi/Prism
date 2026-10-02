"""LLM service — sends evidence package to LLM and gets structured risk analysis."""

import json
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.schemas import LLMRiskAnalysis
from app.schemas.schemas import RiskFactor as RiskFactorSchema

logger = get_logger(__name__)
settings = get_settings()

_SYSTEM_PROMPT = """You are a senior software engineer performing a Pull Request risk analysis.

You are reviewing a Pull Request using evidence produced by a static analysis system and a retrieval system.

Do not invent repository facts.

Every repository-specific claim must be supported by the supplied evidence.

If evidence is insufficient, say so explicitly.

Use retrieved code to understand semantics, but do not assume semantic similarity means an actual dependency.

CRITICAL RULES:
1. You MUST distinguish between "Detected by static analysis" and "Retrieved as semantically relevant code".
2. Every risk factor MUST reference specific file paths or symbol names from the evidence.
3. If evidence is unavailable or insufficient, say "Insufficient evidence to determine."
4. Do NOT invent: files, functions, dependencies, test coverage, API relationships, or database schemas.
5. Be concise and actionable. Developers will act on your recommendations.
6. Risk level MUST be: LOW (minor changes, few dependents, tests present), MEDIUM (moderate impact), or HIGH (core changes, many dependents, security/DB/tests absent).

Your output MUST be valid JSON matching the schema exactly.
"""

_USER_TEMPLATE = """Analyze the following Pull Request evidence and produce a structured risk report.

## PR Information
- Repository: {repo_full_name}
- PR #{pr_number}: {pr_title}
- Author: {pr_author}
- Changed files: {changed_files_count}
- Additions: {additions}, Deletions: {deletions}

==================================================
STATIC EVIDENCE (Detected by static analysis)
==================================================

### Changed Files
{changed_files}

### Changed Symbols
{changed_symbols}

### Dependency Risk Signals
{risk_signals}

### Affected Components (from call graph traversal)
{affected_components}

### Related Tests (statically linked via imports or call graph)
{related_tests}

### Missing Test Candidates (symbols with no detected test coverage)
{missing_test_candidates}

==================================================
RETRIEVED EVIDENCE (Retrieved semantically via vector search & hybrid ranking)
==================================================

### Relevant Source Code Chunks
{retrieved_source_chunks}

### Relevant Test Chunks
{retrieved_test_chunks}

---
Respond with ONLY a JSON object with this exact schema:
{{
  "summary": "2-3 sentence summary of what changed and why it matters",
  "risk_level": "LOW | MEDIUM | HIGH",
  "risk_factors": [
    {{
      "title": "Short title",
      "description": "Explanation referencing evidence",
      "evidence": ["file:line or symbol name"]
    }}
  ],
  "affected_components": [
    {{
      "component": "symbol or file name",
      "reason": "Why it's affected",
      "evidence": ["supporting evidence"]
    }}
  ],
  "recommended_tests": [
    {{
      "test_name": "descriptive_test_name",
      "reason": "What scenario this covers",
      "priority": "HIGH | MEDIUM | LOW"
    }}
  ],
  "edge_cases": ["edge case description"]
}}
"""


class LLMService:
    """
    Orchestrates LLM calls for PR risk analysis.

    Supports OpenAI and Anthropic.
    Always uses structured/JSON output.
    Falls back gracefully if LLM is unavailable.
    """

    def __init__(self) -> None:
        self._provider = settings.llm_provider
        self._openai_client: Any = None
        self._anthropic_client: Any = None

        if self._provider == "gemini" and (settings.gemini_api_key or settings.openai_api_key):
            try:
                from openai import AsyncOpenAI

                api_key = settings.gemini_api_key or settings.openai_api_key
                self._openai_client = AsyncOpenAI(
                    api_key=api_key,
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                )
            except ImportError:
                logger.warning("openai package not installed")

        elif self._provider == "openai" and settings.openai_api_key:
            try:
                from openai import AsyncOpenAI

                self._openai_client = AsyncOpenAI(
                    api_key=settings.openai_api_key,
                    base_url=settings.openai_base_url,
                )
            except ImportError:
                logger.warning("openai package not installed")

        elif self._provider == "anthropic" and settings.anthropic_api_key:
            try:
                from anthropic import AsyncAnthropic

                self._anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            except ImportError:
                logger.warning("anthropic package not installed")

    async def analyze_pr_risk(self, evidence: dict[str, Any]) -> LLMRiskAnalysis:
        """
        Send evidence package to LLM and return structured risk analysis.
        Falls back to deterministic analysis if LLM is unavailable.
        """
        prompt = self._build_prompt(evidence)

        try:
            if self._openai_client:
                return await self._call_openai(prompt)
            elif self._anthropic_client:
                return await self._call_anthropic(prompt)
            else:
                logger.warning("No LLM configured, using deterministic fallback")
                return self._deterministic_fallback(evidence)
        except Exception as e:
            logger.error("LLM call failed", error=str(e))
            return self._deterministic_fallback(evidence)

    def _build_prompt(self, evidence: dict[str, Any]) -> str:
        pr = evidence.get("pr", {})
        signals = evidence.get("dependency_metrics", {})

        # Format risk signals readably
        signals_str = "\n".join(f"- {k.replace('_', ' ').title()}: {v}" for k, v in signals.items())

        # Format changed files
        changed_files_list = evidence.get("changed_files", [])
        files_str = "\n".join(
            f"- {f.get('path', 'unknown')} ({f.get('language', '?')}): "
            f"+{f.get('added_lines', 0)}/-{f.get('removed_lines', 0)} lines"
            for f in changed_files_list[:20]
        )

        # Format changed symbols
        symbols_str = "\n".join(f"- {s}" for s in evidence.get("changed_symbols", [])[:30])

        # Format affected components
        affected_str = "\n".join(
            f"- {c.get('component', '?')}: {c.get('reason', '')}"
            for c in evidence.get("affected_components", [])[:15]
        )

        # Format related tests
        tests_str = (
            "\n".join(f"- {t}" for t in evidence.get("related_tests", [])[:10]) or "None detected"
        )

        # Format missing test candidates
        missing_str = (
            "\n".join(f"- {m}" for m in evidence.get("missing_test_candidates", [])[:10])
            or "None identified"
        )

        # Format retrieved source chunks
        retrieved_ev = evidence.get("retrieved_evidence", {})
        source_chunks = retrieved_ev.get("source_chunks", [])
        if not source_chunks:
            source_chunks = [
                c for c in evidence.get("relevant_code", []) if not c.get("is_test", False)
            ]

        if source_chunks:
            formatted_sources: list[str] = []
            for sc in source_chunks[:8]:
                prov = str(sc.get("provenance", "semantic_search")).upper()
                sim = sc.get("similarity")
                sim_str = f" [sim={sim:.2f}]" if sim is not None else ""
                f_path = sc.get("file_path") or sc.get("file", "unknown")
                s_name = sc.get("symbol_name") or sc.get("symbol", "unknown")
                s_line = sc.get("start_line", "?")
                e_line = sc.get("end_line", "?")
                lang = sc.get("language", "")
                code = sc.get("content") or sc.get("code", "")
                formatted_sources.append(
                    f"#### [{prov}]{sim_str} {f_path}:{s_line}-{e_line} ({s_name})\n"
                    f"```{lang}\n{code}\n```"
                )
            retrieved_sources_str = "\n\n".join(formatted_sources)
        else:
            retrieved_sources_str = "No semantically relevant source chunks retrieved."

        # Format retrieved test chunks
        test_chunks = retrieved_ev.get("test_chunks", [])
        if not test_chunks:
            test_chunks = [c for c in evidence.get("relevant_code", []) if c.get("is_test", False)]

        if test_chunks:
            formatted_tests: list[str] = []
            for tc in test_chunks[:5]:
                prov = str(tc.get("provenance", "semantic_search")).upper()
                sim = tc.get("similarity")
                sim_str = f" [sim={sim:.2f}]" if sim is not None else ""
                f_path = tc.get("file_path") or tc.get("file", "unknown")
                s_name = tc.get("symbol_name") or tc.get("symbol", "unknown")
                s_line = tc.get("start_line", "?")
                e_line = tc.get("end_line", "?")
                lang = tc.get("language", "")
                code = tc.get("content") or tc.get("code", "")
                formatted_tests.append(
                    f"#### [{prov}]{sim_str} {f_path}:{s_line}-{e_line} ({s_name})\n"
                    f"```{lang}\n{code}\n```"
                )
            retrieved_tests_str = "\n\n".join(formatted_tests)
        else:
            retrieved_tests_str = "No semantically relevant test chunks retrieved."

        return _USER_TEMPLATE.format(
            repo_full_name=evidence.get("repository", {}).get("full_name", "unknown"),
            pr_number=pr.get("number", "?"),
            pr_title=pr.get("title", "?"),
            pr_author=pr.get("author", "?"),
            changed_files_count=len(changed_files_list),
            additions=pr.get("additions", 0),
            deletions=pr.get("deletions", 0),
            changed_files=files_str or "None",
            changed_symbols=symbols_str or "None detected",
            risk_signals=signals_str or "None",
            affected_components=affected_str or "None detected",
            related_tests=tests_str,
            missing_test_candidates=missing_str,
            retrieved_source_chunks=retrieved_sources_str,
            retrieved_test_chunks=retrieved_tests_str,
        )

    async def _call_openai(self, prompt: str) -> LLMRiskAnalysis:
        """Call OpenAI with JSON response format."""
        if not self._openai_client:
            raise RuntimeError("OpenAI client is not initialized")
        model = settings.gemini_model if self._provider == "gemini" else settings.openai_model
        if self._provider == "gemini" and model in ("gemini-1.5-flash", "gemini-1.5-pro"):
            model = "gemini-2.5-flash"
        response = await self._openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=4096,
        )
        raw_json = response.choices[0].message.content or "{}"
        data = json.loads(raw_json)
        return LLMRiskAnalysis(**data)

    async def _call_anthropic(self, prompt: str) -> LLMRiskAnalysis:
        """Call Anthropic Claude."""
        if not self._anthropic_client:
            raise RuntimeError("Anthropic client is not initialized")
        response = await self._anthropic_client.messages.create(
            model=settings.anthropic_model,
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        # Extract JSON from response
        first_block = response.content[0]
        content = getattr(first_block, "text", str(first_block)).strip()
        if "```" in content:
            import re

            match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
            if match:
                data = json.loads(match.group(1))
                return LLMRiskAnalysis(**data)
        # Find JSON block
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(content[start:end])
            return LLMRiskAnalysis(**data)
        raise ValueError("No JSON found in Anthropic response")

    def _deterministic_fallback(self, evidence: dict[str, Any]) -> LLMRiskAnalysis:
        """
        Produce a basic risk analysis from deterministic signals alone.
        Used when LLM is unavailable.
        """
        signals = evidence.get("dependency_metrics", {})
        changed_files = evidence.get("changed_files", [])
        changed_symbols = evidence.get("changed_symbols", [])

        # Calculate risk level from signals
        score = 0
        score += min(len(changed_files) * 2, 20)
        score += min(signals.get("direct_dependents", 0) * 3, 20)
        score += 15 if signals.get("database_changed") else 0
        score += 15 if signals.get("auth_changed") else 0
        score += 10 if signals.get("public_api_changed") else 0
        score += 10 if signals.get("tests_absent") else 0
        score += 5 if signals.get("payment_changed") else 0

        if score >= 40:
            risk = "HIGH"
        elif score >= 20:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        risk_factors: list[dict[str, Any]] = []
        if len(changed_files) >= 5:
            risk_factors.append(
                {
                    "title": "Large change surface",
                    "description": f"{len(changed_files)} files changed, increasing risk of unintended side effects.",
                    "evidence": [f.get("path", "") for f in changed_files[:5]],
                }
            )
        if signals.get("database_changed"):
            risk_factors.append(
                {
                    "title": "Database model modified",
                    "description": "Database schema or model changes can cause data compatibility issues.",
                    "evidence": [
                        f.get("path", "")
                        for f in changed_files
                        if "model" in f.get("path", "").lower()
                    ],
                }
            )
        if signals.get("auth_changed"):
            risk_factors.append(
                {
                    "title": "Authentication/authorization modified",
                    "description": "Security-sensitive code changes require thorough review.",
                    "evidence": [],
                }
            )
        # Account for retrieved evidence in deterministic mode
        retrieved_ev = evidence.get("retrieved_evidence", {})
        retrieved_tests = retrieved_ev.get("test_chunks", [])
        if signals.get("tests_absent") and not retrieved_tests:
            risk_factors.append(
                {
                    "title": "No related tests detected",
                    "description": "Changed symbols have no associated test coverage in static call graph or vector retrieval.",
                    "evidence": [str(s) for s in changed_symbols[:5]],
                }
            )
        elif signals.get("tests_absent") and retrieved_tests:
            risk_factors.append(
                {
                    "title": "Unlinked test coverage retrieved semantically",
                    "description": "Static call graph did not link tests, but semantic vector search identified relevant test chunks.",
                    "evidence": [
                        f"{t.get('file_path')}:{t.get('symbol_name')}" for t in retrieved_tests[:3]
                    ],
                }
            )
            score = max(0, score - 5)  # Slight risk reduction since relevant tests were found

        retrieved_sources = retrieved_ev.get("source_chunks", [])
        rag_summary_note = (
            f" RAG retrieved {len(retrieved_sources)} relevant source chunk(s) and {len(retrieved_tests)} test chunk(s)."
            if (retrieved_sources or retrieved_tests)
            else ""
        )

        return LLMRiskAnalysis(
            summary=(
                f"PR modifies {len(changed_files)} file(s) affecting "
                f"{len(changed_symbols)} symbol(s). "
                f"Static analysis found {signals.get('direct_dependents', 0)} "
                f"downstream dependent(s).{rag_summary_note} "
                f"Note: LLM unavailable — this is a deterministic risk estimate."
            ),
            risk_level=risk,
            risk_factors=[
                RiskFactorSchema(
                    title=str(rf["title"]),
                    description=str(rf["description"]),
                    evidence=[str(e) for e in rf["evidence"]],
                )
                for rf in risk_factors
            ],
            affected_components=[],
            recommended_tests=[],
            edge_cases=[
                "LLM analysis unavailable — configure OPENAI_API_KEY or ANTHROPIC_API_KEY for full analysis"
            ],
        )
