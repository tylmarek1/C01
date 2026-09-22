import io
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from PIL import Image
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


def _tiny_jpeg() -> io.BytesIO:
    buffer = io.BytesIO()
    Image.new("RGB", (400, 300), color=(20, 90, 200)).save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer


def test_author_can_add_and_remove_review_photos(
    session_factory: sessionmaker, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("reservations.images.settings.upload_dir", tmp_path)
    client = TestClient(app)
    token = register_and_login(client, "hana@example.com")
    user_id = get_user_id(session_factory, "hana@example.com")
    _, reservation_id = seed_completed_reservation(session_factory, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    review_id = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers=headers,
    ).json()["id"]

    added = client.post(
        f"/reviews/{review_id}/images",
        headers=headers,
        files={"file": ("photo.jpg", _tiny_jpeg(), "image/jpeg")},
    )
    assert added.status_code == 201
    images = added.json()["images"]
    assert len(images) == 1
    assert images[0]["url"].startswith("/static/reviews/")

    listing = client.get(f"/courts/{added.json()['court_id']}/reviews").json()
    assert len(listing[0]["images"]) == 1

    image_id = images[0]["id"]
    removed = client.delete(f"/reviews/{review_id}/images/{image_id}", headers=headers)
    assert removed.status_code == 200
    assert removed.json()["images"] == []


def test_review_photos_are_capped(
    session_factory: sessionmaker, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("reservations.images.settings.upload_dir", tmp_path)
    from reservations.api.reviews import MAX_REVIEW_IMAGES

    client = TestClient(app)
    token = register_and_login(client, "ivy@example.com")
    user_id = get_user_id(session_factory, "ivy@example.com")
    _, reservation_id = seed_completed_reservation(session_factory, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    review_id = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers=headers,
    ).json()["id"]

    for _ in range(MAX_REVIEW_IMAGES):
        response = client.post(
            f"/reviews/{review_id}/images",
            headers=headers,
            files={"file": ("photo.jpg", _tiny_jpeg(), "image/jpeg")},
        )
        assert response.status_code == 201

    over_limit = client.post(
        f"/reviews/{review_id}/images",
        headers=headers,
        files={"file": ("photo.jpg", _tiny_jpeg(), "image/jpeg")},
    )
    assert over_limit.status_code == 400


def test_only_the_author_can_manage_review_photos(
    session_factory: sessionmaker, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("reservations.images.settings.upload_dir", tmp_path)
    client = TestClient(app)
    author_token = register_and_login(client, "jack@example.com")
    author_id = get_user_id(session_factory, "jack@example.com")
    _, reservation_id = seed_completed_reservation(session_factory, author_id)

    review_id = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers={"Authorization": f"Bearer {author_token}"},
    ).json()["id"]

    other_token = register_and_login(client, "kim@example.com")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    upload = client.post(
        f"/reviews/{review_id}/images",
        headers=other_headers,
        files={"file": ("photo.jpg", _tiny_jpeg(), "image/jpeg")},
    )
    assert upload.status_code == 403

    added = client.post(
        f"/reviews/{review_id}/images",
        headers={"Authorization": f"Bearer {author_token}"},
        files={"file": ("photo.jpg", _tiny_jpeg(), "image/jpeg")},
    )
    image_id = added.json()["images"][0]["id"]

    delete = client.delete(
        f"/reviews/{review_id}/images/{image_id}", headers=other_headers
    )
    assert delete.status_code == 403


def test_deleting_a_review_with_photos_does_not_error(
    session_factory: sessionmaker, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("reservations.images.settings.upload_dir", tmp_path)
    client = TestClient(app)
    token = register_and_login(client, "liam@example.com")
    user_id = get_user_id(session_factory, "liam@example.com")
    _, reservation_id = seed_completed_reservation(session_factory, user_id)
    headers = {"Authorization": f"Bearer {token}"}

    review_id = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers=headers,
    ).json()["id"]
    client.post(
        f"/reviews/{review_id}/images",
        headers=headers,
        files={"file": ("photo.jpg", _tiny_jpeg(), "image/jpeg")},
    )

    response = client.delete(f"/reviews/{review_id}", headers=headers)
    assert response.status_code == 204


def test_anyone_can_comment_on_a_review(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    author_token = register_and_login(client, "mia@example.com")
    author_id = get_user_id(session_factory, "mia@example.com")
    _, reservation_id = seed_completed_reservation(
        session_factory, author_id, "Mia Court"
    )
    review_id = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers={"Authorization": f"Bearer {author_token}"},
    ).json()["id"]

    commenter_token = register_and_login(client, "noah@example.com")
    commenter_headers = {"Authorization": f"Bearer {commenter_token}"}

    add = client.post(
        f"/reviews/{review_id}/comments",
        json={"body": "Totally agree!"},
        headers=commenter_headers,
    )
    assert add.status_code == 201
    assert add.json()["body"] == "Totally agree!"
    assert add.json()["user"]["email"] == "noah@example.com"

    listing = client.get(f"/reviews/{review_id}/comments", headers=commenter_headers)
    assert len(listing.json()) == 1


def test_review_out_reports_comment_count(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "olga@example.com")
    user_id = get_user_id(session_factory, "olga@example.com")
    court_id, reservation_id = seed_completed_reservation(
        session_factory, user_id, "Olga Court"
    )
    headers = {"Authorization": f"Bearer {token}"}
    review_id = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers=headers,
    ).json()["id"]

    client.post(
        f"/reviews/{review_id}/comments", json={"body": "Nice!"}, headers=headers
    )
    client.post(
        f"/reviews/{review_id}/comments", json={"body": "Agreed!"}, headers=headers
    )

    listing = client.get(f"/courts/{court_id}/reviews").json()
    assert listing[0]["comment_count"] == 2


def test_only_the_comment_author_or_admin_can_delete_a_comment(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    author_token = register_and_login(client, "pavel@example.com")
    author_id = get_user_id(session_factory, "pavel@example.com")
    _, reservation_id = seed_completed_reservation(
        session_factory, author_id, "Pavel Court"
    )
    review_id = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers={"Authorization": f"Bearer {author_token}"},
    ).json()["id"]

    commenter_token = register_and_login(client, "quinn@example.com")
    commenter_headers = {"Authorization": f"Bearer {commenter_token}"}
    comment_id = client.post(
        f"/reviews/{review_id}/comments",
        json={"body": "My take"},
        headers=commenter_headers,
    ).json()["id"]

    forbidden = client.delete(
        f"/reviews/{review_id}/comments/{comment_id}",
        headers={"Authorization": f"Bearer {author_token}"},
    )
    assert forbidden.status_code == 403

    allowed = client.delete(
        f"/reviews/{review_id}/comments/{comment_id}", headers=commenter_headers
    )
    assert allowed.status_code == 204


def test_deleting_a_review_with_votes_and_comments_does_not_error(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    author_token = register_and_login(client, "rosa@example.com")
    author_id = get_user_id(session_factory, "rosa@example.com")
    _, reservation_id = seed_completed_reservation(
        session_factory, author_id, "Rosa Court"
    )
    author_headers = {"Authorization": f"Bearer {author_token}"}
    review_id = client.post(
        "/reviews",
        json={"reservation_id": reservation_id, "rating": 5},
        headers=author_headers,
    ).json()["id"]

    voter_token = register_and_login(client, "sam@example.com")
    voter_headers = {"Authorization": f"Bearer {voter_token}"}
    client.post(f"/reviews/{review_id}/helpful", headers=voter_headers)
    client.post(
        f"/reviews/{review_id}/comments",
        json={"body": "Nice one"},
        headers=voter_headers,
    )

    response = client.delete(f"/reviews/{review_id}", headers=author_headers)
    assert response.status_code == 204
