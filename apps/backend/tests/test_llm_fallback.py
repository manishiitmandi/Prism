import pytest
from app.services.llm_service import LLMService
from app.schemas.schemas import LLMRiskAnalysis, RiskFactor


def test_deterministic_fallback_basic():
    service = LLMService()
    evidence = {
        "changed_files": [{"path": "app/main.py"}],
        "changed_symbols": ["main"],
        "dependency_metrics": {
            "direct_dependents": 0,
            "transitive_dependents": 0,
            "auth_changed": False,
            "payment_changed": False,
            "database_changed": False,
            "config_changed": False,
            "public_api_changed": False,
            "tests_changed": True,
            "tests_absent": False,
            "high_centrality_nodes": 0,
        },
    }

    result = service._deterministic_fallback(evidence)
    assert isinstance(result, LLMRiskAnalysis)
    assert result.risk_level == "LOW"
    assert isinstance(result.risk_factors, list)
    assert len(result.risk_factors) == 0


def test_deterministic_fallback_high_risk_and_risk_factors_populated():
    service = LLMService()
    evidence = {
        "changed_files": [
            {"path": "app/api/auth.py"},
            {"path": "app/models/user.py"},
            {"path": "app/models/account.py"},
            {"path": "app/services/auth_service.py"},
            {"path": "app/services/token.py"},
        ],
        "changed_symbols": ["login", "User", "Account", "verify_token"],
        "dependency_metrics": {
            "direct_dependents": 6,
            "transitive_dependents": 12,
            "auth_changed": True,
            "payment_changed": False,
            "database_changed": True,
            "config_changed": False,
            "public_api_changed": True,
            "tests_changed": False,
            "tests_absent": True,
            "high_centrality_nodes": 2,
        },
    }

    result = service._deterministic_fallback(evidence)
    assert isinstance(result, LLMRiskAnalysis)
    assert result.risk_level == "HIGH"
    # Ensure P0-1 bug is fixed: risk_factors must not be empty!
    assert len(result.risk_factors) > 0
    for rf in result.risk_factors:
        assert isinstance(rf, RiskFactor)
        assert rf.title
        assert rf.description
        assert isinstance(rf.evidence, list)

    titles = [rf.title for rf in result.risk_factors]
    assert any("Authentication" in t for t in titles)
    assert any("Database" in t for t in titles)
    assert any("tests" in t.lower() for t in titles)
    assert any("Large change" in t for t in titles)
