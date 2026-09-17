from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, Reservation, ReservationStatus, SportType


def register_and_login(client: TestClient, email: str) -> str:
    client.post("/auth/register", json={"name": "Player", "email": email, "password": "supersecret"})
    response = client.post("/auth/login", json={"email": email, "password": "supersecret"})
    return response.json()["access_token"]


def make_completed_reservation(session_factory: sessionmaker, user_id, court_name: str, sport: SportType) -> None:
    with session_factory() as session:
        court = Court(name=court_name, sport_type=sport, indoor=False)
        session.add(court)
        session.flush()
        session.add(
            Reservation(
                court_id=court.id,
                user_id=user_id,
                start_time=datetime.now(timezone.utc) - timedelta(days=1, hours=2),
                end_time=datetime.now(timezone.utc) - timedelta(days=1, hours=1),
                status=ReservationStatus.COMPLETED,
            )
        )
        session.commit()


def test_achievement_catalog_is_public(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    response = client.get("/achievements")
    assert response.status_code == 200
    keys = {a["key"] for a in response.json()}
    assert "FIRST_SERVE" in keys
    assert all(a["earned_at"] is None for a in response.json())


def test_completing_a_reservation_unlocks_first_serve(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "ash@example.com")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()

    make_completed_reservation(session_factory, me["id"], "Achv Court 1", SportType.TENNIS)

    mine = client.get("/achievements/mine", headers={"Authorization": f"Bearer {token}"})
    assert mine.status_code == 200
    first_serve = next(a for a in mine.json() if a["key"] == "FIRST_SERVE")
    assert first_serve["earned_at"] is not None
    assert first_serve["unlocked"] is True

    notifications = client.get("/notifications", headers={"Authorization": f"Bearer {token}"}).json()
    assert any(n["type"] == "ACHIEVEMENT_UNLOCKED" for n in notifications)


def test_player_stats_reflect_history(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "bea@example.com")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()

    make_completed_reservation(session_factory, me["id"], "Stats Tennis", SportType.TENNIS)
    make_completed_reservation(session_factory, me["id"], "Stats Volleyball", SportType.VOLLEYBALL)

    stats = client.get("/stats/me", headers={"Authorization": f"Bearer {token}"})
    assert stats.status_code == 200
    body = stats.json()
    assert body["completed_reservations"] == 2
    assert body["distinct_courts_played"] == 2
    assert body["sports_played"] == 2
    assert body["hours_played"] == 2.0


def test_leaderboard_ranks_by_completed_reservations(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "cy@example.com")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()

    make_completed_reservation(session_factory, me["id"], "Leader Court 1", SportType.BADMINTON)
    make_completed_reservation(session_factory, me["id"], "Leader Court 2", SportType.BADMINTON)

    leaderboard = client.get("/stats/leaderboard", headers={"Authorization": f"Bearer {token}"})
    assert leaderboard.status_code == 200
    entry = next(e for e in leaderboard.json() if e["user"]["id"] == me["id"])
    assert entry["completed_reservations"] == 2
    assert entry["rank"] >= 1
