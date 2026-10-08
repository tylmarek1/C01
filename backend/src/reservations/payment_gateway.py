"""The payment gateway boundary (ADR-010).

No real provider is integrated yet: `MockGateway` approves every charge
(unless asked to decline one) and every refund, without any network I/O.
A real provider (Stripe, GoPay, ...) would implement the same two calls.
Only `payments.py` may import this module — `tests/test_architecture.py`
enforces it — so the vendor never leaks into a route or a business
transaction, the same rule ADR-005 set for Web Push."""

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


@dataclass(frozen=True)
class ChargeResult:
    ok: bool
    provider_ref: str | None = None
    error: str | None = None


@dataclass(frozen=True)
class RefundResult:
    ok: bool
    error: str | None = None


class PaymentGateway(Protocol):
    name: str

    def charge(
        self,
        payment_id: uuid.UUID,
        amount: Decimal,
        currency: str,
        *,
        decline: bool = False,
    ) -> ChargeResult: ...

    def refund(
        self, provider_ref: str, amount: Decimal, currency: str
    ) -> RefundResult: ...


class MockGateway:
    """Stands in for a provider until one is chosen. `decline=True` lets a
    client (and the tests) exercise the failure path on purpose."""

    name = "mock"

    def charge(
        self,
        payment_id: uuid.UUID,
        amount: Decimal,
        currency: str,
        *,
        decline: bool = False,
    ) -> ChargeResult:
        if decline:
            return ChargeResult(ok=False, error="Card declined (simulated)")
        return ChargeResult(ok=True, provider_ref=f"mock_{payment_id.hex}")

    def refund(self, provider_ref: str, amount: Decimal, currency: str) -> RefundResult:
        return RefundResult(ok=True)


_gateway: PaymentGateway = MockGateway()


def get_gateway() -> PaymentGateway:
    return _gateway


def set_gateway(gateway: PaymentGateway) -> None:
    """For tests: swap in a gateway that fails or records calls."""
    global _gateway
    _gateway = gateway
