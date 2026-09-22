from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, SportType

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0) -> str:
    day = (datetime.now(PRAGUE) + timedelta(days=3)).date()
    return datetime(
        day.year, day.month, day.day, hour, minute, tzinfo=PRAGUE
    ).isoformat()


def register_and_login(client: TestClient, email: str, name: str = "Player") -> str:
    client.post(
        "/auth/register", json={"name": name, "email": email, "password": "supersecret"}
    )
    response = client.post(
        "/auth/login", json={"email": email, "password": "supersecret"}
    )
    return response.json()["access_token"]


def seed_court(session_factory: sessionmaker, name: str = "Volleyball Court") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.VOLLEYBALL, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def test_invite_guest_success_and_shared_with_me(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    owner_token = register_and_login(client, "hank@example.com")
    guest_email = "iris@example.com"
    register_and_login(client, guest_email)

    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()

    invite = client.post(
        f"/reservations/{created['id']}/guests",
        json={"email": guest_email},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert invite.status_code == 201
    assert invite.json()["user"]["email"] == guest_email

    guest_token = client.post(
        "/auth/login", json={"email": guest_email, "password": "supersecret"}
    ).json()["access_token"]
    shared = client.get(
        "/reservations/shared-with-me",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert shared.status_code == 200
    assert len(shared.json()) == 1
    assert shared.json()[0]["id"] == created["id"]

    guest_notifications = client.get(
        "/notifications", headers={"Authorization": f"Bearer {guest_token}"}
    )
    assert any(
        n["title"].startswith("You've been added") for n in guest_notifications.json()
    )


def test_cannot_invite_self(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    owner_email = "jack@example.com"
    owner_token = register_and_login(client, owner_email)
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()

    response = client.post(
        f"/reservations/{created['id']}/guests",
        json={"email": owner_email},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert response.status_code == 409


def test_cannot_invite_twice(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    owner_token = register_and_login(client, "kay@example.com")
    guest_email = "liam@example.com"
    register_and_login(client, guest_email)
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()
    headers = {"Authorization": f"Bearer {owner_token}"}

    first = client.post(
        f"/reservations/{created['id']}/guests",
        json={"email": guest_email},
        headers=headers,
    )
    assert first.status_code == 201
    second = client.post(
        f"/reservations/{created['id']}/guests",
        json={"email": guest_email},
        headers=headers,
    )
    assert second.status_code == 409


def test_non_owner_cannot_invite(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    owner_token = register_and_login(client, "mona@example.com")
    other_token = register_and_login(client, "nick@example.com")
    register_and_login(client, "olga@example.com")
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()

    response = client.post(
        f"/reservations/{created['id']}/guests",
        json={"email": "olga@example.com"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 403


def test_remove_guest(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    owner_token = register_and_login(client, "pete@example.com")
    guest_email = "quinn@example.com"
    register_and_login(client, guest_email)
    headers = {"Authorization": f"Bearer {owner_token}"}
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    ).json()
    guest = client.post(
        f"/reservations/{created['id']}/guests",
        json={"email": guest_email},
        headers=headers,
    ).json()

    response = client.delete(
        f"/reservations/{created['id']}/guests/{guest['user']['id']}", headers=headers
    )
    assert response.status_code == 204

    listing = client.get(f"/reservations/{created['id']}/guests", headers=headers)
    assert listing.json() == []


def test_invite_guest_by_user_id(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    owner_token = register_and_login(client, "rex@example.com")
    client.post(
        "/auth/register",
        json={"name": "Sable", "email": "sable@example.com", "password": "supersecret"},
    )
    guest_id = client.post(
        "/auth/login", json={"email": "sable@example.com", "password": "supersecret"}
    ).json()["user"]["id"]
    headers = {"Authorization": f"Bearer {owner_token}"}
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    ).json()

    response = client.post(
        f"/reservations/{created['id']}/guests",
        json={"user_id": guest_id},
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["user"]["id"] == guest_id


def test_invite_guest_requires_exactly_one_of_email_or_user_id(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    owner_token = register_and_login(client, "tara@example.com")
    headers = {"Authorization": f"Bearer {owner_token}"}
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=headers,
    ).json()

    response = client.post(
        f"/reservations/{created['id']}/guests", json={}, headers=headers
    )
    assert response.status_code == 422
