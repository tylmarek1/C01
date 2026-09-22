import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import (
    Court,
    Reservation,
    ReservationGuest,
    ReservationStatus,
    SportType,
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


def seed_completed_reservation(
    session_factory: sessionmaker,
    booker_id: str,
    guest_ids: list[str],
    court_name: str = "Rating Court",
    sport: SportType = SportType.TENNIS,
) -> str:
    with session_factory() as session:
        court = Court(name=court_name, sport_type=sport, indoor=False)
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


def test_reporting_a_result_updates_both_players_ratings(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "amir@example.com")
    guest_token, guest_id = register_and_login(client, "bea@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    reservation_id = seed_completed_reservation(session_factory, booker_id, [guest_id])
    reported = client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers=booker_headers,
    )
    assert reported.status_code == 201

    booker_rating = client.get("/ratings/me", headers=booker_headers).json()
    guest_rating = client.get(
        "/ratings/me", headers={"Authorization": f"Bearer {guest_token}"}
    ).json()

    assert booker_rating[0]["rating"] > 1000
    assert guest_rating[0]["rating"] < 1000
    assert booker_rating[0]["matches_played"] == 1
    assert guest_rating[0]["matches_played"] == 1


def test_a_draw_updates_matches_played_but_keeps_ratings_close(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "cleo@example.com")
    _guest_token, guest_id = register_and_login(client, "dev@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    reservation_id = seed_completed_reservation(session_factory, booker_id, [guest_id])
    reported = client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": None},
        headers=booker_headers,
    )
    assert reported.status_code == 201
    assert reported.json()["winner_user_id"] is None

    booker_rating = client.get("/ratings/me", headers=booker_headers).json()[0]
    assert booker_rating["rating"] == 1000
    assert booker_rating["matches_played"] == 1


def test_a_group_reservation_cannot_be_rated(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "eli@example.com")
    _t1, guest_a = register_and_login(client, "fay@example.com")
    _t2, guest_b = register_and_login(client, "gus@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    reservation_id = seed_completed_reservation(
        session_factory, booker_id, [guest_a, guest_b]
    )
    response = client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers=booker_headers,
    )
    assert response.status_code == 409


def test_a_solo_reservation_without_a_guest_cannot_be_rated(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "hana@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    reservation_id = seed_completed_reservation(session_factory, booker_id, [])
    response = client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers=booker_headers,
    )
    assert response.status_code == 409


def test_only_a_participant_can_report_a_result(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "ivo@example.com")
    _t1, guest_id = register_and_login(client, "joy@example.com")
    stranger_token, _stranger_id = register_and_login(client, "kai@example.com")

    reservation_id = seed_completed_reservation(session_factory, booker_id, [guest_id])
    response = client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers={"Authorization": f"Bearer {stranger_token}"},
    )
    assert response.status_code == 403


def test_cannot_report_a_result_twice(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "lia@example.com")
    _t1, guest_id = register_and_login(client, "milo@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    reservation_id = seed_completed_reservation(session_factory, booker_id, [guest_id])
    client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers=booker_headers,
    )
    again = client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers=booker_headers,
    )
    assert again.status_code == 409


def test_winner_must_be_a_participant(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "nia@example.com")
    _t1, guest_id = register_and_login(client, "omi@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    reservation_id = seed_completed_reservation(session_factory, booker_id, [guest_id])
    response = client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": str(uuid.uuid4())},
        headers=booker_headers,
    )
    assert response.status_code == 400


def test_cannot_report_before_the_reservation_is_completed(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "pax@example.com")
    _t1, guest_id = register_and_login(client, "quo@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    with session_factory() as session:
        court = Court(name="Not Yet Court", sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.flush()
        reservation = Reservation(
            court_id=court.id,
            user_id=booker_id,
            start_time=datetime.now(timezone.utc) + timedelta(days=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
            status=ReservationStatus.CONFIRMED,
        )
        session.add(reservation)
        session.flush()
        session.add(
            ReservationGuest(
                reservation_id=reservation.id, user_id=guest_id, invited_by_id=booker_id
            )
        )
        session.commit()
        reservation_id = str(reservation.id)

    response = client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers=booker_headers,
    )
    assert response.status_code == 409


def test_reporting_notifies_the_other_participant(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "ren@example.com")
    guest_token, guest_id = register_and_login(client, "sky@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    reservation_id = seed_completed_reservation(session_factory, booker_id, [guest_id])
    client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers=booker_headers,
    )

    notifications = client.get(
        "/notifications", headers={"Authorization": f"Bearer {guest_token}"}
    ).json()
    assert any(n["type"] == "MATCH_RESULT_REPORTED" for n in notifications)


def test_leaderboard_ranks_by_rating_descending(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    strong_token, strong_id = register_and_login(client, "tia@example.com")
    weak_token, weak_id = register_and_login(client, "uri@example.com")
    strong_headers = {"Authorization": f"Bearer {strong_token}"}

    reservation_id = seed_completed_reservation(session_factory, strong_id, [weak_id])
    client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": strong_id},
        headers=strong_headers,
    )

    leaderboard = client.get(
        "/ratings/leaderboard", params={"sport": "TENNIS"}, headers=strong_headers
    ).json()
    ranked_ids = [entry["user"]["id"] for entry in leaderboard]
    assert ranked_ids.index(strong_id) < ranked_ids.index(weak_id)
    assert leaderboard[0]["rank"] == 1


def test_a_players_rating_appears_on_their_public_profile(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    booker_token, booker_id = register_and_login(client, "vex@example.com")
    _t1, guest_id = register_and_login(client, "wes@example.com")
    booker_headers = {"Authorization": f"Bearer {booker_token}"}

    reservation_id = seed_completed_reservation(session_factory, booker_id, [guest_id])
    client.post(
        f"/reservations/{reservation_id}/result",
        json={"winner_user_id": booker_id},
        headers=booker_headers,
    )

    profile = client.get(f"/users/{booker_id}/profile", headers=booker_headers).json()
    ratings = profile["stats"]["ratings"]
    assert len(ratings) == 1
    assert ratings[0]["sport_type"] == "TENNIS"
    assert ratings[0]["matches_played"] == 1
