"""C01 engineering spike A: Reservation -> real PostgreSQL -> load -> verify.

See docs/evidence-and-evolution.md for the question, result and decision.
"""

import threading
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from psycopg.errors import ExclusionViolation
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from reservations.models import Court, Reservation, ReservationStatus, SportType, User

PRAGUE = ZoneInfo("Europe/Prague")


def at(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, 2, hour, minute, tzinfo=PRAGUE)


def seed_court_and_user(session_factory: sessionmaker) -> tuple[Court, User]:
    with session_factory() as session:
        court = Court(name="Tennis 1", sport_type=SportType.TENNIS, indoor=False)
        user = User(name="Alice Player", email="alice@example.com", password_hash="not-a-real-hash")
        session.add_all([court, user])
        session.commit()
        return court, user


def reservation(court: Court, user: User, start: datetime, end: datetime, status: ReservationStatus) -> Reservation:
    return Reservation(court_id=court.id, user_id=user.id, start_time=start, end_time=end, status=status)


def test_reservation_roundtrip(session_factory: sessionmaker) -> None:
    court, user = seed_court_and_user(session_factory)
    with session_factory() as session:
        saved = reservation(court, user, at(18), at(19, 30), ReservationStatus.CONFIRMED)
        session.add(saved)
        session.commit()
        reservation_id = saved.id

    # A brand-new session, so the data really comes from the database, not the identity map.
    with session_factory() as session:
        loaded = session.get(Reservation, reservation_id)

        assert loaded is not None
        assert loaded.court_id == court.id
        assert loaded.user_id == user.id
        assert loaded.court.sport_type is SportType.TENNIS
        assert loaded.status is ReservationStatus.CONFIRMED
        assert loaded.start_time.tzinfo is not None
        assert loaded.start_time == at(18)  # same instant, regardless of returned tz
        assert loaded.end_time == at(19, 30)
        assert loaded.created_at is not None


def test_db_rejects_overlapping_confirmed(session_factory: sessionmaker) -> None:
    court, user = seed_court_and_user(session_factory)
    with session_factory() as session:
        session.add(reservation(court, user, at(18), at(19, 30), ReservationStatus.CONFIRMED))
        session.commit()

    with session_factory() as session:
        session.add(reservation(court, user, at(19), at(20), ReservationStatus.CONFIRMED))
        with pytest.raises(IntegrityError) as exc_info:
            session.commit()
        assert isinstance(exc_info.value.orig, ExclusionViolation)

    with session_factory() as session:
        # A CANCELLED reservation no longer holds the slot, so it can overlap
        # freely; back-to-back CONFIRMED is still fine ([) ranges).
        session.add(reservation(court, user, at(19), at(20), ReservationStatus.CANCELLED))
        session.add(reservation(court, user, at(19, 30), at(21), ReservationStatus.CONFIRMED))
        session.commit()

    with session_factory() as session:
        # PENDING is a temporary hold, not a draft — it occupies the slot
        # exactly like CONFIRMED, so it collides too.
        session.add(reservation(court, user, at(19, 30), at(20, 30), ReservationStatus.PENDING))
        with pytest.raises(IntegrityError) as exc_info:
            session.commit()
        assert isinstance(exc_info.value.orig, ExclusionViolation)


def test_concurrent_confirmations_only_one_wins(session_factory: sessionmaker) -> None:
    """Q pressure: 10 players confirm the same slot at the same moment."""
    court, user = seed_court_and_user(session_factory)
    attempts = 10
    barrier = threading.Barrier(attempts)
    outcomes: list[str] = []
    lock = threading.Lock()

    def attempt() -> None:
        with session_factory() as session:
            session.add(reservation(court, user, at(18), at(19), ReservationStatus.CONFIRMED))
            barrier.wait()
            try:
                session.commit()
                result = "ok"
            except IntegrityError as exc:
                result = type(exc.orig).__name__
        with lock:
            outcomes.append(result)

    threads = [threading.Thread(target=attempt) for _ in range(attempts)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    print(f"\nconcurrent outcomes: {sorted(outcomes)}")
    assert outcomes.count("ok") == 1
    assert outcomes.count("ExclusionViolation") == attempts - 1
