from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, Reservation, ReservationStatus, SportType


def register_and_login(client: TestClient, email: str) -> str:
    client.post("/auth/register", json={"name": "Player", "email": email, "password": "supersecret"})
    response = client.post("/auth/login", json={"email": email, "password": "supersecret"})
    return response.json()["access_token"]


def make_court(session_factory: sessionmaker, name: str, sport: SportType) -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=sport, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def make_confirmed_reservation_in_db(session_factory: sessionmaker, court_id: str, user_id, days_ago: int = 1) -> None:
    with session_factory() as session:
        session.add(
            Reservation(
                court_id=court_id,
                user_id=user_id,
                start_time=datetime.now(timezone.utc) + timedelta(days=days_ago),
                end_time=datetime.now(timezone.utc) + timedelta(days=days_ago, hours=1),
                status=ReservationStatus.CONFIRMED,
            )
        )
        session.commit()


def test_trending_courts_ranks_by_recent_bookings(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "trend@example.com")
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()

    popular = make_court(session_factory, "Popular Court", SportType.TENNIS)
    quiet = make_court(session_factory, "Quiet Court", SportType.TENNIS)
    for i in range(3):
        make_confirmed_reservation_in_db(session_factory, popular, me["id"], days_ago=i + 1)
    make_confirmed_reservation_in_db(session_factory, quiet, me["id"], days_ago=1)

    trending = client.get("/courts/trending").json()
    names = [c["name"] for c in trending]
    assert names[0] == "Popular Court"


def test_recommended_courts_matches_favorite_sport_and_excludes_played(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "rec@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/auth/me", headers=headers).json()

    played_tennis = make_court(session_factory, "Played Tennis Court", SportType.TENNIS)
    make_court(session_factory, "Fresh Tennis Court", SportType.TENNIS)
    make_court(session_factory, "Unrelated Badminton Court", SportType.BADMINTON)

    make_confirmed_reservation_in_db(session_factory, played_tennis, me["id"])
    make_confirmed_reservation_in_db(session_factory, played_tennis, me["id"], days_ago=2)

    recommended = client.get("/courts/recommended", headers=headers).json()
    names = {c["name"] for c in recommended}
    assert "Fresh Tennis Court" in names
    assert "Played Tennis Court" not in names
    assert "Unrelated Badminton Court" not in names
