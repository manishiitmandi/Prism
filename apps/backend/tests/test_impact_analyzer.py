from graph.code_graph import CodeGraph
from models.representation import (
    FileAnalysis,
    Relationship,
    RelationshipKind,
    RepositoryAnalysis,
    Symbol,
    SymbolKind,
)

from app.services.impact_analyzer import ImpactAnalyzer


def create_sample_repo() -> RepositoryAnalysis:
    """
    Creates a sample repository:
    A.do_thing (in file_a.py)
    B.use_thing (in file_b.py) calls A.do_thing
    C.main (in file_c.py) calls B.use_thing
    test_a.test_do_thing (in tests/test_a.py) calls A.do_thing
    """
    sym_a = Symbol(
        name="do_thing",
        qualified_name="A.do_thing",
        kind=SymbolKind.FUNCTION,
        file_path="file_a.py",
        start_line=1,
        end_line=10,
        language="python",
    )
    sym_b = Symbol(
        name="use_thing",
        qualified_name="B.use_thing",
        kind=SymbolKind.FUNCTION,
        file_path="file_b.py",
        start_line=1,
        end_line=10,
        language="python",
    )
    sym_c = Symbol(
        name="main",
        qualified_name="C.main",
        kind=SymbolKind.FUNCTION,
        file_path="file_c.py",
        start_line=1,
        end_line=10,
        language="python",
    )
    test_sym = Symbol(
        name="test_do_thing",
        qualified_name="test_a.test_do_thing",
        kind=SymbolKind.FUNCTION,
        file_path="tests/test_a.py",
        start_line=1,
        end_line=5,
        language="python",
        is_test=True,
    )

    fa_a = FileAnalysis(
        path="file_a.py",
        language="python",
        symbols=[sym_a],
        is_test_file=False,
    )
    fa_b = FileAnalysis(
        path="file_b.py",
        language="python",
        symbols=[sym_b],
        relationships=[
            Relationship(
                source="B.use_thing",
                target="A.do_thing",
                kind=RelationshipKind.CALLS,
                line=5,
            )
        ],
        is_test_file=False,
    )
    fa_c = FileAnalysis(
        path="file_c.py",
        language="python",
        symbols=[sym_c],
        relationships=[
            Relationship(
                source="C.main",
                target="B.use_thing",
                kind=RelationshipKind.CALLS,
                line=5,
            )
        ],
        is_test_file=False,
    )
    fa_test = FileAnalysis(
        path="tests/test_a.py",
        language="python",
        symbols=[test_sym],
        relationships=[
            Relationship(
                source="test_a.test_do_thing",
                target="A.do_thing",
                kind=RelationshipKind.CALLS,
                line=2,
            )
        ],
        is_test_file=True,
    )

    repo = RepositoryAnalysis(root_path="/repo")
    repo.files = {
        "file_a.py": fa_a,
        "file_b.py": fa_b,
        "file_c.py": fa_c,
        "tests/test_a.py": fa_test,
    }
    return repo


def test_transitive_vs_direct_separation():
    repo = create_sample_repo()
    graph = CodeGraph()
    graph.build_from_analysis(repo)

    analyzer = ImpactAnalyzer(graph)

    # When A.do_thing changes:
    # Direct caller: B.use_thing
    # Transitive caller: C.main
    # Related test: test_a.test_do_thing
    result = analyzer.analyze(
        changed_files=["file_a.py"],
        changed_symbols=["A.do_thing"],
        all_file_paths=list(repo.files.keys()),
    )

    signals = result.risk_signals
    # Verify P0-3 fix: direct and transitive are separated!
    assert signals.direct_dependents == 1  # B.use_thing
    assert signals.transitive_dependents == 1  # C.main
    assert signals.affected_tests == 1  # test_a.test_do_thing
    assert not signals.tests_absent


def test_centrality_and_sensitive_patterns():
    # Construct a high-centrality node with 4 callers
    repo = RepositoryAnalysis(root_path="/repo")
    target_sym = Symbol(
        name="auth_service",
        qualified_name="AuthService.verify",
        kind=SymbolKind.FUNCTION,
        file_path="app/auth/service.py",
        start_line=1,
        end_line=20,
        language="python",
    )
    fa_target = FileAnalysis(
        path="app/auth/service.py",
        language="python",
        symbols=[target_sym],
    )
    repo.files["app/auth/service.py"] = fa_target

    # Add 4 callers
    for i in range(4):
        caller_name = f"Client{i}.call"
        caller_sym = Symbol(
            name="call",
            qualified_name=caller_name,
            kind=SymbolKind.FUNCTION,
            file_path=f"client_{i}.py",
            start_line=1,
            end_line=5,
            language="python",
        )
        fa_caller = FileAnalysis(
            path=f"client_{i}.py",
            language="python",
            symbols=[caller_sym],
            relationships=[
                Relationship(
                    source=caller_name,
                    target="AuthService.verify",
                    kind=RelationshipKind.CALLS,
                    line=2,
                )
            ],
        )
        repo.files[f"client_{i}.py"] = fa_caller

    graph = CodeGraph()
    graph.build_from_analysis(repo)
    analyzer = ImpactAnalyzer(graph)

    result = analyzer.analyze(
        changed_files=["app/auth/service.py"],
        changed_symbols=["AuthService.verify"],
        all_file_paths=list(repo.files.keys()),
    )

    assert result.risk_signals.auth_changed is True
    assert result.risk_signals.direct_dependents == 4
    assert result.risk_signals.high_centrality_nodes == 1
    assert result.risk_signals.tests_absent is True  # no tests in repo
