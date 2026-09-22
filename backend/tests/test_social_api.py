from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app


def register_and_login(client: TestClient, email: str) -> tuple[str, str]:
    client.post(
        "/auth/register",
        json={"name": "Player", "email": email, "password": "supersecret"},
    )
    response = client.post(
        "/auth/login", json={"email": email, "password": "supersecret"}
    )
    body = response.json()
    return body["access_token"], body["user"]["id"]


def test_follow_and_unfollow_round_trip(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    _token_a, user_a = register_and_login(client, "a@example.com")
    token_b, user_b = register_and_login(client, "b@example.com")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    follow = client.post(f"/users/{user_a}/follow", headers=headers_b)
    assert follow.status_code == 204

    profile = client.get(f"/users/{user_a}/profile", headers=headers_b).json()
    assert profile["is_following"] is True
    assert profile["followers_count"] == 1

    unfollow = client.delete(f"/users/{user_a}/follow", headers=headers_b)
    assert unfollow.status_code == 204

    profile_after = client.get(f"/users/{user_a}/profile", headers=headers_b).json()
    assert profile_after["is_following"] is False
    assert profile_after["followers_count"] == 0


def test_following_twice_is_idempotent(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    _token_a, user_a = register_and_login(client, "c@example.com")
    token_b, _user_b = register_and_login(client, "d@example.com")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    assert client.post(f"/users/{user_a}/follow", headers=headers_b).status_code == 204
    assert client.post(f"/users/{user_a}/follow", headers=headers_b).status_code == 204

    followers = client.get(f"/users/{user_a}/followers", headers=headers_b).json()
    assert len(followers) == 1


def test_cannot_follow_yourself(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token, user_id = register_and_login(client, "e@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(f"/users/{user_id}/follow", headers=headers)
    assert response.status_code == 400


def test_following_sends_a_notification(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token_a, user_a = register_and_login(client, "f@example.com")
    token_b, _user_b = register_and_login(client, "g@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.post(f"/users/{user_a}/follow", headers=headers_b)

    notifications = client.get("/notifications", headers=headers_a).json()
    assert any(n["type"] == "NEW_FOLLOWER" for n in notifications)


def test_private_profile_hides_bio_and_stats_from_others(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token_a, user_a = register_and_login(client, "h@example.com")
    token_b, _user_b = register_and_login(client, "i@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    update = client.put(
        "/users/me/profile",
        json={"bio": "Weekend tennis player", "profile_public": False},
        headers=headers_a,
    )
    assert update.status_code == 200
    assert update.json()["bio"] == "Weekend tennis player"

    seen_by_owner = client.get(f"/users/{user_a}/profile", headers=headers_a).json()
    assert seen_by_owner["bio"] == "Weekend tennis player"
    assert seen_by_owner["stats"] is not None

    seen_by_other = client.get(f"/users/{user_a}/profile", headers=headers_b).json()
    assert seen_by_other["bio"] is None
    assert seen_by_other["stats"] is None
    assert seen_by_other["profile_public"] is False


def test_getting_an_unknown_players_profile_is_404(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token, _user_id = register_and_login(client, "j@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get(
        "/users/00000000-0000-0000-0000-000000000000/profile", headers=headers
    )
    assert response.status_code == 404
