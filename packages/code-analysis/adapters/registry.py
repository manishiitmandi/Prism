"""Language registry — detects language and routes to the right analyzer."""

from pathlib import Path
from typing import ClassVar

from adapters.base import LanguageAnalyzer
from adapters.go_analyzer import GoAnalyzer
from adapters.javascript_analyzer import JavaScriptAnalyzer, TypeScriptAnalyzer
from adapters.python_analyzer import PythonAnalyzer
from models.representation import FileAnalysis


_EXTENSION_TO_LANGUAGE: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".go": "go",
    ".java": "java",
    ".rb": "ruby",
    ".rs": "rust",
    ".cpp": "cpp",
    ".c": "c",
    ".cs": "csharp",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
}


class LanguageRegistry:
    """
    Central registry for language analyzers.
    
    Usage:
        registry = LanguageRegistry()
        analyzer = registry.get_analyzer("payments/service.py")
        analysis = analyzer.analyze_file(path, source)
    """

    def __init__(self) -> None:
        self._analyzers: dict[str, LanguageAnalyzer] = {}
        self._register_defaults()

    def _register_defaults(self) -> None:
        analyzers: list[LanguageAnalyzer] = [
            PythonAnalyzer(),
            JavaScriptAnalyzer(),
            TypeScriptAnalyzer(),
            GoAnalyzer(),
        ]
        for a in analyzers:
            for ext in a.file_extensions:
                self._analyzers[ext] = a

    def register(self, analyzer: LanguageAnalyzer) -> None:
        """Register a custom language analyzer."""
        for ext in analyzer.file_extensions:
            self._analyzers[ext] = analyzer

    def get_analyzer(self, file_path: str) -> LanguageAnalyzer | None:
        """Return the analyzer for a file, or None if unsupported."""
        ext = Path(file_path).suffix.lower()
        return self._analyzers.get(ext)

    def detect_language(self, file_path: str) -> str | None:
        """Detect language name from file extension."""
        ext = Path(file_path).suffix.lower()
        return _EXTENSION_TO_LANGUAGE.get(ext)

    def supported_extensions(self) -> list[str]:
        return list(self._analyzers.keys())

    def analyze_file(self, file_path: str, source_code: str) -> FileAnalysis | None:
        """
        Analyze a file. Returns None if the language is not supported.
        Never raises.
        """
        analyzer = self.get_analyzer(file_path)
        if analyzer is None:
            return None
        try:
            return analyzer.analyze_file(file_path, source_code)
        except Exception as e:
            return FileAnalysis(
                path=file_path,
                language=self.detect_language(file_path) or "unknown",
                parse_error=str(e),
            )
