"""Common Intermediate Representation for code entities across all languages."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SymbolKind(str, Enum):
    FUNCTION = "function"
    METHOD = "method"
    CLASS = "class"
    INTERFACE = "interface"
    VARIABLE = "variable"
    CONSTANT = "constant"
    MODULE = "module"
    IMPORT = "import"
    TEST = "test"
    UNKNOWN = "unknown"


class RelationshipKind(str, Enum):
    CONTAINS = "CONTAINS"
    DEFINES = "DEFINES"
    IMPORTS = "IMPORTS"
    CALLS = "CALLS"
    REFERENCES = "REFERENCES"
    EXTENDS = "EXTENDS"
    IMPLEMENTS = "IMPLEMENTS"
    TESTS = "TESTS"
    DEPENDS_ON = "DEPENDS_ON"


@dataclass
class Symbol:
    """A named code entity (function, class, method, etc.)."""
    name: str
    qualified_name: str           # e.g. "PaymentService.process_payment"
    kind: SymbolKind
    file_path: str
    start_line: int
    end_line: int
    language: str
    parent: str | None = None     # qualified name of containing symbol
    is_test: bool = False
    is_public: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Relationship:
    """A directed relationship between two symbols or files."""
    source: str   # qualified name or file path
    target: str   # qualified name or file path
    kind: RelationshipKind
    file_path: str | None = None
    line: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class FileAnalysis:
    """Complete analysis result for a single file."""
    path: str
    language: str
    symbols: list[Symbol] = field(default_factory=list)
    relationships: list[Relationship] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)    # raw import paths
    is_test_file: bool = False
    parse_error: str | None = None


@dataclass
class RepositoryAnalysis:
    """Complete parsed representation of a repository."""
    root_path: str
    files: dict[str, FileAnalysis] = field(default_factory=dict)  # path -> FileAnalysis

    @property
    def all_symbols(self) -> list[Symbol]:
        return [s for fa in self.files.values() for s in fa.symbols]

    @property
    def all_relationships(self) -> list[Relationship]:
        return [r for fa in self.files.values() for r in fa.relationships]

    @property
    def test_files(self) -> list[str]:
        return [path for path, fa in self.files.items() if fa.is_test_file]
