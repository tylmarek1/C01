from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.models import Court, Reservation, ReservationStatus, SportType, User

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0) -> str:
    day = (datetime.now(PRAGUE) + timedelta(days=3)).date()
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=PRAGUE).isoformat()


def register_and_login(client: TestClient, email: str) -> str:
    client.post("/auth/register", json={"name": "Player", "email": email, "password": "supersecret"})
    response = client.post("/auth/login", json={"email": email, "password": "supersecret"})
    return response.json()["access_token"]


def test_repeat_no_shows_block_new_booking(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register_and_login(client, "rex@example.com")

    with session_factory() as session:
        user = session.query(User).filter_by(email="rex@example.com").one()
        court = Court(name="No Show Test Court", sport_type=SportType.TENNIS, indoor=False)
        session.add(court)
        session.flush()
        court_id = court.id
        for i in range(3):
            session.add(
                Reservation(
                    court_id=court.id,
                    user_id=user.id,
                    start_time=datetime.now(timezone.utc) - timedelta(days=i + 1, hours=2),
                    end_time=datetime.now(timezone.utc) - timedelta(days=i + 1, hours=1),
                    status=ReservationStatus.NO_SHOW,
                )
            )
        session.commit()

    response = client.post(
        "/reservations",
        json={"court_id": str(court_id), "start_time": at(18), "end_time": at(19)},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409
    assert "no-show" in response.json()["detail"].lower()
