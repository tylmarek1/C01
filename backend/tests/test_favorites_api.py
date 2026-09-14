from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, SportType


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


def test_add_list_and_remove_favorite(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "fay@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    add = client.post(f"/favorites/{court_id}", headers=headers)
    assert add.status_code == 204

    listing = client.get("/favorites/mine", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["id"] == court_id

    remove = client.delete(f"/favorites/{court_id}", headers=headers)
    assert remove.status_code == 204

    listing_after = client.get("/favorites/mine", headers=headers)
    assert listing_after.json() == []


def test_add_favorite_twice_is_idempotent(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    court_id = seed_court(session_factory)
    token = register_and_login(client, "gil@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    assert client.post(f"/favorites/{court_id}", headers=headers).status_code == 204
    assert client.post(f"/favorites/{court_id}", headers=headers).status_code == 204

    listing = client.get("/favorites/mine", headers=headers)
    assert len(listing.json()) == 1
