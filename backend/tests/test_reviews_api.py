from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, Reservation, ReservationStatus, SportType

PRAGUE = ZoneInfo("Europe/Prague")


def register_and_login(client: TestClient, email: str) -> str:
    client.post(
        "/auth/register",
        json={"name": "Player", "email": email, "password": "supersecret"},
    )
    response = client.post(
        "/auth/login", json={"email": email, "password": "supersecret"}
    )
    return response.json()["access_token"]


def seed_completed_reservation(
    session_factory: sessionmaker, user_id, court_name: str = "Tennis 1"
) -> tuple:
    with session_factory() as session:
        court = Court(name=court_name, sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.flush()
        reservation = Reservation(
            court_id=court.id,
            user_id=user_id,
            start_time=datetime.now(timezone.utc) - timedelta(hours=3),
            end_time=datetime.now(timezone.utc) - timedelta(hours=2),
            status=ReservationStatus.COMPLETED,
        )
        session.add(reservation)
        session.commit()
        return str(court.id), str(reservation.id)


def get_user_id(session_factory: sessionmaker, email: str):
    from reservations.models import User

    with session_factory() as session:
        return session.query(User).filter_by(email=email).one().id


def test_cannot_review_non_completed_reservation(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "amy@example.com")
    user_id = get_user_id(session_factory, "amy@example.com")

    with session_factory() as session:
        court = Court(name="Pending Court", sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.flush()
        reservation = Reservation(
            court_id=court.id,
            user_id=user_id,
            start_time=datetime.now(timezone.utc) + timedelta(days=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
            status=ReservationStatus.CONFIRMED,
        )
        session.add(reservation)
        session.commit()
        reservation_id = str(reservation.id)

    response = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 409


def test_review_completed_reservation_and_list(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "ben@example.com")
    user_id = get_user_id(session_factory, "ben@example.com")
    court_id, reservation_id = seed_completed_reservation(session_factory, user_id)

    response = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 4, "comment": "Great court!"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["rating"] == 4

    listing = client.get(f"/courts/{court_id}/reviews")
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    court_detail = client.get(f"/courts/{court_id}")
    assert court_detail.json()["average_rating"] == 4.0
    assert court_detail.json()["review_count"] == 1


def test_cannot_review_twice(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "cleo@example.com")
    user_id = get_user_id(session_factory, "cleo@example.com")
    _, reservation_id = seed_completed_reservation(session_factory, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers=headers,
    )
    assert first.status_code == 201
    second = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 3},
        headers=headers,
    )
    assert second.status_code == 409


def test_cannot_review_someone_elses_reservation(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    register_and_login(client, "dan@example.com")
    dan_id = get_user_id(session_factory, "dan@example.com")
    _, reservation_id = seed_completed_reservation(session_factory, dan_id)

    other_token = register_and_login(client, "erin@example.com")
    response = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 403


def promote_to_manager(session_factory: sessionmaker, email: str) -> None:
    from reservations.models import User, UserRole

    with session_factory() as session:
        user = session.query(User).filter_by(email=email).one()
        user.role = UserRole.VENUE_MANAGER
        session.commit()


def test_manager_can_reply_to_and_remove_a_reply(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    player_token = register_and_login(client, "fiona@example.com")
    player_id = get_user_id(session_factory, "fiona@example.com")
    court_id, reservation_id = seed_completed_reservation(session_factory, player_id)

    review = client.post(
        "/reviews",
        json={
            "reservation_id": reservation_id,
            "rating": 3,
            "comment": "Court was a bit worn.",
        },
        headers={"Authorization": f"Bearer {player_token}"},
    )
    review_id = review.json()["id"]

    manager_token = register_and_login(client, "manager-reply@example.com")
    promote_to_manager(session_factory, "manager-reply@example.com")

    reply = client.put(
        f"/reviews/{review_id}/reply",
        json={"reply": "Thanks for the feedback, we've resurfaced it since."},
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert reply.status_code == 200
    assert (
        reply.json()["manager_reply"]
        == "Thanks for the feedback, we've resurfaced it since."
    )
    assert reply.json()["manager_reply_at"] is not None

    listing = client.get(f"/courts/{court_id}/reviews")
    assert (
        listing.json()[0]["manager_reply"]
        == "Thanks for the feedback, we've resurfaced it since."
    )

    removed = client.delete(
        f"/reviews/{review_id}/reply",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert removed.status_code == 200
    assert removed.json()["manager_reply"] is None


def test_non_manager_cannot_reply_to_a_review(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    player_token = register_and_login(client, "gabe@example.com")
    player_id = get_user_id(session_factory, "gabe@example.com")
    _, reservation_id = seed_completed_reservation(session_factory, player_id)

    review = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers={"Authorization": f"Bearer {player_token}"},
    )
    review_id = review.json()["id"]

    response = client.put(
        f"/reviews/{review_id}/reply",
        json={"reply": "Nice!"},
        headers={"Authorization": f"Bearer {player_token}"},
    )
    assert response.status_code == 403
