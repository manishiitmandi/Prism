"""Go language analyzer using Tree-sitter."""

import re
from pathlib import Path

try:
    import tree_sitter_go as tsgo
    from tree_sitter import Language, Node, Parser

    TREESITTER_AVAILABLE = True
except ImportError:
    TREESITTER_AVAILABLE = False

from models.representation import (
    FileAnalysis,
    Relationship,
    RelationshipKind,
    Symbol,
    SymbolKind,
)

from adapters.base import LanguageAnalyzer


def _node_text(node: "Node", source: bytes) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


class GoAnalyzer(LanguageAnalyzer):
    """Analyzes Go source files using Tree-sitter."""

    def __init__(self) -> None:
        self._parser: Parser | None = None
        if TREESITTER_AVAILABLE:
            try:
                self._parser = Parser(Language(tsgo.language()))
            except Exception:
                self._parser = None

    @property
    def language(self) -> str:
        return "go"

    @property
    def file_extensions(self) -> list[str]:
        return [".go"]

    def is_test_file(self, file_path: str) -> bool:
        return Path(file_path).name.endswith("_test.go")

    def analyze_file(self, file_path: str, source_code: str) -> FileAnalysis:
        analysis = FileAnalysis(
            path=file_path,
            language="go",
            is_test_file=self.is_test_file(file_path),
        )

        if not source_code.strip():
            return analysis

        if not TREESITTER_AVAILABLE or self._parser is None:
            return self._fallback_analyze(file_path, source_code, analysis)

        try:
            source_bytes = source_code.encode("utf-8")
            tree = self._parser.parse(source_bytes)
            self._walk(tree.root_node, source_bytes, file_path, analysis)
        except Exception as e:
            analysis.parse_error = str(e)
            self._fallback_analyze(file_path, source_code, analysis)

        return analysis

    def _walk(self, node: "Node", source: bytes, file_path: str, analysis: FileAnalysis) -> None:
        if node.type == "import_declaration":
            for child in node.children:
                if child.type == "import_spec_list":
                    for spec in child.children:
                        if spec.type == "import_spec":
                            for sc in spec.children:
                                if sc.type == "interpreted_string_literal":
                                    raw = _node_text(sc, source).strip('"')
                                    analysis.imports.append(raw)
                                    analysis.relationships.append(
                                        Relationship(
                                            source=file_path,
                                            target=raw,
                                            kind=RelationshipKind.IMPORTS,
                                            file_path=file_path,
                                            line=node.start_point[0] + 1,
                                        )
                                    )

        elif node.type == "function_declaration":
            name_node = None
            for child in node.children:
                if child.type == "identifier":
                    name_node = child
                    break
            if name_node:
                name = _node_text(name_node, source)
                symbol = Symbol(
                    name=name,
                    qualified_name=name,
                    kind=SymbolKind.FUNCTION,
                    file_path=file_path,
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    language="go",
                    is_test=name.startswith("Test") and analysis.is_test_file,
                )
                analysis.symbols.append(symbol)

        elif node.type == "method_declaration":
            # Find receiver type and method name
            receiver_type = None
            method_name = None
            for child in node.children:
                if child.type == "parameter_list" and receiver_type is None:
                    for pc in child.children:
                        if pc.type == "parameter_declaration":
                            for tc in pc.children:
                                if tc.type in ("type_identifier", "pointer_type"):
                                    receiver_type = _node_text(tc, source).lstrip("*")
                elif child.type == "field_identifier":
                    method_name = _node_text(child, source)
            if method_name:
                qualified = f"{receiver_type}.{method_name}" if receiver_type else method_name
                symbol = Symbol(
                    name=method_name,
                    qualified_name=qualified,
                    kind=SymbolKind.METHOD,
                    file_path=file_path,
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                    language="go",
                    parent=receiver_type,
                )
                analysis.symbols.append(symbol)

        elif node.type == "type_declaration":
            for child in node.children:
                if child.type == "type_spec":
                    for sc in child.children:
                        if sc.type == "type_identifier":
                            name = _node_text(sc, source)
                            symbol = Symbol(
                                name=name,
                                qualified_name=name,
                                kind=SymbolKind.CLASS,  # struct
                                file_path=file_path,
                                start_line=node.start_point[0] + 1,
                                end_line=node.end_point[0] + 1,
                                language="go",
                            )
                            analysis.symbols.append(symbol)
                            break

        for child in node.children:
            if child.type not in (
                "function_declaration",
                "method_declaration",
                "type_declaration",
                "import_declaration",
            ):
                self._walk(child, source, file_path, analysis)

    def _fallback_analyze(
        self, file_path: str, source_code: str, analysis: FileAnalysis
    ) -> FileAnalysis:
        for i, line in enumerate(source_code.splitlines(), 1):
            stripped = line.strip()
            m = re.match(r"^func\s+(?:\(\w+\s+\*?(\w+)\)\s+)?(\w+)\s*\(", stripped)
            if m:
                receiver, name = m.group(1), m.group(2)
                qualified = f"{receiver}.{name}" if receiver else name
                analysis.symbols.append(
                    Symbol(
                        name=name,
                        qualified_name=qualified,
                        kind=SymbolKind.METHOD if receiver else SymbolKind.FUNCTION,
                        file_path=file_path,
                        start_line=i,
                        end_line=i,
                        language="go",
                    )
                )
            m = re.match(r'^import\s+"(.+)"', stripped)
            if m:
                analysis.imports.append(m.group(1))
        return analysis
