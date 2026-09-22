from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from pywebpush import WebPushException
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, PushSubscription, SportType

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


def test_notify_sends_a_web_push_to_a_subscribed_user(
    session_factory: sessionmaker, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = []
    monkeypatch.setattr(
        "reservations.notifications.webpush", lambda **kwargs: calls.append(kwargs)
    )

    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "xara@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/push/subscribe", json=subscription_payload(), headers=headers)

    client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    )

    assert len(calls) == 1
    assert (
        calls[0]["subscription_info"]["endpoint"] == subscription_payload()["endpoint"]
    )


def test_a_gone_subscription_is_deleted_on_delivery_failure(
    session_factory: sessionmaker, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _raise_gone(**kwargs):
        raise WebPushException("gone", response=SimpleNamespace(status_code=410))

    monkeypatch.setattr("reservations.notifications.webpush", _raise_gone)

    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "yael@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/push/subscribe", json=subscription_payload(), headers=headers)

    response = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    )
    # The reservation itself still succeeds — a dead push subscription must
    # never break the request that triggered the notification.
    assert response.status_code == 201

    with session_factory() as session:
        assert session.query(PushSubscription).count() == 0


def test_an_unexpected_push_error_does_not_break_the_request(
    session_factory: sessionmaker, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _raise_network_error(**kwargs):
        raise ConnectionError("network is down")

    monkeypatch.setattr("reservations.notifications.webpush", _raise_network_error)

    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "zane@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/push/subscribe", json=subscription_payload(), headers=headers)

    response = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    )
    assert response.status_code == 201

    with session_factory() as session:
        # An ordinary (non-WebPushException) error doesn't imply the
        # subscription is dead, so it must survive.
        assert session.query(PushSubscription).count() == 1
