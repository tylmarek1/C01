import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import sessionmaker

from reservations.main import app


def test_register_then_me(session_factory: sessionmaker) -> None:
    client = TestClient(app)

    response = client.post(
        "/auth/register",
        json={"name": "Alice", "email": "alice@example.com", "password": "supersecret"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["role"] == "PLAYER"

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"


def test_me_without_token_is_rejected(session_factory: sessionmaker) -> None:
    response = TestClient(app).get("/auth/me")
    assert response.status_code == 401


def test_register_duplicate_email_rejected(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    payload = {"name": "Bob", "email": "bob@example.com", "password": "supersecret"}

    assert client.post("/auth/register", json=payload).status_code == 201
    assert client.post("/auth/register", json=payload).status_code == 409


def test_login_wrong_password_rejected(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    client.post(
        "/auth/register",
        json={"name": "Carl", "email": "carl@example.com", "password": "supersecret"},
    )

    response = client.post("/auth/login", json={"email": "carl@example.com", "password": "wrong-password"})

    assert response.status_code == 401


def test_login_success_returns_token(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    client.post(
        "/auth/register",
        json={"name": "Dana", "email": "dana@example.com", "password": "supersecret"},
    )

    response = client.post("/auth/login", json={"email": "dana@example.com", "password": "supersecret"})

    assert response.status_code == 200
    assert response.json()["access_token"]


def _register(client: TestClient, email: str) -> str:
    response = client.post(
        "/auth/register",
        json={"name": "Original Name", "email": email, "password": "supersecret"},
    )
    return response.json()["access_token"]


def test_update_profile_changes_name(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = _register(client, "liam@example.com")

    response = client.patch(
        "/auth/me", json={"name": "Liam Updated"}, headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Liam Updated"


def test_update_profile_requires_auth(session_factory: sessionmaker) -> None:
    response = TestClient(app).patch("/auth/me", json={"name": "Nope"})
    assert response.status_code == 401


def test_upload_avatar_compresses_and_stores_image(
    session_factory: sessionmaker, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("reservations.images.settings.upload_dir", tmp_path)
    client = TestClient(app)
    token = _register(client, "maya@example.com")

    buffer = io.BytesIO()
    Image.new("RGB", (1000, 1000), color=(10, 20, 200)).save(buffer, format="JPEG")
    buffer.seek(0)

    response = client.post(
        "/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("avatar.jpg", buffer, "image/jpeg")},
    )

    assert response.status_code == 200
    avatar_url = response.json()["avatar_url"]
    assert avatar_url.startswith("/static/avatars/")

    stored_file = tmp_path / "avatars" / avatar_url.rsplit("/", 1)[-1]
    assert stored_file.exists()
    with Image.open(stored_file) as stored_image:
        assert stored_image.size == (512, 512)


def test_upload_avatar_rejects_non_image(
    session_factory: sessionmaker, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("reservations.images.settings.upload_dir", tmp_path)
    client = TestClient(app)
    token = _register(client, "noah@example.com")

    response = client.post(
        "/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("notes.txt", io.BytesIO(b"not an image"), "text/plain")},
    )

    assert response.status_code == 400
