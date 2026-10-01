"""Abstract base class for all language analyzers."""

from abc import ABC, abstractmethod
from pathlib import Path

from models.representation import FileAnalysis


class LanguageAnalyzer(ABC):
    """
    Abstract analyzer that each language adapter must implement.
    
    Responsibilities:
    - extract symbols (functions, classes, methods, variables)
    - extract imports
    - extract calls and references
    - identify test files
    - identify definitions and references
    - map everything into the common intermediate representation
    """

    @property
    @abstractmethod
    def language(self) -> str:
        """Return the language name (e.g. 'python', 'javascript')."""
        ...

    @property
    @abstractmethod
    def file_extensions(self) -> list[str]:
        """Return file extensions this analyzer handles (e.g. ['.py'])."""
        ...

    @abstractmethod
    def analyze_file(self, file_path: str, source_code: str) -> FileAnalysis:
        """
        Parse source code and produce a FileAnalysis.
        
        Must never raise — return FileAnalysis with parse_error set on failure.
        """
        ...

    def is_test_file(self, file_path: str) -> bool:
        """Return True if file is a test file by convention."""
        p = Path(file_path)
        name = p.name.lower()
        parts = [part.lower() for part in p.parts]
        return (
            "test" in parts
            or "tests" in parts
            or "spec" in parts
            or "specs" in parts
            or name.startswith("test_")
            or name.endswith("_test.py")
            or name.endswith(".test.js")
            or name.endswith(".test.ts")
            or name.endswith(".spec.js")
            or name.endswith(".spec.ts")
        )

    def can_handle(self, file_path: str) -> bool:
        """Return True if this analyzer can handle the given file."""
        return Path(file_path).suffix.lower() in self.file_extensions
