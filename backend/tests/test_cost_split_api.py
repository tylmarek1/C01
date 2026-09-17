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


def seed_priced_court(session_factory: sessionmaker, price: float = 300) -> str:
    with session_factory() as session:
        court = Court(name="Priced Court", sport_type=SportType.TENNIS, indoor=False, price_per_hour=price)
        session.add(court)
        session.commit()
        return str(court.id)


def test_split_divides_evenly_between_booker_and_guests(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_priced_court(session_factory, price=300)
    host_token = register_and_login(client, "split-host@example.com")
    register_and_login(client, "split-guest@example.com")
    headers = {"Authorization": f"Bearer {host_token}"}

    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(20)},  # 2 hours
        headers=headers,
    ).json()
    client.post(f"/reservations/{created['id']}/guests", json={"email": "split-guest@example.com"}, headers=headers)

    split = client.get(f"/reservations/{created['id']}/split", headers=headers)
    assert split.status_code == 200
    body = split.json()
    assert body["duration_hours"] == 2.0
    assert body["total_cost"] == 600.0
    assert body["participant_count"] == 2
    assert body["per_person"] == 300.0
    assert len(body["participants"]) == 2


def test_split_without_a_price_returns_none(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    with session_factory() as session:
        court = Court(name="Unpriced Court", sport_type=SportType.BADMINTON, indoor=True)
        session.add(court)
        session.commit()
        court_id = str(court.id)

    token = register_and_login(client, "split-free@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/reservations", json={"court_id": court_id, "start_time": at(18), "end_time": at(19)}, headers=headers
    ).json()

    split = client.get(f"/reservations/{created['id']}/split", headers=headers).json()
    assert split["total_cost"] is None
    assert split["per_person"] is None
    assert split["participant_count"] == 1
