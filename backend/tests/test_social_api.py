from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import (
    Court,
    MatchResult,
    Reservation,
    ReservationGuest,
    ReservationStatus,
    SportType,
)


def seed_completed_reservation(
    session_factory: sessionmaker,
    booker_id: str,
    guest_ids: list[str],
    court_name: str = "Recent Games Court",
) -> str:
    with session_factory() as session:
        court = Court(name=court_name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.flush()
        reservation = Reservation(
            court_id=court.id,
            user_id=booker_id,
            start_time=datetime.now(timezone.utc) - timedelta(hours=3),
            end_time=datetime.now(timezone.utc) - timedelta(hours=2),
            status=ReservationStatus.COMPLETED,
        )
        session.add(reservation)
        session.flush()
        for guest_id in guest_ids:
            session.add(
                ReservationGuest(
                    reservation_id=reservation.id,
                    user_id=guest_id,
                    invited_by_id=booker_id,
                )
            )
        session.commit()
        return str(reservation.id)


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


def register_named(client: TestClient, name: str, email: str) -> tuple[str, str]:
    client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "supersecret"},
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


def test_search_players_matches_public_profile_by_name(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token, _user_id = register_named(client, "Searcher", "k@example.com")
    register_named(client, "Zdenka Novotna", "l@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    results = client.get("/users/search?q=Zdenka", headers=headers).json()
    assert [r["name"] for r in results] == ["Zdenka Novotna"]


def test_search_players_excludes_self(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token, _user_id = register_named(client, "Sam Self", "m@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    results = client.get("/users/search?q=Sam", headers=headers).json()
    assert results == []


def test_search_players_hides_private_profile_from_name_search_but_email_still_resolves(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token_a, _user_a = register_named(client, "Private Pavel", "n@example.com")
    token_b, _user_b = register_named(client, "Searcher Two", "o@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.put("/users/me/profile", json={"profile_public": False}, headers=headers_a)

    by_name = client.get("/users/search?q=Pavel", headers=headers_b).json()
    assert by_name == []

    by_email = client.get("/users/search?q=n@example.com", headers=headers_b).json()
    assert [r["name"] for r in by_email] == ["Private Pavel"]


def test_search_players_requires_at_least_two_characters(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token, _user_id = register_named(client, "Searcher Three", "p@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/users/search?q=a", headers=headers).json() == []
    assert client.get("/users/search?q=", headers=headers).json() == []


def test_profile_shows_recent_completed_matches_with_opponent_and_result(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token_a, user_a = register_named(client, "Rex Recent", "q@example.com")
    _token_b, user_b = register_named(client, "Sable Opponent", "r@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    reservation_id = seed_completed_reservation(session_factory, user_a, [user_b])
    with session_factory() as session:
        session.add(
            MatchResult(
                reservation_id=reservation_id,
                reported_by=user_a,
                winner_user_id=user_a,
            )
        )
        session.commit()

    profile = client.get(f"/users/{user_a}/profile", headers=headers_a).json()
    matches = profile["stats"]["recent_matches"]
    assert len(matches) == 1
    assert matches[0]["reservation_id"] == reservation_id
    assert matches[0]["court_name"] == "Recent Games Court"
    assert matches[0]["opponent"]["name"] == "Sable Opponent"
    assert matches[0]["result"] == "win"

    # The opponent's own profile shows the mirrored loss.
    opponent_profile = client.get(f"/users/{user_b}/profile", headers=headers_a).json()
    assert opponent_profile["stats"]["recent_matches"][0]["result"] == "loss"


def test_recent_matches_empty_for_no_completed_games(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token, user_id = register_named(client, "No Games", "s@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    profile = client.get(f"/users/{user_id}/profile", headers=headers).json()
    assert profile["stats"]["recent_matches"] == []


def test_recent_matches_hidden_for_a_private_profile(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token_a, user_a = register_named(client, "Private Rex", "u@example.com")
    token_b, user_b = register_named(client, "Viewer", "v@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    seed_completed_reservation(session_factory, user_a, [user_b])
    client.put("/users/me/profile", json={"profile_public": False}, headers=headers_a)

    profile = client.get(f"/users/{user_a}/profile", headers=headers_b).json()
    assert profile["stats"] is None
