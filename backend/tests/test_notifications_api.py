from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, SportType

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0) -> str:
    day = (datetime.now(PRAGUE) + timedelta(days=3)).date()
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=PRAGUE).isoformat()


def register_and_login(client: TestClient, email: str) -> str:
    client.post("/auth/register", json={"name": "Player", "email": email, "password": "supersecret"})
    response = client.post("/auth/login", json={"email": email, "password": "supersecret"})
    return response.json()["access_token"]


def seed_court(session_factory: sessionmaker, name: str = "Tennis 1") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def test_creating_a_reservation_generates_a_notification(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "mona@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/reservations", json={"court_id": court_id, "start_time": at(18), "end_time": at(19)}, headers=headers
    )

    response = client.get("/notifications", headers=headers)
    assert response.status_code == 200
    types = [n["type"] for n in response.json()]
    assert "RESERVATION_CREATED" in types

    unread = client.get("/notifications/unread-count", headers=headers)
    assert unread.json()["count"] >= 1


def test_mark_notification_read(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "nate@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/reservations", json={"court_id": court_id, "start_time": at(18), "end_time": at(19)}, headers=headers
    )
    notification_id = client.get("/notifications", headers=headers).json()[0]["id"]

    response = client.post(f"/notifications/{notification_id}/read", headers=headers)

    assert response.status_code == 200
    assert response.json()["read_at"] is not None


def test_mark_all_read(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "opal@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/reservations", json={"court_id": court_id, "start_time": at(18), "end_time": at(19)}, headers=headers
    ).json()
    client.post(f"/reservations/{created['id']}/confirm", headers=headers)

    response = client.post("/notifications/read-all", headers=headers)
    assert response.status_code == 200
    assert response.json()["updated"] >= 2

    unread = client.get("/notifications/unread-count", headers=headers)
    assert unread.json()["count"] == 0


def test_cannot_read_someone_elses_notification(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    owner_token = register_and_login(client, "pia@example.com")
    other_token = register_and_login(client, "quest@example.com")
    client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    notification_id = client.get(
        "/notifications", headers={"Authorization": f"Bearer {owner_token}"}
    ).json()[0]["id"]

    response = client.post(
        f"/notifications/{notification_id}/read", headers={"Authorization": f"Bearer {other_token}"}
    )

    assert response.status_code == 404
