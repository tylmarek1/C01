from datetime import datetime, timedelta
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


def promote_to_admin(session_factory: sessionmaker, email: str) -> None:
    with session_factory() as session:
        user = session.query(User).filter_by(email=email).one()
        user.role = UserRole.ADMIN
        session.commit()


def seed_court(session_factory: sessionmaker, name: str = "Tennis 1") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def test_non_manager_cannot_view_stats(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "sara@example.com")
    response = client.get("/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_stats_reflect_bookings(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    player_token = register_and_login(client, "tom@example.com")
    client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {player_token}"},
    )

    manager_token = register_and_login(client, "uma-manager@example.com")
    promote_to_manager(session_factory, "uma-manager@example.com")

    response = client.get(
        "/admin/stats", headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_reservations"] >= 1
    assert body["status_breakdown"]["PENDING"] >= 1
    assert isinstance(body["busiest_hours"], list)


def test_non_manager_cannot_list_users(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "vince@example.com")
    response = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_manager_can_promote_and_view_user(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    manager_token = register_and_login(client, "wade-manager@example.com")
    promote_to_manager(session_factory, "wade-manager@example.com")
    player_token = register_and_login(client, "xena-player@example.com")

    listing = client.get(
        "/admin/users", headers={"Authorization": f"Bearer {manager_token}"}
    )
    assert listing.status_code == 200
    player_row = next(
        u for u in listing.json() if u["email"] == "xena-player@example.com"
    )
    assert player_row["role"] == "PLAYER"
    assert "active_reservation_count" in player_row

    promote = client.patch(
        f"/admin/users/{player_row['id']}/role",
        json={"role": "VENUE_MANAGER"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert promote.status_code == 200
    assert promote.json()["role"] == "VENUE_MANAGER"


def test_manager_cannot_demote_self(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    manager_token = register_and_login(client, "yara-manager@example.com")
    promote_to_manager(session_factory, "yara-manager@example.com")

    listing = client.get(
        "/admin/users", headers={"Authorization": f"Bearer {manager_token}"}
    ).json()
    self_row = next(u for u in listing if u["email"] == "yara-manager@example.com")

    response = client.patch(
        f"/admin/users/{self_row['id']}/role",
        json={"role": "PLAYER"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert response.status_code == 409


def test_manager_cannot_grant_admin_role(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    manager_token = register_and_login(client, "zed-manager@example.com")
    promote_to_manager(session_factory, "zed-manager@example.com")
    player_token = register_and_login(client, "aaron-player@example.com")

    listing = client.get(
        "/admin/users", headers={"Authorization": f"Bearer {manager_token}"}
    ).json()
    player_row = next(u for u in listing if u["email"] == "aaron-player@example.com")

    response = client.patch(
        f"/admin/users/{player_row['id']}/role",
        json={"role": "ADMIN"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert response.status_code == 403


def test_manager_cannot_change_an_admins_role(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    manager_token = register_and_login(client, "bella-manager@example.com")
    promote_to_manager(session_factory, "bella-manager@example.com")
    register_and_login(client, "carl-admin@example.com")
    promote_to_admin(session_factory, "carl-admin@example.com")

    listing = client.get(
        "/admin/users", headers={"Authorization": f"Bearer {manager_token}"}
    ).json()
    admin_row = next(u for u in listing if u["email"] == "carl-admin@example.com")

    response = client.patch(
        f"/admin/users/{admin_row['id']}/role",
        json={"role": "PLAYER"},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert response.status_code == 403


def test_admin_can_grant_and_revoke_admin_role(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    admin_token = register_and_login(client, "dana-admin@example.com")
    promote_to_admin(session_factory, "dana-admin@example.com")
    player_token = register_and_login(client, "evan-player@example.com")

    listing = client.get(
        "/admin/users", headers={"Authorization": f"Bearer {admin_token}"}
    ).json()
    player_row = next(u for u in listing if u["email"] == "evan-player@example.com")

    grant = client.patch(
        f"/admin/users/{player_row['id']}/role",
        json={"role": "ADMIN"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert grant.status_code == 200
    assert grant.json()["role"] == "ADMIN"

    revoke = client.patch(
        f"/admin/users/{player_row['id']}/role",
        json={"role": "PLAYER"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert revoke.status_code == 200
    assert revoke.json()["role"] == "PLAYER"


def test_admin_cannot_change_own_role(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    admin_token = register_and_login(client, "finn-admin@example.com")
    promote_to_admin(session_factory, "finn-admin@example.com")

    listing = client.get(
        "/admin/users", headers={"Authorization": f"Bearer {admin_token}"}
    ).json()
    self_row = next(u for u in listing if u["email"] == "finn-admin@example.com")

    response = client.patch(
        f"/admin/users/{self_row['id']}/role",
        json={"role": "VENUE_MANAGER"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 409


def test_admin_inherits_manager_access(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    admin_token = register_and_login(client, "gina-admin@example.com")
    promote_to_admin(session_factory, "gina-admin@example.com")

    response = client.get(
        "/admin/stats", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
