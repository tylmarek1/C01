from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, SportType

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0, days_ahead: int = 3) -> str:
    day = (datetime.now(PRAGUE) + timedelta(days=days_ahead)).date()
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=PRAGUE).isoformat()


def register_and_login(client: TestClient, email: str) -> str:
    client.post("/auth/register", json={"name": "Player", "email": email, "password": "supersecret"})
    response = client.post("/auth/login", json={"email": email, "password": "supersecret"})
    return response.json()["access_token"]


def seed_court(session_factory: sessionmaker, name: str) -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.BADMINTON, indoor=True)
        session.add(court)
        session.commit()
        return str(court.id)


def test_frequent_teammates_counts_both_directions(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    host_token = register_and_login(client, "host-tm@example.com")
    mate_token = register_and_login(client, "mate-tm@example.com")
    host_headers = {"Authorization": f"Bearer {host_token}"}
    mate_headers = {"Authorization": f"Bearer {mate_token}"}
    mate_id = client.get("/auth/me", headers=mate_headers).json()["id"]
    host_id = client.get("/auth/me", headers=host_headers).json()["id"]

    # Host invites mate on two separate reservations.
    for i, days in enumerate([3, 4]):
        court_id = seed_court(session_factory, f"Teammate Court {i}")
        reservation = client.post(
            "/reservations",
            json={"court_id": court_id, "start_time": at(18, days_ahead=days), "end_time": at(19, days_ahead=days)},
            headers=host_headers,
        ).json()
        client.post(f"/reservations/{reservation['id']}/guests", json={"email": "mate-tm@example.com"}, headers=host_headers)

    host_view = client.get("/reservations/frequent-teammates", headers=host_headers)
    assert host_view.status_code == 200
    top = host_view.json()[0]
    assert top["user"]["id"] == mate_id
    assert top["games_together"] == 2

    mate_view = client.get("/reservations/frequent-teammates", headers=mate_headers).json()
    assert mate_view[0]["user"]["id"] == host_id
    assert mate_view[0]["games_together"] == 2
