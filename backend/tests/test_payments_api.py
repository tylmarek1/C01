"""ADR-010: paying for a reservation through the (mock) gateway, refunds
when a reservation is released, and cash at the desk."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import sessionmaker
from support import make_venue, make_venue_manager
from test_spec_baseline import (
    add_reservation,
    at,
    bearer,
    cancel,
    confirm,
    create,
    hold_in_future,
    make_court,
    make_user,
)

from reservations import payment_gateway, payments
from reservations.lifecycle import transition
from reservations.main import app
from reservations.models import (
    AuditLog,
    Court,
    Payment,
    PaymentStatus,
    Reservation,
    ReservationStatus,
    User,
    UserRole,
)
from reservations.payment_gateway import ChargeResult, MockGateway, RefundResult


@pytest.fixture(autouse=True)
def _mock_gateway():
    payment_gateway.set_gateway(MockGateway())
    yield
    payment_gateway.set_gateway(MockGateway())


def priced_court(
    session_factory: sessionmaker, price: float | None = 400, name: str = "Paid Court"
) -> uuid.UUID:
    court_id = make_court(session_factory, name=name)
    with session_factory() as session:
        session.get(Court, court_id).price_per_hour = price
        session.commit()
    return court_id


def booked(client: TestClient, token: str, court_id: uuid.UUID) -> dict:
    reservation = create(client, token, court_id, at(18), at(19)).json()
    assert confirm(client, token, reservation["id"]).status_code == 200
    return reservation


def pay(client: TestClient, token: str, reservation_id, decline: bool = False):
    return client.post(
        f"/reservations/{reservation_id}/payments",
        json={"decline": decline},
        headers=bearer(token),
    )


def payment_statuses(
    session_factory: sessionmaker, reservation_id
) -> list[PaymentStatus]:
    with session_factory() as session:
        stmt = (
            select(Payment.status)
            .where(Payment.reservation_id == reservation_id)
            .order_by(Payment.created_at)
        )
        return list(session.scalars(stmt))


def run_refunds(session_factory: sessionmaker) -> None:
    with session_factory() as session:
        payments.process_refunds(session)
        session.commit()


# ----------------------------------------------------------------- online


def test_the_booker_pays_the_quoted_price(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    reservation = booked(client, token, priced_court(session_factory))

    response = pay(client, token, reservation["id"])

    assert response.status_code == 201
    body = response.json()
    assert (body["status"], body["amount"], body["currency"], body["method"]) == (
        "PAID",
        400.0,
        "CZK",
        "ONLINE",
    )
    assert body["provider"] == "mock" and body["paid_at"] is not None
    # Paying doesn't touch the reservation's state (ADR-010).
    with session_factory() as session:
        assert (
            session.get(Reservation, uuid.UUID(reservation["id"])).status
            == ReservationStatus.CONFIRMED
        )


def test_a_reservation_is_paid_only_once(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    reservation = booked(client, token, priced_court(session_factory))
    pay(client, token, reservation["id"])

    assert pay(client, token, reservation["id"]).status_code == 409


def test_a_declined_charge_is_402_and_can_be_retried(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    reservation = booked(client, token, priced_court(session_factory))

    declined = pay(client, token, reservation["id"], decline=True)
    retried = pay(client, token, reservation["id"])

    assert declined.status_code == 402
    assert declined.json() == {"detail": "Card declined (simulated)"}
    assert retried.status_code == 201
    assert payment_statuses(session_factory, reservation["id"]) == [
        PaymentStatus.FAILED,
        PaymentStatus.PAID,
    ]


def test_only_the_booker_pays_online(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    _, owner = make_user(session_factory, "player@example.com")
    _, stranger = make_user(session_factory, "stranger@example.com")
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    reservation = booked(client, owner, priced_court(session_factory))

    assert pay(client, stranger, reservation["id"]).status_code == 403
    assert pay(client, manager, reservation["id"]).status_code == 403


def test_an_unpriced_or_released_reservation_cannot_be_paid(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    unpriced = booked(
        client, token, priced_court(session_factory, price=None, name="Free Court")
    )
    cancelled = create(
        client, token, priced_court(session_factory), at(10), at(11)
    ).json()
    cancel(client, token, cancelled["id"])

    assert pay(client, token, unpriced["id"]).status_code == 409
    assert pay(client, token, cancelled["id"]).status_code == 409


# ---------------------------------------------------------------- refunds


def test_cancelling_a_paid_reservation_queues_a_refund_the_worker_makes(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    reservation = booked(client, token, priced_court(session_factory))
    pay(client, token, reservation["id"])

    assert cancel(client, token, reservation["id"]).status_code == 200
    assert payment_statuses(session_factory, reservation["id"]) == [
        PaymentStatus.REFUND_PENDING
    ]

    run_refunds(session_factory)

    listed = client.get(
        f"/reservations/{reservation['id']}/payments", headers=bearer(token)
    ).json()
    assert listed[0]["status"] == "REFUNDED" and listed[0]["refunded_at"] is not None


def test_an_expired_paid_hold_is_refunded_and_a_no_show_is_not(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    user_id, token = make_user(session_factory, "player@example.com")
    court_id = priced_court(session_factory)
    hold = create(client, token, court_id, at(10), at(11)).json()
    played = booked(client, token, court_id)
    pay(client, token, hold["id"])
    pay(client, token, played["id"])

    with session_factory() as session:
        for reservation_id, status in (
            (hold["id"], ReservationStatus.EXPIRED),
            (played["id"], ReservationStatus.NO_SHOW),
        ):
            reservation = session.get(
                Reservation, uuid.UUID(reservation_id), with_for_update=True
            )
            transition(session, reservation, status)
        session.commit()

    assert payment_statuses(session_factory, hold["id"]) == [
        PaymentStatus.REFUND_PENDING
    ]
    assert payment_statuses(session_factory, played["id"]) == [PaymentStatus.PAID]


def test_a_cancel_during_the_charge_refunds_the_money_taken(
    session_factory: sessionmaker,
) -> None:
    """The gateway call runs with no transaction open; a Cancel that lands
    meanwhile must not leave a PAID payment on a CANCELLED reservation."""
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    reservation = booked(client, token, priced_court(session_factory))

    class CancelsMidCharge(MockGateway):
        def charge(
            self, payment_id, amount, currency, *, decline=False
        ) -> ChargeResult:
            assert cancel(client, token, reservation["id"]).status_code == 200
            return super().charge(payment_id, amount, currency, decline=decline)

    payment_gateway.set_gateway(CancelsMidCharge())
    response = pay(client, token, reservation["id"])

    assert response.status_code == 201
    assert response.json()["status"] == "REFUND_PENDING"


def test_a_refund_the_gateway_keeps_refusing_ends_as_refund_failed(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    reservation = booked(client, token, priced_court(session_factory))
    pay(client, token, reservation["id"])
    cancel(client, token, reservation["id"])

    class RefusesRefunds(MockGateway):
        def refund(
            self, provider_ref: str, amount: Decimal, currency: str
        ) -> RefundResult:
            return RefundResult(ok=False, error="Provider unavailable")

    payment_gateway.set_gateway(RefusesRefunds())
    for _ in range(payments.REFUND_MAX_ATTEMPTS - 1):
        run_refunds(session_factory)
    assert payment_statuses(session_factory, reservation["id"]) == [
        PaymentStatus.REFUND_PENDING
    ]

    run_refunds(session_factory)

    with session_factory() as session:
        payment = session.scalar(
            select(Payment).where(Payment.reservation_id == reservation["id"])
        )
        assert payment.status == PaymentStatus.REFUND_FAILED
        assert payment.refund_attempts == payments.REFUND_MAX_ATTEMPTS
        assert payment.failure_reason == "Provider unavailable"


def test_an_abandoned_pending_payment_is_given_up(
    session_factory: sessionmaker,
) -> None:
    user_id, _ = make_user(session_factory, "player@example.com")
    court_id = priced_court(session_factory)
    reservation_id = add_reservation(
        session_factory,
        court_id,
        user_id,
        at(18),
        at(19),
        ReservationStatus.PENDING,
        hold_in_future(),
    )
    with session_factory() as session:
        payment = Payment(
            reservation_id=reservation_id, user_id=user_id, amount=400, method="ONLINE"
        )
        session.add(payment)
        session.commit()
        session.execute(
            update(Payment)
            .where(Payment.id == payment.id)
            .values(
                created_at=datetime.now(timezone.utc)
                - payments.ABANDONED_AFTER
                - timedelta(minutes=1)
            )
        )
        session.commit()

    run_refunds(session_factory)

    assert payment_statuses(session_factory, reservation_id) == [PaymentStatus.FAILED]


# ------------------------------------------------------------------- cash


def test_a_manager_of_the_venue_records_cash_and_it_is_not_refunded_online(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, player = make_user(session_factory, "player@example.com")
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    outsider_id, outsider = make_user(session_factory, "outsider@example.com")
    with session_factory() as session:
        make_venue_manager(
            session, session.get(User, outsider_id), make_venue(session, "Elsewhere")
        )
        session.commit()
    reservation = booked(client, player, priced_court(session_factory))
    url = f"/reservations/{reservation['id']}/payments/cash"

    assert client.post(url, headers=bearer(outsider)).status_code == 403
    recorded = client.post(url, headers=bearer(manager))
    assert recorded.status_code == 201
    assert (recorded.json()["method"], recorded.json()["status"]) == ("CASH", "PAID")

    cancel(client, player, reservation["id"])
    run_refunds(session_factory)
    assert payment_statuses(session_factory, reservation["id"]) == [PaymentStatus.PAID]


def test_payments_are_listed_to_the_booker_and_the_venues_managers_only(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, player = make_user(session_factory, "player@example.com")
    _, stranger = make_user(session_factory, "stranger@example.com")
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    reservation = booked(client, player, priced_court(session_factory))
    pay(client, player, reservation["id"])
    url = f"/reservations/{reservation['id']}/payments"

    assert len(client.get(url, headers=bearer(player)).json()) == 1
    assert len(client.get(url, headers=bearer(manager)).json()) == 1
    assert client.get(url, headers=bearer(stranger)).status_code == 403


def test_payment_changes_are_audited(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    reservation = booked(client, token, priced_court(session_factory))
    payment_id = pay(client, token, reservation["id"]).json()["id"]

    with session_factory() as session:
        rows = session.scalars(
            select(AuditLog)
            .where(AuditLog.entity_id == uuid.UUID(payment_id))
            .order_by(AuditLog.created_at)
        ).all()
    assert [row.action for row in rows] == ["CREATE", "UPDATE"]
    assert rows[1].changes["status"] == ["PENDING", "PAID"]
