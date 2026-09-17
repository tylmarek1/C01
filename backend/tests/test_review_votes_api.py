from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, Reservation, ReservationStatus, SportType


def register_and_login(client: TestClient, email: str) -> str:
    client.post("/auth/register", json={"name": "Player", "email": email, "password": "supersecret"})
    response = client.post("/auth/login", json={"email": email, "password": "supersecret"})
    return response.json()["access_token"]


def make_completed_reservation(session_factory: sessionmaker, user_id) -> tuple[str, str]:
    with session_factory() as session:
        court = Court(name="Reviewed Court", sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.flush()
        reservation = Reservation(
            court_id=court.id,
            user_id=user_id,
            start_time=datetime.now(timezone.utc) - timedelta(days=1, hours=2),
            end_time=datetime.now(timezone.utc) - timedelta(days=1, hours=1),
            status=ReservationStatus.COMPLETED,
        )
        session.add(reservation)
        session.commit()
        return str(court.id), str(reservation.id)


def test_toggle_helpful_vote(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    author_token = register_and_login(client, "author@example.com")
    voter_token = register_and_login(client, "voter@example.com")
    author_id = client.get("/auth/me", headers={"Authorization": f"Bearer {author_token}"}).json()["id"]
    _, reservation_id = make_completed_reservation(session_factory, author_id)

    review = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5, "comment": "Loved it"},
        headers={"Authorization": f"Bearer {author_token}"},
    ).json()

    voter_headers = {"Authorization": f"Bearer {voter_token}"}
    first_vote = client.post(f"/reviews/{review['id']}/helpful", headers=voter_headers)
    assert first_vote.status_code == 200
    assert first_vote.json()["helpful_count"] == 1
    assert first_vote.json()["voted_helpful_by_me"] is True

    listing = client.get(f"/courts/{review['court_id']}/reviews", headers=voter_headers).json()
    assert listing[0]["helpful_count"] == 1
    assert listing[0]["voted_helpful_by_me"] is True

    second_vote = client.post(f"/reviews/{review['id']}/helpful", headers=voter_headers)
    assert second_vote.json()["helpful_count"] == 0
    assert second_vote.json()["voted_helpful_by_me"] is False
