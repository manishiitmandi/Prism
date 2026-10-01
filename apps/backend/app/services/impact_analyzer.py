"""Impact analysis — determines what's affected by PR changes."""

from dataclasses import dataclass, field
from pathlib import Path

from app.core.logging import get_logger

logger = get_logger(__name__)

# Patterns that indicate sensitive areas
_AUTH_PATTERNS = {"auth", "authentication", "authorization", "permission", "token", "jwt", "oauth", "login"}
_DB_PATTERNS = {"model", "migration", "schema", "alembic", "sequelize", "prisma", "entity", "repository", "dao"}
_CONFIG_PATTERNS = {"config", "settings", "env", "docker", "kubernetes", "deploy", "ci", ".yml", ".yaml", ".toml"}
_PAYMENT_PATTERNS = {"payment", "billing", "stripe", "paypal", "invoice", "checkout", "transaction"}
_API_PATTERNS = {"route", "router", "controller", "endpoint", "handler", "view", "api"}


@dataclass
class RiskSignals:
    changed_files: int = 0
    changed_symbols: int = 0
    direct_dependents: int = 0
    transitive_dependents: int = 0
    affected_modules: int = 0
    affected_tests: int = 0
    public_api_changed: bool = False
    database_changed: bool = False
    config_changed: bool = False
    auth_changed: bool = False
    payment_changed: bool = False
    tests_changed: bool = False
    tests_absent: bool = False
    high_centrality_nodes: int = 0


@dataclass
class ImpactResult:
    changed_symbols: list[str] = field(default_factory=list)
    affected_components: list[dict] = field(default_factory=list)  # {component, reason, evidence}
    related_tests: list[str] = field(default_factory=list)
    missing_test_candidates: list[str] = field(default_factory=list)
    risk_signals: RiskSignals = field(default_factory=RiskSignals)
    dependency_metrics: dict = field(default_factory=dict)
    graph_data: dict = field(default_factory=dict)


class ImpactAnalyzer:
    """
    Performs impact analysis using the code graph.
    
    For each changed symbol:
    1. Find callers (direct dependents)
    2. Find transitive dependents
    3. Find related tests
    4. Classify risk signals deterministically
    """

    def __init__(self, code_graph) -> None:  # CodeGraph type avoided to prevent circular
        self._graph = code_graph

    def analyze(
        self,
        changed_files: list[str],
        changed_symbols: list[str],
        all_file_paths: list[str],
    ) -> ImpactResult:
        result = ImpactResult()
        result.changed_symbols = changed_symbols

        signals = RiskSignals(
            changed_files=len(changed_files),
            changed_symbols=len(changed_symbols),
        )

        # Classify changed files by sensitivity
        for f in changed_files:
            f_lower = f.lower()
            path_parts = {p.lower() for p in Path(f).parts}
            name_lower = Path(f).name.lower()

            signals.public_api_changed |= any(p in f_lower for p in _API_PATTERNS)
            signals.database_changed |= any(p in f_lower for p in _DB_PATTERNS)
            signals.config_changed |= any(p in f_lower for p in _CONFIG_PATTERNS)
            signals.auth_changed |= any(p in f_lower for p in _AUTH_PATTERNS)
            signals.payment_changed |= any(p in f_lower for p in _PAYMENT_PATTERNS)

            # Detect test files changed
            if any(p in {"test", "tests", "spec", "specs"} for p in path_parts) or \
               name_lower.startswith("test_") or ".test." in name_lower or ".spec." in name_lower:
                signals.tests_changed = True

        # Find affected components via graph
        all_affected: set[str] = set()
        all_tests: set[str] = set()

        for symbol in changed_symbols:
            # Direct callers
            callers = self._graph.get_callers(symbol)
            # Transitive dependents
            dependents = self._graph.get_dependents(symbol, max_depth=3)

            for dep in callers + dependents:
                node_info = self._graph.get_node_info(dep)
                if not node_info:
                    continue
                is_test = node_info.get("is_test", False)
                kind = node_info.get("kind", "unknown")

                if is_test:
                    all_tests.add(dep)
                elif dep != symbol and dep not in changed_files and dep not in changed_symbols:
                    all_affected.add(dep)

            # Get related tests
            symbol_tests = self._graph.get_related_tests([symbol])
            all_tests.update(symbol_tests)

        # Also check file-level importers
        for f in changed_files:
            importers = self._graph.get_importers(f)
            for imp in importers:
                node_info = self._graph.get_node_info(imp)
                if node_info and not node_info.get("is_test", False):
                    all_affected.add(imp)

        signals.direct_dependents = len(all_affected)
        signals.transitive_dependents = len(all_affected)  # simplified for MVP
        signals.affected_tests = len(all_tests)

        # Affected modules (unique file paths)
        affected_files: set[str] = set()
        for comp in all_affected:
            node_info = self._graph.get_node_info(comp)
            if node_info and node_info.get("file_path"):
                affected_files.add(node_info["file_path"])
        signals.affected_modules = len(affected_files)

        # Check test absence
        signals.tests_absent = len(all_tests) == 0 and len(changed_symbols) > 0

        # Build affected components list
        result.affected_components = [
            {
                "component": comp,
                "reason": self._infer_reason(comp),
                "evidence": [self._graph.find_symbol_file(comp) or comp],
            }
            for comp in list(all_affected)[:20]  # cap at 20
        ]

        result.related_tests = list(all_tests)[:20]
        result.risk_signals = signals

        # Missing test candidates — changed symbols without test coverage
        tested_symbols: set[str] = set()
        for test in all_tests:
            node_info = self._graph.get_node_info(test)
            if node_info:
                file_path = node_info.get("file_path", "")
                for sym in changed_symbols:
                    if sym.lower() in test.lower():
                        tested_symbols.add(sym)

        result.missing_test_candidates = [
            s for s in changed_symbols if s not in tested_symbols
        ]

        result.dependency_metrics = {
            "direct_dependents": signals.direct_dependents,
            "transitive_dependents": signals.transitive_dependents,
            "affected_modules": signals.affected_modules,
            "affected_tests": signals.affected_tests,
            "public_api_changed": signals.public_api_changed,
            "database_changed": signals.database_changed,
            "config_changed": signals.config_changed,
            "auth_changed": signals.auth_changed,
            "payment_changed": signals.payment_changed,
            "tests_changed": signals.tests_changed,
            "tests_absent": signals.tests_absent,
        }

        # Graph visualization data (focused subgraph)
        result.graph_data = self._graph.to_serializable(
            node_ids=changed_symbols[:10] + list(all_affected)[:15]
        )

        return result

    def _infer_reason(self, component: str) -> str:
        c = component.lower()
        if any(p in c for p in _API_PATTERNS):
            return "API endpoint depends on changed component"
        if any(p in c for p in _DB_PATTERNS):
            return "Database model or repository is affected"
        if any(p in c for p in _AUTH_PATTERNS):
            return "Authentication/authorization code is affected"
        if "test" in c:
            return "Test exercises changed functionality"
        if "service" in c:
            return "Service layer calls changed component"
        return "Downstream dependent detected in call graph"
