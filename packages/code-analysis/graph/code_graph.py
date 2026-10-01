"""Universal code dependency graph built on NetworkX."""

from dataclasses import dataclass, field
from typing import Any

import networkx as nx

from models.representation import RelationshipKind, RepositoryAnalysis, Symbol


@dataclass
class GraphNode:
    id: str
    kind: str     # "file", "function", "class", "method", "test"
    file_path: str
    language: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    is_test: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


class CodeGraph:
    """
    Language-agnostic dependency graph.
    
    Nodes = files, classes, functions, methods
    Edges = CALLS, IMPORTS, DEPENDS_ON, EXTENDS, IMPLEMENTS, TESTS
    
    Uses NetworkX DiGraph under the hood.
    """

    def __init__(self) -> None:
        self._graph: nx.DiGraph = nx.DiGraph()

    def build_from_analysis(self, repo: RepositoryAnalysis) -> None:
        """Populate the graph from a RepositoryAnalysis."""
        # Add file nodes
        for path, fa in repo.files.items():
            self._graph.add_node(
                path,
                kind="file",
                file_path=path,
                language=fa.language,
                is_test=fa.is_test_file,
            )
            # Add symbol nodes
            for sym in fa.symbols:
                self._graph.add_node(
                    sym.qualified_name,
                    kind=sym.kind.value,
                    file_path=sym.file_path,
                    language=sym.language,
                    start_line=sym.start_line,
                    end_line=sym.end_line,
                    is_test=sym.is_test,
                )
                # File CONTAINS symbol
                self._graph.add_edge(path, sym.qualified_name, kind="CONTAINS")

        # Add relationship edges
        for path, fa in repo.files.items():
            for rel in fa.relationships:
                if not self._graph.has_node(rel.source):
                    self._graph.add_node(rel.source, kind="unknown", file_path=path)
                if not self._graph.has_node(rel.target):
                    self._graph.add_node(rel.target, kind="unknown", file_path=None)

                if not self._graph.has_edge(rel.source, rel.target):
                    self._graph.add_edge(
                        rel.source,
                        rel.target,
                        kind=rel.kind.value,
                        line=rel.line,
                    )

    def get_dependents(self, node_id: str, max_depth: int = 3) -> list[str]:
        """Return nodes that depend on node_id (reverse edges)."""
        if node_id not in self._graph:
            return []
        try:
            # Nodes that have edges pointing TO node_id
            predecessors = set()
            visited = {node_id}
            queue = [node_id]
            depth = 0
            while queue and depth < max_depth:
                next_queue = []
                for node in queue:
                    for pred in self._graph.predecessors(node):
                        if self._graph[pred][node].get("kind") == "CONTAINS":
                            continue
                        if pred not in visited:
                            visited.add(pred)
                            predecessors.add(pred)
                            next_queue.append(pred)
                queue = next_queue
                depth += 1
            return list(predecessors)
        except Exception:
            return []

    def get_dependencies(self, node_id: str, max_depth: int = 3) -> list[str]:
        """Return nodes that node_id depends on (outgoing edges)."""
        if node_id not in self._graph:
            return []
        try:
            successors = set()
            visited = {node_id}
            queue = [node_id]
            depth = 0
            while queue and depth < max_depth:
                next_queue = []
                for node in queue:
                    for succ in self._graph.successors(node):
                        if self._graph[node][succ].get("kind") == "CONTAINS":
                            continue
                        if succ not in visited:
                            visited.add(succ)
                            successors.add(succ)
                            next_queue.append(succ)
                queue = next_queue
                depth += 1
            return list(successors)
        except Exception:
            return []

    def get_callers(self, qualified_name: str) -> list[str]:
        """Return all nodes that call the given symbol."""
        if qualified_name not in self._graph:
            return []
        return [
            pred
            for pred in self._graph.predecessors(qualified_name)
            if self._graph[pred][qualified_name].get("kind") == "CALLS"
        ]

    def get_importers(self, target: str) -> list[str]:
        """Return all files/nodes that import the given target."""
        if target not in self._graph:
            return []
        return [
            pred
            for pred in self._graph.predecessors(target)
            if self._graph[pred][target].get("kind") == "IMPORTS"
        ]

    def get_related_tests(self, node_ids: list[str]) -> list[str]:
        """Return test nodes related to any of the given node_ids."""
        related: set[str] = set()
        for node_id in node_ids:
            for pred in self._graph.predecessors(node_id):
                if self._graph.nodes[pred].get("is_test"):
                    related.add(pred)
            for succ in self._graph.successors(node_id):
                if self._graph.nodes[succ].get("is_test"):
                    related.add(succ)
        return list(related)

    def find_symbol_file(self, qualified_name: str) -> str | None:
        """Return the file containing a symbol."""
        node = self._graph.nodes.get(qualified_name)
        if node:
            return node.get("file_path")
        return None

    def get_node_info(self, node_id: str) -> dict | None:
        return self._graph.nodes.get(node_id)

    def centrality_score(self, node_id: str) -> float:
        """Return in-degree centrality (how many things depend on this node)."""
        try:
            return self._graph.in_degree(node_id)  # type: ignore[return-value]
        except Exception:
            return 0.0

    def to_serializable(self, node_ids: list[str] | None = None) -> dict:
        """Serialize a subgraph (or full graph) to JSON-compatible dict."""
        if node_ids is None:
            subgraph = self._graph
        else:
            # Include neighbors too for context
            all_nodes = set(node_ids)
            for nid in node_ids:
                all_nodes.update(self._graph.predecessors(nid))
                all_nodes.update(self._graph.successors(nid))
            subgraph = self._graph.subgraph(all_nodes)

        nodes = [
            {"id": n, **dict(subgraph.nodes[n])}
            for n in subgraph.nodes
        ]
        edges = [
            {"source": u, "target": v, **dict(d)}
            for u, v, d in subgraph.edges(data=True)
        ]
        return {"nodes": nodes, "edges": edges}

    @property
    def node_count(self) -> int:
        return self._graph.number_of_nodes()

    @property
    def edge_count(self) -> int:
        return self._graph.number_of_edges()
