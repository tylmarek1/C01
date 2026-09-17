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


def test_single_reservation_ics_download(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "cal1@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/reservations", json={"court_id": court_id, "start_time": at(18), "end_time": at(19)}, headers=headers
    ).json()

    response = client.get(f"/reservations/{created['id']}/ics", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/calendar")
    body = response.text
    assert "BEGIN:VCALENDAR" in body
    assert "BEGIN:VEVENT" in body
    assert f"UID:reservation-{created['id']}" in body


def test_personal_calendar_feed_requires_valid_token(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, "Tennis Feed")
    token = register_and_login(client, "cal2@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/reservations", json={"court_id": court_id, "start_time": at(18), "end_time": at(19)}, headers=headers)

    bad = client.get("/reservations/calendar.ics", params={"token": "not-a-real-token"})
    assert bad.status_code == 404

    issued = client.post("/auth/me/calendar-token", headers=headers)
    assert issued.status_code == 200
    calendar_token = issued.json()["calendar_token"]

    feed = client.get("/reservations/calendar.ics", params={"token": calendar_token})
    assert feed.status_code == 200
    assert "BEGIN:VEVENT" in feed.text


def test_regenerating_calendar_token_revokes_the_old_one(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "cal3@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post("/auth/me/calendar-token", headers=headers).json()["calendar_token"]
    second = client.post("/auth/me/calendar-token", headers=headers).json()["calendar_token"]
    assert first != second

    assert client.get("/reservations/calendar.ics", params={"token": first}).status_code == 404
    assert client.get("/reservations/calendar.ics", params={"token": second}).status_code == 200
