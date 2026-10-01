"""Python language analyzer using Tree-sitter."""

import sys
from pathlib import Path

try:
    import tree_sitter_python as tspython
    from tree_sitter import Language, Node, Parser
    TREESITTER_AVAILABLE = True
except ImportError:
    TREESITTER_AVAILABLE = False

from adapters.base import LanguageAnalyzer
from models.representation import (
    FileAnalysis,
    Relationship,
    RelationshipKind,
    Symbol,
    SymbolKind,
)


def _node_text(node: "Node", source: bytes) -> str:
    return source[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _get_child_by_type(node: "Node", type_name: str) -> "Node | None":
    for child in node.children:
        if child.type == type_name:
            return child
    return None


class PythonAnalyzer(LanguageAnalyzer):
    """Analyzes Python source files using Tree-sitter."""

    def __init__(self) -> None:
        self._parser: "Parser | None" = None
        if TREESITTER_AVAILABLE:
            self._parser = Parser(Language(tspython.language()))

    @property
    def language(self) -> str:
        return "python"

    @property
    def file_extensions(self) -> list[str]:
        return [".py"]

    def is_test_file(self, file_path: str) -> bool:
        p = Path(file_path)
        name = p.name
        parts = [part.lower() for part in p.parts]
        return (
            "test" in parts
            or "tests" in parts
            or name.startswith("test_")
            or name.endswith("_test.py")
            or "conftest" in name
        )

    def analyze_file(self, file_path: str, source_code: str) -> FileAnalysis:
        analysis = FileAnalysis(
            path=file_path,
            language="python",
            is_test_file=self.is_test_file(file_path),
        )

        if not source_code.strip():
            return analysis

        if not TREESITTER_AVAILABLE or self._parser is None:
            return self._fallback_analyze(file_path, source_code, analysis)

        try:
            source_bytes = source_code.encode("utf-8")
            tree = self._parser.parse(source_bytes)
            self._extract_from_tree(tree.root_node, source_bytes, file_path, analysis)
        except Exception as e:
            analysis.parse_error = str(e)
            self._fallback_analyze(file_path, source_code, analysis)

        return analysis

    def _extract_from_tree(
        self,
        root: "Node",
        source: bytes,
        file_path: str,
        analysis: FileAnalysis,
        parent_name: str | None = None,
    ) -> None:
        """Recursively walk the AST and extract symbols and relationships."""
        for node in root.children:
            if node.type == "import_statement":
                self._handle_import(node, source, file_path, analysis)

            elif node.type == "import_from_statement":
                self._handle_from_import(node, source, file_path, analysis)

            elif node.type == "class_definition":
                self._handle_class(node, source, file_path, analysis)

            elif node.type == "function_definition":
                self._handle_function(node, source, file_path, analysis, parent_name)

            elif node.type == "decorated_definition":
                # Unwrap decorator
                for child in node.children:
                    if child.type in ("function_definition", "class_definition"):
                        if child.type == "class_definition":
                            self._handle_class(child, source, file_path, analysis)
                        else:
                            self._handle_function(child, source, file_path, analysis, parent_name)

    def _handle_import(
        self, node: "Node", source: bytes, file_path: str, analysis: FileAnalysis
    ) -> None:
        for child in node.children:
            if child.type in ("dotted_name", "aliased_import"):
                raw = _node_text(child, source).split(" as ")[0].strip()
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

    def _handle_from_import(
        self, node: "Node", source: bytes, file_path: str, analysis: FileAnalysis
    ) -> None:
        module_parts: list[str] = []
        for child in node.children:
            if child.type == "dotted_name":
                module_parts.append(_node_text(child, source))
        if module_parts:
            module = ".".join(module_parts)
            analysis.imports.append(module)
            analysis.relationships.append(
                Relationship(
                    source=file_path,
                    target=module,
                    kind=RelationshipKind.IMPORTS,
                    file_path=file_path,
                    line=node.start_point[0] + 1,
                )
            )

    def _handle_class(
        self, node: "Node", source: bytes, file_path: str, analysis: FileAnalysis
    ) -> None:
        name_node = _get_child_by_type(node, "identifier")
        if not name_node:
            return
        class_name = _node_text(name_node, source)

        # Check inheritance
        bases: list[str] = []
        arg_list = _get_child_by_type(node, "argument_list")
        if arg_list:
            for child in arg_list.children:
                if child.type in ("identifier", "attribute"):
                    bases.append(_node_text(child, source))

        symbol = Symbol(
            name=class_name,
            qualified_name=class_name,
            kind=SymbolKind.CLASS,
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            language="python",
            is_test=class_name.startswith("Test") or class_name.endswith("Test"),
        )
        analysis.symbols.append(symbol)

        # Inheritance relationships
        for base in bases:
            analysis.relationships.append(
                Relationship(
                    source=class_name,
                    target=base,
                    kind=RelationshipKind.EXTENDS,
                    file_path=file_path,
                    line=node.start_point[0] + 1,
                )
            )

        # Recurse into class body for methods
        body = _get_child_by_type(node, "block")
        if body:
            self._extract_from_tree(body, source, file_path, analysis, parent_name=class_name)

    def _handle_function(
        self,
        node: "Node",
        source: bytes,
        file_path: str,
        analysis: FileAnalysis,
        parent_name: str | None = None,
    ) -> None:
        name_node = _get_child_by_type(node, "identifier")
        if not name_node:
            return
        func_name = _node_text(name_node, source)
        qualified = f"{parent_name}.{func_name}" if parent_name else func_name
        kind = SymbolKind.METHOD if parent_name else SymbolKind.FUNCTION

        is_test = (
            func_name.startswith("test_")
            or func_name.startswith("test")
            and len(func_name) > 4
        ) and analysis.is_test_file

        symbol = Symbol(
            name=func_name,
            qualified_name=qualified,
            kind=kind,
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            language="python",
            parent=parent_name,
            is_test=is_test,
        )
        analysis.symbols.append(symbol)

        # Relationship: parent CONTAINS this
        if parent_name:
            analysis.relationships.append(
                Relationship(
                    source=parent_name,
                    target=qualified,
                    kind=RelationshipKind.CONTAINS,
                    file_path=file_path,
                )
            )

        # Extract calls from body
        body = _get_child_by_type(node, "block")
        if body:
            self._extract_calls(body, source, file_path, qualified, analysis)

    def _extract_calls(
        self,
        node: "Node",
        source: bytes,
        file_path: str,
        caller: str,
        analysis: FileAnalysis,
    ) -> None:
        """Recursively find call expressions."""
        if node.type == "call":
            func_node = node.children[0] if node.children else None
            if func_node:
                call_text = _node_text(func_node, source)
                analysis.relationships.append(
                    Relationship(
                        source=caller,
                        target=call_text,
                        kind=RelationshipKind.CALLS,
                        file_path=file_path,
                        line=node.start_point[0] + 1,
                    )
                )
        for child in node.children:
            self._extract_calls(child, source, file_path, caller, analysis)

    def _fallback_analyze(
        self, file_path: str, source_code: str, analysis: FileAnalysis
    ) -> FileAnalysis:
        """Regex-based fallback when Tree-sitter is unavailable."""
        import re

        for i, line in enumerate(source_code.splitlines(), 1):
            stripped = line.strip()

            # Classes
            m = re.match(r"^class\s+(\w+)", stripped)
            if m:
                analysis.symbols.append(
                    Symbol(
                        name=m.group(1),
                        qualified_name=m.group(1),
                        kind=SymbolKind.CLASS,
                        file_path=file_path,
                        start_line=i,
                        end_line=i,
                        language="python",
                    )
                )

            # Functions
            m = re.match(r"^(?:async\s+)?def\s+(\w+)", stripped)
            if m:
                analysis.symbols.append(
                    Symbol(
                        name=m.group(1),
                        qualified_name=m.group(1),
                        kind=SymbolKind.FUNCTION,
                        file_path=file_path,
                        start_line=i,
                        end_line=i,
                        language="python",
                    )
                )

            # Imports
            m = re.match(r"^(?:import|from)\s+([\w.]+)", stripped)
            if m:
                analysis.imports.append(m.group(1))

        return analysis
