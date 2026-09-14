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


def test_cannot_join_waitlist_for_a_free_slot(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "ana@example.com")

    response = client.post(
        "/waitlist",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400


def test_join_and_get_offered_when_slot_frees_up(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    holder_token = register_and_login(client, "bob@example.com")
    waiter_token = register_and_login(client, "cleo@example.com")

    holder_headers = {"Authorization": f"Bearer {holder_token}"}
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=holder_headers,
    ).json()

    join = client.post(
        "/waitlist",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {waiter_token}"},
    )
    assert join.status_code == 201
    entry_id = join.json()["id"]
    assert join.json()["status"] == "WAITING"

    client.post(f"/reservations/{created['id']}/cancel", headers=holder_headers)

    mine = client.get("/waitlist/mine", headers={"Authorization": f"Bearer {waiter_token}"})
    entry = next(e for e in mine.json() if e["id"] == entry_id)
    assert entry["status"] == "OFFERED"

    accept = client.post(f"/waitlist/{entry_id}/accept", headers={"Authorization": f"Bearer {waiter_token}"})
    assert accept.status_code == 200
    assert accept.json()["status"] == "CONFIRMED"


def test_cannot_join_same_waitlist_twice(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    holder_token = register_and_login(client, "dave@example.com")
    waiter_token = register_and_login(client, "ella@example.com")

    client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {holder_token}"},
    )
    headers = {"Authorization": f"Bearer {waiter_token}"}
    payload = {"court_id": court_id, "start_time": at(18), "end_time": at(19)}
    first = client.post("/waitlist", json=payload, headers=headers)
    assert first.status_code == 201

    second = client.post("/waitlist", json=payload, headers=headers)
    assert second.status_code == 409


def test_cancel_waitlist_entry(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    holder_token = register_and_login(client, "finn@example.com")
    waiter_token = register_and_login(client, "gwen@example.com")

    client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {holder_token}"},
    )
    headers = {"Authorization": f"Bearer {waiter_token}"}
    entry = client.post(
        "/waitlist",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    ).json()

    response = client.post(f"/waitlist/{entry['id']}/cancel", headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"
