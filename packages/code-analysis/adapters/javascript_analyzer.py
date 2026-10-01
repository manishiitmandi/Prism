"""JavaScript / TypeScript language analyzer using Tree-sitter."""

import re
from pathlib import Path

try:
    import tree_sitter_javascript as tsjavascript
    import tree_sitter_typescript as tstypescript
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


def _find_children_of_type(node: "Node", type_name: str) -> list["Node"]:
    result = []
    for child in node.children:
        if child.type == type_name:
            result.append(child)
    return result


class JavaScriptAnalyzer(LanguageAnalyzer):
    """Analyzes JavaScript and TypeScript files using Tree-sitter."""

    def __init__(self, typescript: bool = False) -> None:
        self._typescript = typescript
        self._parser: "Parser | None" = None
        if TREESITTER_AVAILABLE:
            try:
                if typescript:
                    lang = Language(tstypescript.language_typescript())
                else:
                    lang = Language(tsjavascript.language())
                self._parser = Parser(lang)
            except Exception:
                self._parser = None

    @property
    def language(self) -> str:
        return "typescript" if self._typescript else "javascript"

    @property
    def file_extensions(self) -> list[str]:
        if self._typescript:
            return [".ts", ".tsx"]
        return [".js", ".jsx", ".mjs", ".cjs"]

    def is_test_file(self, file_path: str) -> bool:
        p = Path(file_path)
        name = p.name.lower()
        parts = [part.lower() for part in p.parts]
        return (
            "test" in parts
            or "tests" in parts
            or "__tests__" in parts
            or ".test." in name
            or ".spec." in name
        )

    def analyze_file(self, file_path: str, source_code: str) -> FileAnalysis:
        analysis = FileAnalysis(
            path=file_path,
            language=self.language,
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

    def _walk(
        self,
        node: "Node",
        source: bytes,
        file_path: str,
        analysis: FileAnalysis,
        parent: str | None = None,
    ) -> None:
        if node.type in ("import_statement", "import_declaration"):
            self._handle_import(node, source, file_path, analysis)

        elif node.type == "export_statement":
            # Unwrap exported declarations
            for child in node.children:
                self._walk(child, source, file_path, analysis, parent)

        elif node.type in ("class_declaration", "class"):
            self._handle_class(node, source, file_path, analysis)

        elif node.type in (
            "function_declaration",
            "function",
            "arrow_function",
            "method_definition",
        ):
            self._handle_function(node, source, file_path, analysis, parent)

        elif node.type == "lexical_declaration":
            # const Foo = () => {}  or  const Foo = function() {}
            for child in node.children:
                if child.type == "variable_declarator":
                    self._handle_variable_declarator(child, source, file_path, analysis)
        else:
            for child in node.children:
                self._walk(child, source, file_path, analysis, parent)

    def _handle_import(
        self, node: "Node", source: bytes, file_path: str, analysis: FileAnalysis
    ) -> None:
        for child in node.children:
            if child.type == "string":
                raw = _node_text(child, source).strip("\"'`")
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

    def _handle_class(
        self, node: "Node", source: bytes, file_path: str, analysis: FileAnalysis
    ) -> None:
        name = None
        for child in node.children:
            if child.type == "type_identifier" or (child.type == "identifier"):
                name = _node_text(child, source)
                break
        if not name:
            return

        symbol = Symbol(
            name=name,
            qualified_name=name,
            kind=SymbolKind.CLASS,
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            language=self.language,
        )
        analysis.symbols.append(symbol)

        # Walk class body
        for child in node.children:
            if child.type == "class_body":
                for method in child.children:
                    if method.type == "method_definition":
                        self._handle_function(method, source, file_path, analysis, name)

    def _handle_function(
        self,
        node: "Node",
        source: bytes,
        file_path: str,
        analysis: FileAnalysis,
        parent: str | None = None,
    ) -> None:
        name = None
        for child in node.children:
            if child.type in ("identifier", "property_identifier"):
                name = _node_text(child, source)
                break

        if not name:
            return

        qualified = f"{parent}.{name}" if parent else name
        kind = SymbolKind.METHOD if parent else SymbolKind.FUNCTION
        is_test = (
            name.startswith("it") or name.startswith("test") or name == "describe"
        ) and analysis.is_test_file

        symbol = Symbol(
            name=name,
            qualified_name=qualified,
            kind=kind,
            file_path=file_path,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            language=self.language,
            parent=parent,
            is_test=is_test,
        )
        analysis.symbols.append(symbol)

        if parent:
            analysis.relationships.append(
                Relationship(
                    source=parent,
                    target=qualified,
                    kind=RelationshipKind.CONTAINS,
                    file_path=file_path,
                )
            )

    def _handle_variable_declarator(
        self, node: "Node", source: bytes, file_path: str, analysis: FileAnalysis
    ) -> None:
        name = None
        value_node = None
        for child in node.children:
            if child.type == "identifier" and name is None:
                name = _node_text(child, source)
            elif child.type in ("arrow_function", "function"):
                value_node = child
        if name and value_node:
            self._handle_function(value_node, source, file_path, analysis, None)
            # Patch name since arrow functions don't have identifiers in tree
            if analysis.symbols:
                s = analysis.symbols[-1]
                if s.name != name:
                    analysis.symbols[-1] = Symbol(
                        name=name,
                        qualified_name=name,
                        kind=SymbolKind.FUNCTION,
                        file_path=file_path,
                        start_line=s.start_line,
                        end_line=s.end_line,
                        language=self.language,
                    )

    def _fallback_analyze(
        self, file_path: str, source_code: str, analysis: FileAnalysis
    ) -> FileAnalysis:
        for i, line in enumerate(source_code.splitlines(), 1):
            stripped = line.strip()

            m = re.match(r"(?:export\s+)?(?:default\s+)?class\s+(\w+)", stripped)
            if m:
                analysis.symbols.append(
                    Symbol(
                        name=m.group(1),
                        qualified_name=m.group(1),
                        kind=SymbolKind.CLASS,
                        file_path=file_path,
                        start_line=i,
                        end_line=i,
                        language=self.language,
                    )
                )

            m = re.match(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)", stripped)
            if m:
                analysis.symbols.append(
                    Symbol(
                        name=m.group(1),
                        qualified_name=m.group(1),
                        kind=SymbolKind.FUNCTION,
                        file_path=file_path,
                        start_line=i,
                        end_line=i,
                        language=self.language,
                    )
                )

            m = re.match(r"^import\s+.*?from\s+['\"](.+?)['\"]", stripped)
            if m:
                analysis.imports.append(m.group(1))

        return analysis


class TypeScriptAnalyzer(JavaScriptAnalyzer):
    """TypeScript analyzer — extends JS analyzer with TypeScript grammar."""

    def __init__(self) -> None:
        super().__init__(typescript=True)

    @property
    def language(self) -> str:
        return "typescript"

    @property
    def file_extensions(self) -> list[str]:
        return [".ts", ".tsx"]
