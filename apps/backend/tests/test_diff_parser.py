"""Tests for the diff parser service."""

import pytest
from app.services.diff_parser import FileDiff, parse_patch, identify_changed_symbols
from models.representation import Symbol, SymbolKind


SAMPLE_PATCH = """@@ -20,7 +20,9 @@ class PaymentService:
 
     def process_payment(self, amount: float, currency: str) -> dict:
-        return self._gateway.charge(amount)
+        if not self._validate_currency(currency):
+            raise ValueError(f"Unsupported currency: {currency}")
+        return self._gateway.charge(amount, currency)
 
     def _validate_currency(self, currency: str) -> bool:"""


def test_parse_patch_basic():
    diff = parse_patch(
        filename="payments/service.py",
        patch=SAMPLE_PATCH,
        status="modified",
        additions=3,
        deletions=1,
    )
    assert diff.filename == "payments/service.py"
    assert diff.status == "modified"
    assert diff.added_lines == 3
    assert diff.removed_lines == 1
    assert len(diff.hunks) == 1
    hunk = diff.hunks[0]
    assert len(hunk.added_lines) > 0
    assert len(hunk.removed_lines) > 0


def test_parse_patch_empty():
    diff = parse_patch("foo.py", None, "added", 0, 0)
    assert len(diff.hunks) == 0
    assert diff.all_changed_lines == set()


def test_parse_patch_changed_line_ranges():
    diff = parse_patch("foo.py", SAMPLE_PATCH, "modified", 3, 1)
    ranges = diff.changed_line_ranges
    assert len(ranges) > 0
    start, end = ranges[0]
    assert start <= end


def test_identify_changed_symbols():
    symbols = [
        Symbol(
            name="process_payment",
            qualified_name="PaymentService.process_payment",
            kind=SymbolKind.METHOD,
            file_path="payments/service.py",
            start_line=21,
            end_line=30,
            language="python",
        ),
        Symbol(
            name="_validate_currency",
            qualified_name="PaymentService._validate_currency",
            kind=SymbolKind.METHOD,
            file_path="payments/service.py",
            start_line=35,
            end_line=40,
            language="python",
        ),
    ]

    diff = parse_patch("payments/service.py", SAMPLE_PATCH, "modified", 3, 1)
    changed = identify_changed_symbols(diff, symbols)

    assert "PaymentService.process_payment" in changed
    # _validate_currency is not in changed range (lines 35-40 not in patch)


def test_identify_changed_symbols_no_overlap():
    symbols = [
        Symbol(
            name="unrelated",
            qualified_name="SomeClass.unrelated",
            kind=SymbolKind.METHOD,
            file_path="other.py",
            start_line=100,
            end_line=120,
            language="python",
        ),
    ]
    diff = parse_patch("other.py", SAMPLE_PATCH, "modified", 3, 1)
    changed = identify_changed_symbols(diff, symbols)
    assert changed == []
