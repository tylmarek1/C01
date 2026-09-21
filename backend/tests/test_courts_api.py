import io
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, SportType

PRAGUE = ZoneInfo("Europe/Prague")


def register_and_login(client: TestClient, email: str, name: str = "Player") -> str:
    client.post(
        "/auth/register", json={"name": name, "email": email, "password": "supersecret"}
    )
    response = client.post(
        "/auth/login", json={"email": email, "password": "supersecret"}
    )
    return response.json()["access_token"]


def promote_to_manager(session_factory: sessionmaker, email: str) -> None:
    from reservations.models import User, UserRole

    with session_factory() as session:
        user = session.query(User).filter_by(email=email).one()
        user.role = UserRole.VENUE_MANAGER
        session.commit()


def promote_to_admin(session_factory: sessionmaker, email: str) -> None:
    from reservations.models import User, UserRole

    with session_factory() as session:
        user = session.query(User).filter_by(email=email).one()
        user.role = UserRole.ADMIN
        session.commit()


def seed_court(
    session_factory: sessionmaker, name: str = "Tennis 1", active: bool = True
) -> str:
    with session_factory() as session:
        court = Court(
            name=name, sport_type=SportType.TENNIS, indoor=False, active=active
        )
        session.add(court)
        session.commit()
        return str(court.id)


def test_get_court_detail(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, name="Tennis Detail")

    response = client.get(f"/courts/{court_id}")

    assert response.status_code == 200
    assert response.json()["name"] == "Tennis Detail"


def test_get_court_detail_404_for_inactive(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, name="Hidden Court", active=False)

    response = client.get(f"/courts/{court_id}")

    assert response.status_code == 404


def test_availability_reflects_existing_reservation(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, name="Tennis Avail")
    token = register_and_login(client, "avail@example.com")

    day = (datetime.now(PRAGUE) + timedelta(days=5)).date()
    start = datetime(day.year, day.month, day.day, 18, tzinfo=PRAGUE)
    end = start + timedelta(hours=1)
    client.post(
        "/reservations",
        json={
            "court_id": court_id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    response = client.get(
        f"/courts/{court_id}/availability", params={"date": day.isoformat()}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["busy"]) == 1
    assert body["busy"][0]["status"] == "PENDING"


def test_non_manager_cannot_create_court(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "player-create@example.com")

    response = client.post(
        "/courts",
        json={"name": "New Court", "sport_type": "TENNIS", "indoor": False},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_manager_can_create_and_update_court(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "manager-create@example.com")
    promote_to_manager(session_factory, "manager-create@example.com")

    created = client.post(
        "/courts",
        json={
            "name": "Manager Court",
            "sport_type": "BADMINTON",
            "indoor": True,
            "description": "Nice court",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created.status_code == 201
    court_id = created.json()["id"]

    updated = client.patch(
        f"/courts/{court_id}",
        json={"active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert updated.status_code == 200
    assert updated.json()["active"] is False


def test_include_inactive_requires_manager(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    seed_court(session_factory, name="Inactive Court", active=False)
    player_token = register_and_login(client, "inactive-player@example.com")

    forbidden = client.get(
        "/courts",
        params={"include_inactive": True},
        headers={"Authorization": f"Bearer {player_token}"},
    )
    assert forbidden.status_code == 403

    anonymous = client.get("/courts", params={"include_inactive": True})
    assert anonymous.status_code == 403


def test_manager_can_upload_court_image(
    session_factory: sessionmaker, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("reservations.images.settings.upload_dir", tmp_path)
    client = TestClient(app)
    token = register_and_login(client, "manager-image@example.com")
    promote_to_manager(session_factory, "manager-image@example.com")
    court_id = seed_court(session_factory, name="Photogenic Court")

    buffer = io.BytesIO()
    Image.new("RGB", (2000, 1200), color=(20, 120, 60)).save(buffer, format="JPEG")
    buffer.seek(0)

    response = client.post(
        f"/courts/{court_id}/image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("court.jpg", buffer, "image/jpeg")},
    )

    assert response.status_code == 200
    image_url = response.json()["image_url"]
    assert image_url.startswith("/static/courts/")
    assert (tmp_path / "courts" / image_url.rsplit("/", 1)[-1]).exists()


def test_non_manager_cannot_upload_court_image(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "player-image@example.com")
    court_id = seed_court(session_factory, name="Guarded Court")

    response = client.post(
        f"/courts/{court_id}/image",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("court.jpg", io.BytesIO(b"not an image"), "image/jpeg")},
    )

    assert response.status_code == 403


def test_search_courts_by_name(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    seed_court(session_factory, name="Riverside Tennis Court")
    seed_court(session_factory, name="Downtown Badminton Court")

    response = client.get("/courts", params={"q": "riverside"})

    assert response.status_code == 200
    names = [c["name"] for c in response.json()]
    assert names == ["Riverside Tennis Court"]


def test_filter_courts_by_amenity(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "amenity-manager@example.com")
    promote_to_manager(session_factory, "amenity-manager@example.com")

    created = client.post(
        "/courts",
        json={
            "name": "Lit Court",
            "sport_type": "TENNIS",
            "indoor": False,
            "amenities": ["LIGHTING", "PARKING"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert created.status_code == 201
    seed_court(session_factory, name="Plain Court")

    lit = client.get("/courts", params={"amenity": "LIGHTING"})
    assert lit.status_code == 200
    names = [c["name"] for c in lit.json()]
    assert names == ["Lit Court"]

    showers = client.get("/courts", params={"amenity": "SHOWERS"})
    assert showers.json() == []


def test_manager_cannot_delete_court(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, name="Manager Delete Attempt")
    token = register_and_login(client, "delete-manager@example.com")
    promote_to_manager(session_factory, "delete-manager@example.com")

    response = client.delete(
        f"/courts/{court_id}", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403


def test_admin_can_delete_unused_court(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, name="Admin Delete Target")
    token = register_and_login(client, "delete-admin@example.com")
    promote_to_admin(session_factory, "delete-admin@example.com")

    response = client.delete(
        f"/courts/{court_id}", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 204
    assert client.get(f"/courts/{court_id}").status_code == 404


def test_admin_cannot_delete_court_with_reservation_history(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory, name="Booked Court")
    player_token = register_and_login(client, "delete-player@example.com")

    day = (datetime.now(PRAGUE) + timedelta(days=5)).date()
    start = datetime(day.year, day.month, day.day, 18, tzinfo=PRAGUE)
    end = start + timedelta(hours=1)
    client.post(
        "/reservations",
        json={
            "court_id": court_id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        },
        headers={"Authorization": f"Bearer {player_token}"},
    )

    admin_token = register_and_login(client, "delete-admin-2@example.com")
    promote_to_admin(session_factory, "delete-admin-2@example.com")

    response = client.delete(
        f"/courts/{court_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == 409
    assert client.get(f"/courts/{court_id}").status_code == 200


def test_admin_can_delete_court_with_favorites_and_waitlist_entries_but_no_reservations(
    session_factory: sessionmaker,
) -> None:
    """Favorites and waitlist entries reference a court without a reservation
    ever existing (a waitlist entry normally implies one, but the reservation
    that created it can be cancelled and still leaves the court's history
    clean) — the delete endpoint must clean those up itself rather than
    hitting a raw FK violation."""
    from reservations.models import WaitlistEntry, WaitlistStatus

    client = TestClient(app)
    court_id = seed_court(session_factory, name="Favorited Court")
    player_token = register_and_login(client, "delete-fan@example.com")

    favorite = client.post(
        f"/favorites/{court_id}", headers={"Authorization": f"Bearer {player_token}"}
    )
    assert favorite.status_code == 204

    with session_factory() as session:
        from reservations.models import User

        player = session.query(User).filter_by(email="delete-fan@example.com").one()
        entry = WaitlistEntry(
            court_id=court_id,
            user_id=player.id,
            start_time=datetime.now(PRAGUE) + timedelta(days=3),
            end_time=datetime.now(PRAGUE) + timedelta(days=3, hours=1),
            status=WaitlistStatus.CANCELLED,
        )
        session.add(entry)
        session.commit()

    admin_token = register_and_login(client, "delete-admin-3@example.com")
    promote_to_admin(session_factory, "delete-admin-3@example.com")

    response = client.delete(
        f"/courts/{court_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )

    assert response.status_code == 204
    assert client.get(f"/courts/{court_id}").status_code == 404
