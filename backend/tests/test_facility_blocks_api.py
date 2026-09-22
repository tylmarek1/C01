from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, SportType, User, UserRole

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


def promote_to_manager(session_factory: sessionmaker, email: str) -> None:
    with session_factory() as session:
        user = session.query(User).filter_by(email=email).one()
        user.role = UserRole.VENUE_MANAGER
        session.commit()


def seed_court(session_factory: sessionmaker, name: str = "Tennis 1") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def test_non_manager_cannot_create_facility_block(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "hana@example.com")

    response = client.post(
        "/facility-blocks",
        json={
            "court_id": court_id,
            "start_time": at(14),
            "end_time": at(18),
            "reason": "Maintenance",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_facility_block_cancels_overlapping_reservations(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    player_token = register_and_login(client, "ivo@example.com")
    manager_token = register_and_login(client, "jana-manager@example.com")
    promote_to_manager(session_factory, "jana-manager@example.com")

    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(15), "end_time": at(16)},
        headers={"Authorization": f"Bearer {player_token}"},
    ).json()

    block = client.post(
        "/facility-blocks",
        json={
            "court_id": court_id,
            "start_time": at(14),
            "end_time": at(18),
            "reason": "Roof repair",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert block.status_code == 201

    reservation = client.get(
        "/reservations", headers={"Authorization": f"Bearer {player_token}"}
    ).json()
    matching = next(r for r in reservation if r["id"] == created["id"])
    assert matching["status"] == "CANCELLED"


def test_new_booking_rejected_during_facility_block(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    manager_token = register_and_login(client, "karel-manager@example.com")
    promote_to_manager(session_factory, "karel-manager@example.com")
    player_token = register_and_login(client, "lena@example.com")

    client.post(
        "/facility-blocks",
        json={
            "court_id": court_id,
            "start_time": at(14),
            "end_time": at(18),
            "reason": "Private event",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    response = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(15), "end_time": at(16)},
        headers={"Authorization": f"Bearer {player_token}"},
    )

    assert response.status_code == 409
    assert "unavailable" in response.json()["detail"].lower()


def test_one_off_block_has_no_series_id(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    manager_token = register_and_login(client, "mona-manager@example.com")
    promote_to_manager(session_factory, "mona-manager@example.com")

    response = client.post(
        "/facility-blocks",
        json={
            "court_id": court_id,
            "start_time": at(14),
            "end_time": at(18),
            "reason": "Cleaning",
        },
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert response.status_code == 201
    assert response.json()["series_id"] is None


def test_recurring_block_creates_one_occurrence_per_week(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    manager_token = register_and_login(client, "nina-manager@example.com")
    promote_to_manager(session_factory, "nina-manager@example.com")
    headers = {"Authorization": f"Bearer {manager_token}"}

    created = client.post(
        "/facility-blocks",
        json={
            "court_id": court_id,
            "start_time": at(6),
            "end_time": at(7),
            "reason": "Weekly line painting",
            "weeks": 3,
        },
        headers=headers,
    )
    assert created.status_code == 201
    series_id = created.json()["series_id"]
    assert series_id is not None

    listing = client.get("/facility-blocks", params={"court_id": court_id}).json()
    series_blocks = sorted(
        (b for b in listing if b["series_id"] == series_id),
        key=lambda b: b["start_time"],
    )
    assert len(series_blocks) == 3
    first_start = datetime.fromisoformat(series_blocks[0]["start_time"])
    for offset, block in enumerate(series_blocks):
        assert datetime.fromisoformat(block["start_time"]) == first_start + timedelta(
            weeks=offset
        )


def test_deleting_a_series_removes_every_occurrence(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    manager_token = register_and_login(client, "oto-manager@example.com")
    promote_to_manager(session_factory, "oto-manager@example.com")
    headers = {"Authorization": f"Bearer {manager_token}"}

    created = client.post(
        "/facility-blocks",
        json={
            "court_id": court_id,
            "start_time": at(6),
            "end_time": at(7),
            "reason": "Weekly maintenance",
            "weeks": 4,
        },
        headers=headers,
    )
    series_id = created.json()["series_id"]

    response = client.delete(f"/facility-blocks/series/{series_id}", headers=headers)
    assert response.status_code == 204

    listing = client.get("/facility-blocks", params={"court_id": court_id}).json()
    assert not any(b["series_id"] == series_id for b in listing)


def test_deleting_an_unknown_series_returns_404(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    manager_token = register_and_login(client, "petra-manager@example.com")
    promote_to_manager(session_factory, "petra-manager@example.com")

    response = client.delete(
        f"/facility-blocks/series/{uuid4()}",
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    assert response.status_code == 404
