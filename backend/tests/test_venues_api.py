"""ADR-008: venues own courts; a venue manager manages only their venues."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from support import default_venue_id, make_venue, make_venue_manager

from reservations.main import app
from reservations.models import (
    Court,
    FacilityBlock,
    Reservation,
    ReservationStatus,
    SportType,
    User,
    UserRole,
    VenueManager,
)
from reservations.security import create_access_token, hash_password


def make_user(
    session_factory: sessionmaker, email: str, role: UserRole = UserRole.PLAYER
) -> tuple[uuid.UUID, dict]:
    with session_factory() as session:
        user = User(
            name=email.split("@")[0],
            email=email,
            password_hash=hash_password("supersecret"),
            role=role,
        )
        session.add(user)
        session.commit()
        return user.id, {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def manager_of(
    session_factory: sessionmaker, email: str, venue_id: uuid.UUID
) -> tuple[uuid.UUID, dict]:
    user_id, headers = make_user(session_factory, email)
    with session_factory() as session:
        make_venue_manager(session, session.get(User, user_id), venue_id)
        session.commit()
    return user_id, headers


def two_venues(session_factory: sessionmaker) -> tuple[uuid.UUID, uuid.UUID]:
    with session_factory() as session:
        ids = default_venue_id(session), make_venue(session, "North Hall")
        session.commit()
        return ids


def court_in(
    session_factory: sessionmaker, venue_id: uuid.UUID, name: str
) -> uuid.UUID:
    with session_factory() as session:
        court = Court(venue_id=venue_id, name=name, sport_type=SportType.TENNIS)
        session.add(court)
        session.commit()
        return court.id


def booking_on(
    session_factory: sessionmaker, court_id: uuid.UUID, user_id: uuid.UUID
) -> uuid.UUID:
    start = datetime.now(timezone.utc) + timedelta(days=2)
    with session_factory() as session:
        reservation = Reservation(
            court_id=court_id,
            user_id=user_id,
            start_time=start,
            end_time=start + timedelta(hours=1),
        )
        session.add(reservation)
        session.commit()
        return reservation.id


# --------------------------------------------------------------------- courts


def test_a_manager_edits_only_courts_of_their_own_venue(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, north = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)
    south_court = court_in(session_factory, south, "South 1")
    north_court = court_in(session_factory, north, "North 1")

    assert (
        client.patch(
            f"/courts/{south_court}", json={"indoor": True}, headers=south_manager
        ).status_code
        == 200
    )
    forbidden = client.patch(
        f"/courts/{north_court}", json={"indoor": True}, headers=south_manager
    )
    assert forbidden.status_code == 403
    assert forbidden.json() == {"detail": "You don't manage this venue"}


def test_a_new_court_goes_to_the_managers_only_venue(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, _ = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)

    response = client.post(
        "/courts",
        json={"name": "South 2", "sport_type": "TENNIS"},
        headers=south_manager,
    )

    assert response.status_code == 201
    assert response.json()["venue_id"] == str(south)


def test_creating_a_court_in_a_venue_you_dont_manage_is_forbidden(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, north = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)

    response = client.post(
        "/courts",
        json={"name": "Sneaky", "sport_type": "TENNIS", "venue_id": str(north)},
        headers=south_manager,
    )

    assert response.status_code == 403


def test_with_several_venues_the_venue_must_be_named(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    two_venues(session_factory)
    _, admin = make_user(session_factory, "admin@example.com", UserRole.ADMIN)

    ambiguous = client.post(
        "/courts", json={"name": "X", "sport_type": "TENNIS"}, headers=admin
    )
    assert ambiguous.status_code == 422

    missing = client.post(
        "/courts",
        json={"name": "X", "sport_type": "TENNIS", "venue_id": str(uuid.uuid4())},
        headers=admin,
    )
    assert missing.status_code == 404


def test_a_facility_block_needs_the_courts_venue(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    south, north = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)
    north_court = court_in(session_factory, north, "North 1")
    start = datetime.now(timezone.utc) + timedelta(days=3)

    response = client.post(
        "/facility-blocks",
        json={
            "court_id": str(north_court),
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
            "reason": "Maintenance",
        },
        headers=south_manager,
    )

    assert response.status_code == 403
    with session_factory() as session:
        assert session.query(FacilityBlock).count() == 0


# --------------------------------------------------------------- reservations


def test_the_manager_reservation_list_shows_only_their_venues(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, north = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)
    player_id, _ = make_user(session_factory, "player@example.com")
    south_booking = booking_on(
        session_factory, court_in(session_factory, south, "South 1"), player_id
    )
    booking_on(session_factory, court_in(session_factory, north, "North 1"), player_id)

    listed = client.get("/reservations/admin", headers=south_manager).json()

    assert [r["id"] for r in listed] == [str(south_booking)]


def test_a_manager_cannot_cancel_a_booking_at_another_venue(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, north = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)
    player_id, _ = make_user(session_factory, "player@example.com")
    north_booking = booking_on(
        session_factory, court_in(session_factory, north, "North 1"), player_id
    )

    response = client.post(
        f"/reservations/{north_booking}/cancel", headers=south_manager
    )

    assert response.status_code == 403
    with session_factory() as session:
        assert (
            session.get(Reservation, north_booking).status == ReservationStatus.PENDING
        )


def test_admin_stats_count_only_the_managers_venues(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, north = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)
    _, admin = make_user(session_factory, "admin@example.com", UserRole.ADMIN)
    player_id, _ = make_user(session_factory, "player@example.com")
    booking_on(session_factory, court_in(session_factory, south, "South 1"), player_id)
    booking_on(session_factory, court_in(session_factory, north, "North 1"), player_id)

    manager_stats = client.get("/admin/stats", headers=south_manager).json()
    admin_stats = client.get("/admin/stats", headers=admin).json()

    assert (manager_stats["total_reservations"], manager_stats["total_courts"]) == (
        1,
        1,
    )
    assert (admin_stats["total_reservations"], admin_stats["total_courts"]) == (2, 2)


# ------------------------------------------------------- venues and managers


def test_only_an_admin_creates_venues_and_assigns_managers(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, _ = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)
    _, admin = make_user(session_factory, "admin@example.com", UserRole.ADMIN)
    new_manager_id, _ = make_user(
        session_factory, "new@example.com", UserRole.VENUE_MANAGER
    )

    assert (
        client.post("/venues", json={"name": "West"}, headers=south_manager).status_code
        == 403
    )
    west = client.post(
        "/venues", json={"name": "West", "address": "Main St 1"}, headers=admin
    )
    assert west.status_code == 201
    west_id = west.json()["id"]

    assert (
        client.put(
            f"/venues/{west_id}/managers/{new_manager_id}", headers=south_manager
        ).status_code
        == 403
    )
    assigned = client.put(f"/venues/{west_id}/managers/{new_manager_id}", headers=admin)
    again = client.put(f"/venues/{west_id}/managers/{new_manager_id}", headers=admin)
    assert assigned.status_code == again.status_code == 200
    assert [m["user"]["email"] for m in again.json()] == ["new@example.com"]

    assert (
        client.delete(
            f"/venues/{west_id}/managers/{new_manager_id}", headers=admin
        ).status_code
        == 204
    )
    assert client.get(f"/venues/{west_id}/managers", headers=admin).json() == []


def test_assigning_a_player_to_a_venue_is_refused(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, _ = two_venues(session_factory)
    _, admin = make_user(session_factory, "admin@example.com", UserRole.ADMIN)
    player_id, _ = make_user(session_factory, "player@example.com")

    response = client.put(f"/venues/{south}/managers/{player_id}", headers=admin)

    assert response.status_code == 409


def test_a_manager_edits_their_own_venue_but_not_another(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, north = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)

    own = client.patch(
        f"/venues/{south}", json={"address": "Courtside 5"}, headers=south_manager
    )
    other = client.patch(
        f"/venues/{north}", json={"address": "Hijacked"}, headers=south_manager
    )

    assert own.status_code == 200 and own.json()["address"] == "Courtside 5"
    assert other.status_code == 403
    mine = client.get("/venues/mine", headers=south_manager).json()
    assert [v["id"] for v in mine] == [str(south)]


def test_venues_are_listed_publicly_with_their_active_court_count(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, north = two_venues(session_factory)
    court_in(session_factory, south, "South 1")
    court_in(session_factory, south, "South 2")

    venues = {v["name"]: v["court_count"] for v in client.get("/venues").json()}

    assert venues == {"Test Venue": 2, "North Hall": 0}


def test_demoting_a_manager_drops_their_venue_assignments(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    south, _ = two_venues(session_factory)
    manager_id, _ = manager_of(session_factory, "south@example.com", south)
    _, admin = make_user(session_factory, "admin@example.com", UserRole.ADMIN)

    response = client.patch(
        f"/admin/users/{manager_id}/role", json={"role": "PLAYER"}, headers=admin
    )

    assert response.status_code == 200
    with session_factory() as session:
        assert session.query(VenueManager).filter_by(user_id=manager_id).count() == 0


def test_a_manager_cannot_demote_another_venues_manager(
    session_factory: sessionmaker,
) -> None:
    """Demotion drops venue assignments, so it would lock staff out of a venue
    the caller has no say over."""
    client = TestClient(app)
    south, north = two_venues(session_factory)
    _, south_manager = manager_of(session_factory, "south@example.com", south)
    north_manager_id, _ = manager_of(session_factory, "north@example.com", north)
    colleague_id, _ = manager_of(session_factory, "colleague@example.com", south)

    other = client.patch(
        f"/admin/users/{north_manager_id}/role",
        json={"role": "PLAYER"},
        headers=south_manager,
    )
    own = client.patch(
        f"/admin/users/{colleague_id}/role",
        json={"role": "PLAYER"},
        headers=south_manager,
    )

    assert other.status_code == 403
    assert own.status_code == 200
    with session_factory() as session:
        assert (
            session.query(VenueManager).filter_by(user_id=north_manager_id).count() == 1
        )
