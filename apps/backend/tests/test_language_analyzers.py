"""Tests for language analyzers."""

import sys
from pathlib import Path

import pytest

# Add packages to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "packages" / "code-analysis"))

from adapters.python_analyzer import PythonAnalyzer
from adapters.javascript_analyzer import JavaScriptAnalyzer, TypeScriptAnalyzer
from adapters.registry import LanguageRegistry
from models.representation import SymbolKind


PYTHON_CODE = '''
import os
from pathlib import Path
from payments.service import PaymentService


class OrderService:
    """Manages order processing."""

    def __init__(self, payment_service: PaymentService):
        self._payments = payment_service

    def create_order(self, items: list, currency: str) -> dict:
        """Create a new order."""
        total = sum(item["price"] for item in items)
        result = self._payments.process_payment(total, currency)
        return {"order_id": 1, "status": "created", "payment": result}

    def cancel_order(self, order_id: int) -> bool:
        return True


def standalone_function(x: int) -> int:
    return x * 2
'''

JAVASCRIPT_CODE = '''
import { PaymentService } from './payment-service';

export class OrderService {
  constructor(private payments: PaymentService) {}

  async createOrder(items, currency) {
    const total = items.reduce((s, i) => s + i.price, 0);
    return this.payments.processPayment(total, currency);
  }
}

export function standaloneHelper(x) {
  return x * 2;
}
'''


class TestPythonAnalyzer:
    def setup_method(self):
        self.analyzer = PythonAnalyzer()

    def test_detects_classes(self):
        fa = self.analyzer.analyze_file("orders/service.py", PYTHON_CODE)
        class_names = [s.qualified_name for s in fa.symbols if s.kind == SymbolKind.CLASS]
        assert "OrderService" in class_names

    def test_detects_methods(self):
        fa = self.analyzer.analyze_file("orders/service.py", PYTHON_CODE)
        method_names = [s.qualified_name for s in fa.symbols]
        assert "OrderService.create_order" in method_names or "create_order" in method_names

    def test_detects_imports(self):
        fa = self.analyzer.analyze_file("orders/service.py", PYTHON_CODE)
        assert len(fa.imports) > 0
        import_targets = [r.target for r in fa.relationships]
        assert any("payments" in t or "pathlib" in t or "os" in t for t in import_targets)

    def test_identifies_test_files(self):
        assert self.analyzer.is_test_file("tests/test_orders.py")
        assert self.analyzer.is_test_file("test_orders.py")
        assert not self.analyzer.is_test_file("orders/service.py")

    def test_empty_file(self):
        fa = self.analyzer.analyze_file("empty.py", "")
        assert fa.symbols == []
        assert fa.parse_error is None

    def test_standalone_function(self):
        fa = self.analyzer.analyze_file("utils.py", PYTHON_CODE)
        func_names = [s.name for s in fa.symbols if s.kind == SymbolKind.FUNCTION]
        assert "standalone_function" in func_names


class TestJavaScriptAnalyzer:
    def setup_method(self):
        self.analyzer = JavaScriptAnalyzer()

    def test_detects_classes(self):
        fa = self.analyzer.analyze_file("orders/service.js", JAVASCRIPT_CODE)
        class_names = [s.name for s in fa.symbols if s.kind == SymbolKind.CLASS]
        assert "OrderService" in class_names

    def test_detects_imports(self):
        fa = self.analyzer.analyze_file("orders/service.js", JAVASCRIPT_CODE)
        assert len(fa.imports) > 0

    def test_identifies_test_files(self):
        assert self.analyzer.is_test_file("orders.test.js")
        assert self.analyzer.is_test_file("orders.spec.js")
        assert not self.analyzer.is_test_file("orders/service.js")


class TestLanguageRegistry:
    def setup_method(self):
        self.registry = LanguageRegistry()

    def test_detects_python(self):
        assert self.registry.detect_language("foo.py") == "python"

    def test_detects_javascript(self):
        assert self.registry.detect_language("foo.js") == "javascript"

    def test_detects_typescript(self):
        assert self.registry.detect_language("foo.ts") == "typescript"

    def test_detects_go(self):
        assert self.registry.detect_language("foo.go") == "go"

    def test_returns_none_for_unknown(self):
        assert self.registry.detect_language("foo.xyz") is None

    def test_analyze_python_file(self):
        fa = self.registry.analyze_file("service.py", PYTHON_CODE)
        assert fa is not None
        assert fa.language == "python"

    def test_returns_none_for_unsupported(self):
        fa = self.registry.analyze_file("image.png", "binary data")
        assert fa is None
