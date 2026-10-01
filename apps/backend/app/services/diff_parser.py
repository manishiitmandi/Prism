"""Diff parser — extracts changed lines and symbols from PR diffs."""

import re
from dataclasses import dataclass, field


@dataclass
class HunkRange:
    start_line: int
    line_count: int


@dataclass
class DiffHunk:
    old_range: HunkRange
    new_range: HunkRange
    added_lines: list[int] = field(default_factory=list)
    removed_lines: list[int] = field(default_factory=list)
    context: list[str] = field(default_factory=list)


@dataclass
class FileDiff:
    filename: str
    status: str  # added, modified, removed, renamed
    old_filename: str | None  # for renames
    added_lines: int
    removed_lines: int
    hunks: list[DiffHunk] = field(default_factory=list)

    @property
    def changed_line_ranges(self) -> list[tuple[int, int]]:
        """Return (start, end) line ranges of added lines."""
        ranges: list[tuple[int, int]] = []
        for hunk in self.hunks:
            if hunk.added_lines:
                ranges.append((min(hunk.added_lines), max(hunk.added_lines)))
        return ranges

    @property
    def all_changed_lines(self) -> set[int]:
        """All added/changed line numbers."""
        lines: set[int] = set()
        for hunk in self.hunks:
            lines.update(hunk.added_lines)
        return lines


def parse_patch(
    filename: str,
    patch: str | None,
    status: str,
    additions: int,
    deletions: int,
) -> FileDiff:
    """Parse a GitHub unified diff patch into a structured FileDiff."""
    diff = FileDiff(
        filename=filename,
        status=status,
        old_filename=None,
        added_lines=additions,
        removed_lines=deletions,
    )

    if not patch:
        return diff

    current_hunk: DiffHunk | None = None
    new_line = 0

    for line in patch.splitlines():
        hunk_match = re.match(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,(\d+))? @@", line)
        if hunk_match:
            new_start = int(hunk_match.group(2))
            new_count = int(hunk_match.group(3) or "1")
            old_start = int(hunk_match.group(1))
            current_hunk = DiffHunk(
                old_range=HunkRange(old_start, 0),
                new_range=HunkRange(new_start, new_count),
            )
            diff.hunks.append(current_hunk)
            new_line = new_start
            continue

        if current_hunk is None:
            continue

        if line.startswith("+") and not line.startswith("+++"):
            current_hunk.added_lines.append(new_line)
            new_line += 1
        elif line.startswith("-") and not line.startswith("---"):
            current_hunk.removed_lines.append(new_line)
        else:
            # Context line
            new_line += 1

    return diff


def identify_changed_symbols(
    file_diff: FileDiff,
    file_analysis_symbols: list,  # list of Symbol objects
) -> list[str]:
    """
    Given a FileDiff and list of Symbol objects from the analyzer,
    return qualified names of symbols whose line ranges overlap with changes.
    """
    changed_lines = file_diff.all_changed_lines
    if not changed_lines:
        return []

    changed: list[str] = []
    for symbol in file_analysis_symbols:
        symbol_lines = set(range(symbol.start_line, symbol.end_line + 1))
        if symbol_lines & changed_lines:
            changed.append(symbol.qualified_name)

    return changed
