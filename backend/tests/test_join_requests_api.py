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


def seed_court(session_factory: sessionmaker, name: str = "Volleyball Arena") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.VOLLEYBALL, indoor=True)
        session.add(court)
        session.commit()
        return str(court.id)


def make_confirmed_reservation(client: TestClient, court_id: str, headers: dict) -> dict:
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    ).json()
    confirmed = client.post(f"/reservations/{created['id']}/confirm", headers=headers)
    assert confirmed.status_code == 200
    return confirmed.json()


def test_full_find_a_partner_flow(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    host_token = register_and_login(client, "host@example.com")
    joiner_token = register_and_login(client, "joiner@example.com")
    host_headers = {"Authorization": f"Bearer {host_token}"}
    joiner_headers = {"Authorization": f"Bearer {joiner_token}"}

    reservation = make_confirmed_reservation(client, court_id, host_headers)

    # Not visible while closed
    assert reservation["id"] not in [
        g["id"] for g in client.get("/reservations/open", headers=joiner_headers).json()
    ]

    opened = client.patch(
        f"/reservations/{reservation['id']}/open",
        json={"open_to_join": True, "open_note": "Need a fourth!"},
        headers=host_headers,
    )
    assert opened.status_code == 200
    assert opened.json()["open_to_join"] is True

    open_games = client.get("/reservations/open", headers=joiner_headers).json()
    game = next(g for g in open_games if g["id"] == reservation["id"])
    assert game["open_note"] == "Need a fourth!"
    assert game["spots_left"] == 10
    assert game["user"]["email"] == "host@example.com"

    request = client.post(
        f"/reservations/{reservation['id']}/join-requests", json={"note": "I'll bring a ball"}, headers=joiner_headers
    )
    assert request.status_code == 201
    assert request.json()["status"] == "PENDING"

    pending = client.get(f"/reservations/{reservation['id']}/join-requests", headers=host_headers)
    assert len(pending.json()) == 1
    request_id = pending.json()[0]["id"]

    accept = client.post(
        f"/reservations/{reservation['id']}/join-requests/{request_id}/accept", headers=host_headers
    )
    assert accept.status_code == 200
    assert accept.json()["user"]["email"] == "joiner@example.com"

    guests = client.get(f"/reservations/{reservation['id']}/guests", headers=host_headers).json()
    assert any(g["user"]["email"] == "joiner@example.com" for g in guests)

    joiner_notifications = client.get("/notifications", headers=joiner_headers).json()
    assert any(n["type"] == "JOIN_REQUEST_ACCEPTED" for n in joiner_notifications)


def test_cannot_double_request_and_host_can_decline(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, "Volleyball Arena 2")
    host_token = register_and_login(client, "host2@example.com")
    joiner_token = register_and_login(client, "joiner2@example.com")
    host_headers = {"Authorization": f"Bearer {host_token}"}
    joiner_headers = {"Authorization": f"Bearer {joiner_token}"}

    reservation = make_confirmed_reservation(client, court_id, host_headers)
    client.patch(f"/reservations/{reservation['id']}/open", json={"open_to_join": True}, headers=host_headers)

    first = client.post(f"/reservations/{reservation['id']}/join-requests", json={}, headers=joiner_headers)
    assert first.status_code == 201
    second = client.post(f"/reservations/{reservation['id']}/join-requests", json={}, headers=joiner_headers)
    assert second.status_code == 409

    request_id = first.json()["id"]
    decline = client.post(
        f"/reservations/{reservation['id']}/join-requests/{request_id}/decline", headers=host_headers
    )
    assert decline.status_code == 200
    assert decline.json()["status"] == "DECLINED"

    guests = client.get(f"/reservations/{reservation['id']}/guests", headers=host_headers).json()
    assert guests == []


def test_join_requests_require_reservation_to_be_open(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, "Volleyball Arena 3")
    host_token = register_and_login(client, "host3@example.com")
    joiner_token = register_and_login(client, "joiner3@example.com")

    reservation = make_confirmed_reservation(client, court_id, {"Authorization": f"Bearer {host_token}"})

    response = client.post(
        f"/reservations/{reservation['id']}/join-requests",
        json={},
        headers={"Authorization": f"Bearer {joiner_token}"},
    )
    assert response.status_code == 409
