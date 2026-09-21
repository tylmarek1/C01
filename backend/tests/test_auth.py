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

    me = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
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

    response = client.post(
        "/auth/login", json={"email": "carl@example.com", "password": "wrong-password"}
    )

    assert response.status_code == 401


def test_login_success_returns_token(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    client.post(
        "/auth/register",
        json={"name": "Dana", "email": "dana@example.com", "password": "supersecret"},
    )

    response = client.post(
        "/auth/login", json={"email": "dana@example.com", "password": "supersecret"}
    )

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
        "/auth/me",
        json={"name": "Liam Updated"},
        headers={"Authorization": f"Bearer {token}"},
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


def test_login_is_rate_limited_after_repeated_failures(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    client.post(
        "/auth/register",
        json={"name": "Eve", "email": "eve@example.com", "password": "supersecret"},
    )

    for _ in range(10):
        response = client.post(
            "/auth/login",
            json={"email": "eve@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    limited = client.post(
        "/auth/login", json={"email": "eve@example.com", "password": "wrong-password"}
    )
    assert limited.status_code == 429

    # A correct password is blocked too while the window is exhausted —
    # the limiter can't tell "attacker" from "user who forgot" apart.
    still_limited = client.post(
        "/auth/login", json={"email": "eve@example.com", "password": "supersecret"}
    )
    assert still_limited.status_code == 429


def test_login_success_resets_the_rate_limit(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    client.post(
        "/auth/register",
        json={"name": "Frank", "email": "frank@example.com", "password": "supersecret"},
    )

    for _ in range(5):
        assert (
            client.post(
                "/auth/login",
                json={"email": "frank@example.com", "password": "wrong-password"},
            ).status_code
            == 401
        )

    success = client.post(
        "/auth/login", json={"email": "frank@example.com", "password": "supersecret"}
    )
    assert success.status_code == 200

    # The successful login reset the window, so a fresh mistake right after
    # isn't treated as the 7th attempt in the same window.
    retry = client.post(
        "/auth/login", json={"email": "frank@example.com", "password": "wrong-password"}
    )
    assert retry.status_code == 401


def test_register_is_rate_limited_per_ip(session_factory: sessionmaker) -> None:
    client = TestClient(app)

    for i in range(10):
        response = client.post(
            "/auth/register",
            json={
                "name": "Bot",
                "email": f"bot{i}@example.com",
                "password": "supersecret",
            },
        )
        assert response.status_code == 201

    limited = client.post(
        "/auth/register",
        json={
            "name": "Bot",
            "email": "bot-overflow@example.com",
            "password": "supersecret",
        },
    )
    assert limited.status_code == 429


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


def test_upload_avatar_rejects_oversized_pixel_dimensions(
    session_factory: sessionmaker, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A real decompression-bomb file (tiny bytes, huge claimed dimensions)
    # isn't worth constructing here — patching the cap far below an
    # ordinary test image's size exercises the same guard cheaply.
    monkeypatch.setattr("reservations.images.settings.upload_dir", tmp_path)
    monkeypatch.setattr("reservations.images.MAX_IMAGE_PIXELS", 100)
    client = TestClient(app)
    token = _register(client, "olive@example.com")

    buffer = io.BytesIO()
    Image.new("RGB", (200, 200), color=(10, 20, 200)).save(buffer, format="JPEG")
    buffer.seek(0)

    response = client.post(
        "/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("big.jpg", buffer, "image/jpeg")},
    )

    assert response.status_code == 400
