from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from pywebpush import WebPushException
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from reservations import push_delivery
from reservations.main import app
from reservations.models import (
    Court,
    NotificationType,
    PushDelivery,
    PushDeliveryStatus,
    PushSubscription,
    Reservation,
    ReservationStatus,
    SportType,
    User,
)
from reservations.notifications import notify

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0) -> str:
    day = (datetime.now(PRAGUE) + timedelta(days=3)).date()
    return datetime(
        day.year, day.month, day.day, hour, minute, tzinfo=PRAGUE
    ).isoformat()


def register_and_login(client: TestClient, email: str) -> str:
    client.post(
        "/auth/register",
        json={"name": "Player", "email": email, "password": "supersecret"},
    )
    response = client.post(
        "/auth/login", json={"email": email, "password": "supersecret"}
    )
    return response.json()["access_token"]


def seed_court(session_factory: sessionmaker, name: str = "Tennis 1") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def subscription_payload(suffix: str = "1") -> dict:
    return {
        "endpoint": f"https://push.example.com/sub-{suffix}",
        "p256dh": "fake-p256dh-key",
        "auth": "fake-auth-secret",
    }


def test_public_key_is_reachable_without_auth() -> None:
    client = TestClient(app)
    response = client.get("/push/public-key")
    assert response.status_code == 200
    assert len(response.json()["public_key"]) > 0


def test_subscribe_then_unsubscribe_round_trips(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token = register_and_login(client, "uma@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    subscribed = client.post(
        "/push/subscribe", json=subscription_payload(), headers=headers
    )
    assert subscribed.status_code == 204

    with session_factory() as session:
        assert session.query(PushSubscription).count() == 1

    unsubscribed = client.request(
        "DELETE",
        "/push/subscribe",
        params={"endpoint": subscription_payload()["endpoint"]},
        headers=headers,
    )
    assert unsubscribed.status_code == 204

    with session_factory() as session:
        assert session.query(PushSubscription).count() == 0


def test_resubscribing_the_same_endpoint_upserts(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "vic@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/push/subscribe", json=subscription_payload(), headers=headers)
    client.post("/push/subscribe", json=subscription_payload(), headers=headers)

    with session_factory() as session:
        assert session.query(PushSubscription).count() == 1


def test_unsubscribing_an_unknown_endpoint_is_a_no_op(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token = register_and_login(client, "wren@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.request(
        "DELETE",
        "/push/subscribe",
        params={"endpoint": "https://push.example.com/never-subscribed"},
        headers=headers,
    )
    assert response.status_code == 204



def subscribed_player_with_booking(
    session_factory: sessionmaker, client: TestClient, email: str
) -> tuple[dict, str]:
    """A subscribed player who has just created (and so been notified about)
    a PENDING hold. Returns auth headers and the reservation id."""
    court_id = seed_court(session_factory)
    token = register_and_login(client, email)
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/push/subscribe", json=subscription_payload(), headers=headers)
    response = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    )
    assert response.status_code == 201
    return headers, response.json()["id"]


def deliveries(session_factory: sessionmaker) -> list[PushDelivery]:
    with session_factory() as session:
        return list(
            session.scalars(select(PushDelivery).order_by(PushDelivery.created_at))
        )


def dispatch(session_factory: sessionmaker, now: datetime | None = None) -> int:
    with session_factory() as session:
        attempted = push_delivery.dispatch_due(session, now)
        session.commit()
        return attempted


def test_notify_queues_a_push_that_the_dispatcher_sends(
    session_factory: sessionmaker, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = []
    monkeypatch.setattr(
        "reservations.push_delivery.webpush", lambda **kwargs: calls.append(kwargs)
    )
    client = TestClient(app)
    subscribed_player_with_booking(session_factory, client, "xara@example.com")

    # ADR-005: the request only queued the push; nothing went over the network.
    assert calls == []
    assert [d.status for d in deliveries(session_factory)] == [
        PushDeliveryStatus.PENDING
    ]

    assert dispatch(session_factory) == 1

    assert len(calls) == 1
    assert (
        calls[0]["subscription_info"]["endpoint"] == subscription_payload()["endpoint"]
    )
    [delivery] = deliveries(session_factory)
    assert delivery.status == PushDeliveryStatus.SENT
    assert delivery.attempts == 1
    assert dispatch(session_factory) == 0  # a SENT delivery is never re-sent


def test_confirm_commits_before_any_push_is_attempted(
    session_factory: sessionmaker, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The C03 Part A probe, inverted: a push may only go out for a state
    that is already committed, and never while the reservation row is locked."""
    client = TestClient(app)
    headers, reservation_id = subscribed_player_with_booking(
        session_factory, client, "conf@example.com"
    )
    seen_by_push = []

    def fake_webpush(**kwargs):
        with session_factory() as other:
            row = other.scalar(
                select(Reservation)
                .where(Reservation.id == reservation_id)
                .with_for_update(nowait=True)
            )
            seen_by_push.append(row.status)
            other.rollback()

    monkeypatch.setattr("reservations.push_delivery.webpush", fake_webpush)

    response = client.post(f"/reservations/{reservation_id}/confirm", headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "CONFIRMED"
    assert seen_by_push == []  # the request itself made no push call

    dispatch(session_factory)

    # One push for the create, one for the confirm — both see the committed,
    # unlocked row (with_for_update(nowait=True) would raise otherwise).
    assert seen_by_push == [ReservationStatus.CONFIRMED, ReservationStatus.CONFIRMED]


def test_a_rolled_back_change_leaves_no_push_behind(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    register_and_login(client, "roll@example.com")
    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == "roll@example.com"))
        session.add(PushSubscription(user_id=user.id, **subscription_payload()))
        session.commit()
        notify(session, user.id, NotificationType.RESERVATION_CONFIRMED, "t", "m")
        session.rollback()

    assert deliveries(session_factory) == []


def test_a_muted_type_queues_no_push(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    register_and_login(client, "mute@example.com")
    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == "mute@example.com"))
        user.muted_notification_types = [NotificationType.RESERVATION_CONFIRMED.value]
        session.add(PushSubscription(user_id=user.id, **subscription_payload()))
        session.commit()
        assert (
            notify(session, user.id, NotificationType.RESERVATION_CONFIRMED, "t", "m")
            is None
        )
        session.commit()

    assert deliveries(session_factory) == []


def test_a_gone_subscription_is_deleted_and_not_retried(
    session_factory: sessionmaker, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _raise_gone(**kwargs):
        raise WebPushException("gone", response=SimpleNamespace(status_code=410))

    monkeypatch.setattr("reservations.push_delivery.webpush", _raise_gone)
    client = TestClient(app)
    subscribed_player_with_booking(session_factory, client, "yael@example.com")

    dispatch(session_factory)

    with session_factory() as session:
        assert session.query(PushSubscription).count() == 0
    [delivery] = deliveries(session_factory)
    assert delivery.status == PushDeliveryStatus.SENT  # nothing left to deliver to


def test_a_transient_push_failure_is_retried_with_backoff_then_given_up(
    session_factory: sessionmaker, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _raise_network_error(**kwargs):
        raise ConnectionError("network is down")

    monkeypatch.setattr(
        "reservations.push_delivery.webpush", _raise_network_error
    )
    client = TestClient(app)
    headers, reservation_id = subscribed_player_with_booking(
        session_factory, client, "zane@example.com"
    )

    # The business operation is unaffected by the push service being down.
    response = client.post(f"/reservations/{reservation_id}/confirm", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "CONFIRMED"

    now = datetime.now(timezone.utc)
    assert dispatch(session_factory, now) == 2
    assert dispatch(session_factory, now) == 0  # backoff: not due again yet
    for delivery in deliveries(session_factory):
        assert delivery.status == PushDeliveryStatus.PENDING
        assert delivery.attempts == 1
        assert "ConnectionError" in delivery.last_error

    for _ in range(push_delivery.MAX_ATTEMPTS - 1):
        now += timedelta(hours=1)
        dispatch(session_factory, now)

    for delivery in deliveries(session_factory):
        assert delivery.status == PushDeliveryStatus.FAILED
        assert delivery.attempts == push_delivery.MAX_ATTEMPTS
    with session_factory() as session:
        # A transient error doesn't imply the subscription is dead.
        assert session.query(PushSubscription).count() == 1
