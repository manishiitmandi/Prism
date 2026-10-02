"""Semantic code chunker based on Tree-sitter AST symbols and structure."""

import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from models.representation import FileAnalysis, SymbolKind


@dataclass
class CodeChunk:
    """A semantic code chunk with AST metadata."""

    chunk_id: str
    file_path: str
    language: str
    symbol_name: str
    symbol_type: str
    start_line: int
    end_line: int
    content: str
    parent_symbol: str | None = None
    is_test: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "file_path": self.file_path,
            "language": self.language,
            "symbol_name": self.symbol_name,
            "symbol_type": self.symbol_type,
            "parent_symbol": self.parent_symbol,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "content": self.content,
            "is_test": self.is_test,
            "metadata": self.metadata,
        }


class SemanticCodeChunker:
    """
    Chunks code semantically using AST representation.
    Extracts functions, methods, classes, and module-level blocks.
    Splits oversized symbols while preserving structural metadata.
    """

    def __init__(self, max_chunk_lines: int = 80, chunk_overlap_lines: int = 15) -> None:
        self.max_chunk_lines = max_chunk_lines
        self.chunk_overlap_lines = chunk_overlap_lines

    def chunk_file(
        self,
        file_path: str,
        content: str,
        file_analysis: FileAnalysis | None = None,
    ) -> list[CodeChunk]:
        """
        Produce semantic chunks for a single file.
        """
        if not content or not content.strip():
            return []

        lines = content.splitlines()
        total_lines = len(lines)
        chunks: list[CodeChunk] = []

        if file_analysis and file_analysis.symbols:
            covered_lines: set[int] = set()

            sorted_symbols = sorted(
                file_analysis.symbols,
                key=lambda s: (
                    s.start_line,
                    0 if s.kind in (SymbolKind.FUNCTION, SymbolKind.METHOD) else 1,
                ),
            )

            for sym in sorted_symbols:
                s_start = max(1, sym.start_line)
                s_end = min(total_lines, sym.end_line)
                if s_start > s_end:
                    continue

                symbol_lines = lines[s_start - 1 : s_end]
                sym_line_count = len(symbol_lines)
                is_test = sym.is_test or file_analysis.is_test_file

                if sym_line_count <= self.max_chunk_lines:
                    chunk_text = "\n".join(symbol_lines)
                    chunks.append(
                        CodeChunk(
                            chunk_id=str(uuid.uuid4()),
                            file_path=file_path,
                            language=sym.language or file_analysis.language,
                            symbol_name=sym.qualified_name or sym.name,
                            symbol_type=sym.kind.value,
                            parent_symbol=sym.parent,
                            start_line=s_start,
                            end_line=s_end,
                            content=chunk_text,
                            is_test=is_test,
                            metadata={
                                "symbol_kind": sym.kind.value,
                                "is_public": sym.is_public,
                                **sym.metadata,
                            },
                        )
                    )
                    covered_lines.update(range(s_start, s_end + 1))
                else:
                    # Oversized symbol: split into overlapping chunks while preserving metadata
                    step = max(1, self.max_chunk_lines - self.chunk_overlap_lines)
                    part = 1
                    total_parts = max(1, (sym_line_count + step - 1) // step)
                    for offset in range(0, sym_line_count, step):
                        sub_slice = symbol_lines[offset : offset + self.max_chunk_lines]
                        if not sub_slice:
                            break
                        sub_start = s_start + offset
                        sub_end = sub_start + len(sub_slice) - 1
                        chunk_text = "\n".join(sub_slice)
                        chunks.append(
                            CodeChunk(
                                chunk_id=str(uuid.uuid4()),
                                file_path=file_path,
                                language=sym.language or file_analysis.language,
                                symbol_name=f"{sym.qualified_name or sym.name} (part {part}/{total_parts})",
                                symbol_type=sym.kind.value,
                                parent_symbol=sym.parent or sym.name,
                                start_line=sub_start,
                                end_line=sub_end,
                                content=chunk_text,
                                is_test=is_test,
                                metadata={
                                    "symbol_kind": sym.kind.value,
                                    "is_public": sym.is_public,
                                    "part": part,
                                    "total_parts": total_parts,
                                    "original_symbol": sym.qualified_name or sym.name,
                                    **sym.metadata,
                                },
                            )
                        )
                        part += 1
                    covered_lines.update(range(s_start, s_end + 1))

            # Capture remaining top-level blocks
            uncovered_ranges = self._find_uncovered_ranges(total_lines, covered_lines)
            for u_start, u_end in uncovered_ranges:
                if u_end - u_start + 1 >= 3:
                    sub_lines = lines[u_start - 1 : u_end]
                    chunk_text = "\n".join(sub_lines).strip()
                    if chunk_text:
                        chunks.append(
                            CodeChunk(
                                chunk_id=str(uuid.uuid4()),
                                file_path=file_path,
                                language=file_analysis.language,
                                symbol_name=f"{Path(file_path).name}:L{u_start}-L{u_end}",
                                symbol_type="module_block",
                                parent_symbol=None,
                                start_line=u_start,
                                end_line=u_end,
                                content=chunk_text,
                                is_test=file_analysis.is_test_file,
                                metadata={"is_module_level": True},
                            )
                        )
        else:
            lang = file_analysis.language if file_analysis else Path(file_path).suffix.lstrip(".")
            is_test = file_analysis.is_test_file if file_analysis else "test" in file_path.lower()
            step = max(1, self.max_chunk_lines - self.chunk_overlap_lines)
            for offset in range(0, total_lines, step):
                sub_slice = lines[offset : offset + self.max_chunk_lines]
                if not sub_slice:
                    break
                sub_start = offset + 1
                sub_end = offset + len(sub_slice)
                chunk_text = "\n".join(sub_slice).strip()
                if chunk_text:
                    chunks.append(
                        CodeChunk(
                            chunk_id=str(uuid.uuid4()),
                            file_path=file_path,
                            language=lang,
                            symbol_name=f"{Path(file_path).name}:L{sub_start}-L{sub_end}",
                            symbol_type="file_block",
                            parent_symbol=None,
                            start_line=sub_start,
                            end_line=sub_end,
                            content=chunk_text,
                            is_test=is_test,
                            metadata={"window_offset": offset},
                        )
                    )

        return chunks

    def _find_uncovered_ranges(self, total_lines: int, covered: set[int]) -> list[tuple[int, int]]:
        ranges: list[tuple[int, int]] = []
        in_range = False
        start = 0
        for line in range(1, total_lines + 1):
            if line not in covered:
                if not in_range:
                    in_range = True
                    start = line
            else:
                if in_range:
                    ranges.append((start, line - 1))
                    in_range = False
        if in_range:
            ranges.append((start, total_lines))
        return ranges
