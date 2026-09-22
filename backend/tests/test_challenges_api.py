from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import (
    Court,
    Reservation,
    ReservationStatus,
    Review,
    SportType,
    User,
    UserRole,
)


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


def promote_to_manager(session_factory: sessionmaker, email: str) -> None:
    with session_factory() as session:
        user = session.query(User).filter_by(email=email).one()
        user.role = UserRole.VENUE_MANAGER
        session.commit()


def seed_court(
    session_factory: sessionmaker, name: str, sport: SportType = SportType.TENNIS
) -> str:
    with session_factory() as session:
        court = Court(name=name, sport_type=sport, indoor=False)
        session.add(court)
        session.commit()
        return str(court.id)


def seed_completed_reservation(
    session_factory: sessionmaker, user_id: str, court_id: str, start_time: datetime
) -> str:
    with session_factory() as session:
        reservation = Reservation(
            court_id=court_id,
            user_id=user_id,
            start_time=start_time,
            end_time=start_time + timedelta(hours=1),
            status=ReservationStatus.COMPLETED,
        )
        session.add(reservation)
        session.commit()
        return str(reservation.id)


def challenge_payload(**overrides) -> dict:
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Autumn push",
        "description": "Play 2 sessions this window.",
        "metric": "RESERVATIONS_COMPLETED",
        "target": 2,
        "starts_at": (now - timedelta(days=7)).isoformat(),
        "ends_at": (now + timedelta(days=7)).isoformat(),
    }
    payload.update(overrides)
    return payload


def test_manager_can_create_a_challenge_player_cannot(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    manager_token, _manager_id = register_and_login(client, "amara@example.com")
    promote_to_manager(session_factory, "amara@example.com")
    player_token, _player_id = register_and_login(client, "bo@example.com")

    forbidden = client.post(
        "/challenges",
        json=challenge_payload(),
        headers={"Authorization": f"Bearer {player_token}"},
    )
    assert forbidden.status_code == 403

    created = client.post(
        "/challenges",
        json=challenge_payload(),
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert created.status_code == 201
    assert created.json()["title"] == "Autumn push"


def test_ends_at_must_be_after_starts_at(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    manager_token, _manager_id = register_and_login(client, "cass@example.com")
    promote_to_manager(session_factory, "cass@example.com")

    now = datetime.now(timezone.utc)
    response = client.post(
        "/challenges",
        json=challenge_payload(
            starts_at=now.isoformat(), ends_at=(now - timedelta(days=1)).isoformat()
        ),
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert response.status_code == 422


def test_reaching_the_target_completes_the_challenge_and_notifies(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    manager_token, _manager_id = register_and_login(client, "dax@example.com")
    promote_to_manager(session_factory, "dax@example.com")
    player_token, player_id = register_and_login(client, "ezra@example.com")
    player_headers = {"Authorization": f"Bearer {player_token}"}

    court_id = seed_court(session_factory, "Challenge Court")
    now = datetime.now(timezone.utc)
    seed_completed_reservation(
        session_factory, player_id, court_id, now - timedelta(days=1)
    )
    seed_completed_reservation(
        session_factory, player_id, court_id, now - timedelta(days=2)
    )

    client.post(
        "/challenges",
        json=challenge_payload(),
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    progress = client.get("/challenges/mine", headers=player_headers).json()
    assert progress[0]["progress"] == 2
    assert progress[0]["completed"] is True

    notifications = client.get("/notifications", headers=player_headers).json()
    assert any(n["type"] == "CHALLENGE_COMPLETED" for n in notifications)

    # Calling /challenges/mine again doesn't duplicate the completion/notification.
    client.get("/challenges/mine", headers=player_headers)
    notifications_after = client.get("/notifications", headers=player_headers).json()
    challenge_notifications = [
        n for n in notifications_after if n["type"] == "CHALLENGE_COMPLETED"
    ]
    assert len(challenge_notifications) == 1


def test_reservations_outside_the_window_do_not_count(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    manager_token, _manager_id = register_and_login(client, "finn@example.com")
    promote_to_manager(session_factory, "finn@example.com")
    player_token, player_id = register_and_login(client, "gia@example.com")

    court_id = seed_court(session_factory, "Outside Window Court")
    now = datetime.now(timezone.utc)
    seed_completed_reservation(
        session_factory, player_id, court_id, now - timedelta(days=30)
    )

    client.post(
        "/challenges",
        json=challenge_payload(),
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    progress = client.get(
        "/challenges/mine", headers={"Authorization": f"Bearer {player_token}"}
    ).json()
    assert progress[0]["progress"] == 0
    assert progress[0]["completed"] is False


def test_challenge_sport_filter_only_counts_matching_sport(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    manager_token, _manager_id = register_and_login(client, "hugo@example.com")
    promote_to_manager(session_factory, "hugo@example.com")
    player_token, player_id = register_and_login(client, "iva@example.com")

    tennis_court = seed_court(session_factory, "Sport Filter Tennis", SportType.TENNIS)
    badminton_court = seed_court(
        session_factory, "Sport Filter Badminton", SportType.BADMINTON
    )
    now = datetime.now(timezone.utc)
    seed_completed_reservation(
        session_factory, player_id, tennis_court, now - timedelta(days=1)
    )
    seed_completed_reservation(
        session_factory, player_id, badminton_court, now - timedelta(days=2)
    )

    client.post(
        "/challenges",
        json=challenge_payload(sport_type="TENNIS", target=1),
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    progress = client.get(
        "/challenges/mine", headers={"Authorization": f"Bearer {player_token}"}
    ).json()
    assert progress[0]["progress"] == 1


def test_reviews_written_metric(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    manager_token, _manager_id = register_and_login(client, "jael@example.com")
    promote_to_manager(session_factory, "jael@example.com")
    player_token, player_id = register_and_login(client, "kit@example.com")

    court_id = seed_court(session_factory, "Review Metric Court")
    now = datetime.now(timezone.utc)
    reservation_id = seed_completed_reservation(
        session_factory, player_id, court_id, now - timedelta(days=1)
    )
    with session_factory() as session:
        session.add(
            Review(
                court_id=court_id,
                user_id=player_id,
                reservation_id=reservation_id,
                rating=5,
            )
        )
        session.commit()

    client.post(
        "/challenges",
        json=challenge_payload(metric="REVIEWS_WRITTEN", target=1),
        headers={"Authorization": f"Bearer {manager_token}"},
    )

    progress = client.get(
        "/challenges/mine", headers={"Authorization": f"Bearer {player_token}"}
    ).json()
    assert progress[0]["progress"] == 1
    assert progress[0]["completed"] is True
