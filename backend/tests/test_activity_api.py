from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, Reservation, ReservationStatus, SportType

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0) -> str:
    day = (datetime.now(PRAGUE) + timedelta(days=3)).date()
    return datetime(
        day.year, day.month, day.day, hour, minute, tzinfo=PRAGUE
    ).isoformat()


def register_and_login(
    client: TestClient, email: str, name: str = "Player"
) -> tuple[str, str]:
    client.post(
        "/auth/register", json={"name": name, "email": email, "password": "supersecret"}
    )
    response = client.post(
        "/auth/login", json={"email": email, "password": "supersecret"}
    )
    body = response.json()
    return body["access_token"], body["user"]["id"]


def seed_court(session_factory: sessionmaker, name: str = "Activity Court") -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def test_feed_only_shows_followees_events_not_your_own_or_strangers(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    viewer_token, _viewer_id = register_and_login(client, "amira@example.com")
    followee_token, followee_id = register_and_login(client, "bram@example.com")
    stranger_token, stranger_id = register_and_login(client, "cleo@example.com")
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    followee_headers = {"Authorization": f"Bearer {followee_token}"}
    stranger_headers = {"Authorization": f"Bearer {stranger_token}"}

    # Empty before following anyone.
    assert client.get("/activity/feed", headers=viewer_headers).json() == []

    client.post(f"/users/{followee_id}/follow", headers=viewer_headers)
    # The follow itself is a feed event for whoever follows *the follower* —
    # have someone follow the viewer's followee to generate a FOLLOWED_PLAYER event.
    client.post(f"/users/{stranger_id}/follow", headers=followee_headers)

    feed = client.get("/activity/feed", headers=viewer_headers).json()
    assert len(feed) == 1
    assert feed[0]["type"] == "FOLLOWED_PLAYER"
    assert feed[0]["user"]["id"] == followee_id
    assert feed[0]["payload"]["followee_id"] == stranger_id

    # The stranger's own actions never appear for a viewer who doesn't follow them.
    client.post(f"/users/{followee_id}/follow", headers=stranger_headers)
    feed_unchanged = client.get("/activity/feed", headers=viewer_headers).json()
    assert len(feed_unchanged) == 1


def test_achievement_unlock_appears_in_a_followers_feed(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    viewer_token, _viewer_id = register_and_login(client, "dax@example.com")
    player_token, player_id = register_and_login(client, "elin@example.com")
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    player_headers = {"Authorization": f"Bearer {player_token}"}

    client.post(f"/users/{player_id}/follow", headers=viewer_headers)

    court_id = seed_court(session_factory, "Achievement Court")
    with session_factory() as session:
        reservation = Reservation(
            court_id=court_id,
            user_id=player_id,
            start_time=datetime.now(timezone.utc) - timedelta(hours=3),
            end_time=datetime.now(timezone.utc) - timedelta(hours=2),
            status=ReservationStatus.COMPLETED,
        )
        session.add(reservation)
        session.commit()

    # Triggers achievements.evaluate_and_award (FIRST_SERVE) via the achievements endpoint.
    client.get("/achievements/mine", headers=player_headers)

    feed = client.get("/activity/feed", headers=viewer_headers).json()
    assert any(
        e["type"] == "ACHIEVEMENT_UNLOCKED"
        and e["payload"]["achievement_key"] == "FIRST_SERVE"
        for e in feed
    )


def test_opening_a_game_appears_in_a_followers_feed(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    viewer_token, _viewer_id = register_and_login(client, "finn@example.com")
    host_token, host_id = register_and_login(client, "gwen@example.com")
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    host_headers = {"Authorization": f"Bearer {host_token}"}

    client.post(f"/users/{host_id}/follow", headers=viewer_headers)

    court_id = seed_court(session_factory, "Open Game Court")
    created = client.post(
        "/reservations",
        json={"court_id": court_id, "start_time": at(18), "end_time": at(19)},
        headers=host_headers,
    ).json()
    client.post(f"/reservations/{created['id']}/confirm", headers=host_headers)

    client.patch(
        f"/reservations/{created['id']}/open",
        json={"open_to_join": True, "open_note": "Need one more!"},
        headers=host_headers,
    )

    feed = client.get("/activity/feed", headers=viewer_headers).json()
    assert any(
        e["type"] == "OPENED_GAME" and e["payload"]["reservation_id"] == created["id"]
        for e in feed
    )


def test_feed_pagination(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    viewer_token, _viewer_id = register_and_login(client, "harper@example.com")
    followee_token, followee_id = register_and_login(client, "ida@example.com")
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    followee_headers = {"Authorization": f"Bearer {followee_token}"}

    client.post(f"/users/{followee_id}/follow", headers=viewer_headers)

    for i in range(3):
        _t, target_id = register_and_login(client, f"target{i}@example.com")
        client.post(f"/users/{target_id}/follow", headers=followee_headers)

    first_page = client.get(
        "/activity/feed", params={"limit": 2}, headers=viewer_headers
    ).json()
    assert len(first_page) == 2

    second_page = client.get(
        "/activity/feed", params={"limit": 2, "offset": 2}, headers=viewer_headers
    ).json()
    assert len(second_page) == 1
    assert {e["id"] for e in first_page}.isdisjoint({e["id"] for e in second_page})
