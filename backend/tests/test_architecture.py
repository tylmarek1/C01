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


# --------------------------------------------------------------------------- Payment gateway
#
# Rule (ADR-010): only payments.py talks to the payment gateway, so a vendor
# call can't end up in a route or inside a reservation's transaction.

GATEWAY_MODULE = "reservations.payment_gateway"
GATEWAY_ALLOWED = {SRC / "payments.py", SRC / "payment_gateway.py"}


def test_only_the_payments_module_uses_the_payment_gateway() -> None:
    offenders = sorted(
        str(path.relative_to(SRC))
        for path in SRC.rglob("*.py")
        if path not in GATEWAY_ALLOWED and GATEWAY_MODULE in _imported_modules(path)
    )
    assert offenders == [], (
        f"payment_gateway imported outside payments.py: {offenders} (ADR-010)"
    )


def test_the_gateway_rule_actually_sees_the_allowed_module() -> None:
    assert GATEWAY_MODULE in _imported_modules(SRC / "payments.py")


# --------------------------------------------------------------------------- Lifecycle ownership
#
# Rule (C03 G3, backend/CLAUDE.md): only `lifecycle.transition()` changes a
# reservation's status. A new reservation is born as a PENDING hold and
# reaches every later state through the Lifecycle, whose guards (BR-06,
# BR-11, BR-12) no route can then skip. The waitlist-accept path once built
# rows directly in CONFIRMED / PENDING_APPROVAL; this keeps that closed.

LIFECYCLE = SRC / "lifecycle.py"
# Demo data, not a request path: it writes finished history (COMPLETED visits).
SEED = SRC / "seed.py"


def _is_reservation_status(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id == "ReservationStatus"
    )


def _lifecycle_violations(path: Path, root: Path = SRC) -> list[str]:
    tree = ast.parse(path.read_text(), filename=str(path))
    found = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "Reservation"
        ):
            for kw in node.keywords:
                if kw.arg == "status" and not (
                    _is_reservation_status(kw.value) and kw.value.attr == "PENDING"
                ):
                    found.append(
                        f"{path.relative_to(root)}:{node.lineno} Reservation(status=...) not PENDING"
                    )
        elif isinstance(node, ast.Assign) and _is_reservation_status(node.value):
            for target in node.targets:
                if isinstance(target, ast.Attribute) and target.attr == "status":
                    found.append(
                        f"{path.relative_to(root)}:{node.lineno} .status = ReservationStatus.*"
                    )
    return found


def test_only_the_lifecycle_changes_reservation_status() -> None:
    offenders = [
        violation
        for path in sorted(SRC.rglob("*.py"))
        if path not in (LIFECYCLE, SEED)
        for violation in _lifecycle_violations(path)
    ]
    assert offenders == [], (
        f"reservation status set outside lifecycle.transition(): {offenders} — "
        "create the row as PENDING and call transition() instead"
    )


def test_the_lifecycle_rule_actually_detects_a_bypass(tmp_path: Path) -> None:
    # Guards against the check silently passing because the pattern drifted.
    bad = tmp_path / "bad.py"
    bad.write_text(
        "r = Reservation(status=ReservationStatus.CONFIRMED)\n"
        "r.status = ReservationStatus.CANCELLED\n"
        "ok = Reservation(status=ReservationStatus.PENDING)\n"
    )
    assert len(_lifecycle_violations(bad, root=tmp_path)) == 2
