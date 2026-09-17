from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, SportType, User, UserRole

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0) -> str:
    day = (datetime.now(PRAGUE) + timedelta(days=3)).date()
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=PRAGUE).isoformat()


def register_and_login(client: TestClient, email: str) -> str:
    client.post("/auth/register", json={"name": "Player", "email": email, "password": "supersecret"})
    response = client.post("/auth/login", json={"email": email, "password": "supersecret"})
    return response.json()["access_token"]


def promote_to_manager(session_factory: sessionmaker, email: str) -> None:
    with session_factory() as session:
        user = session.query(User).filter_by(email=email).one()
        user.role = UserRole.VENUE_MANAGER
        session.commit()


def seed_court(session_factory: sessionmaker, name: str = "Report Court") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def test_reservations_csv_export_requires_manager(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    player_token = register_and_login(client, "csv-player@example.com")
    client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {player_token}"},
    )

    denied = client.get("/admin/reservations/export.csv", headers={"Authorization": f"Bearer {player_token}"})
    assert denied.status_code == 403

    promote_to_manager(session_factory, "csv-player@example.com")
    manager_token = client.post(
        "/auth/login", json={"email": "csv-player@example.com", "password": "supersecret"}
    ).json()["access_token"]
    response = client.get("/admin/reservations/export.csv", headers={"Authorization": f"Bearer {manager_token}"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    lines = response.text.strip().splitlines()
    assert lines[0].startswith("id,court,sport,booked_by,email,start_time,end_time,status,created_at")
    assert len(lines) >= 2


def test_court_utilization_heatmap_shape(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, "Utilization Court")
    manager_email = "util-mgr@example.com"
    register_and_login(client, manager_email)
    promote_to_manager(session_factory, manager_email)
    manager_token = client.post("/auth/login", json={"email": manager_email, "password": "supersecret"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {manager_token}"}

    client.post(
        "/reservations", json={"court_id": court_id, "start_time": at(18), "end_time": at(19)}, headers=headers
    )

    response = client.get(f"/admin/courts/{court_id}/utilization", params={"days": 30}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["court_id"] == court_id
    assert body["days_analyzed"] == 30
    # 7 days x 15 opening hours (07:00-22:00)
    assert len(body["cells"]) == 7 * 15
    assert all(cell["possible_count"] > 0 for cell in body["cells"])
