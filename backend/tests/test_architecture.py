"""Architecture conformance checks (C03, ADR-005) — static, no database.

Rule: the Web Push vendor API (`pywebpush`) may be used only by the push
integration module, `push_delivery.py`. Everything else — in particular
`notifications.notify()`, which runs inside business transactions that hold
reservation row locks — reaches Web Push only through the outbox table."""

import ast
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src" / "reservations"
VENDOR_MODULE = "pywebpush"
ALLOWED = {SRC / "push_delivery.py"}


def _imported_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    modules = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.add(node.module)
    return modules


def test_only_the_push_integration_imports_the_push_vendor_sdk() -> None:
    offenders = sorted(
        str(path.relative_to(SRC))
        for path in SRC.rglob("*.py")
        if path not in ALLOWED
        and any(
            m == VENDOR_MODULE or m.startswith(VENDOR_MODULE + ".")
            for m in _imported_modules(path)
        )
    )
    assert offenders == [], (
        f"{VENDOR_MODULE} imported outside push_delivery.py: {offenders} — "
        "queue a PushDelivery via notifications.notify() instead (ADR-005)"
    )


def test_the_rule_actually_sees_the_allowed_module() -> None:
    # Guards against the check silently passing because of a wrong path.
    assert VENDOR_MODULE in _imported_modules(SRC / "push_delivery.py")
