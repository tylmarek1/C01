import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy.orm import sessionmaker

from reservations import worker
from reservations.models import (
    Court,
    Notification,
    Reservation,
    ReservationStatus,
    SportType,
    User,
    UserRole,
    WaitlistEntry,
    WaitlistStatus,
)
from reservations.security import hash_password

PRAGUE = ZoneInfo("Europe/Prague")


def make_user(session, email: str) -> User:
    user = User(
        name="Test User",
        email=email,
        password_hash=hash_password("supersecret"),
        role=UserRole.PLAYER,
    )
    session.add(user)
    session.flush()
    return user


def make_court(session, name: str) -> Court:
    court = Court(name=name, sport_type=SportType.TENNIS, indoor=False)
    session.add(court)
    session.flush()
    return court


def test_worker_expires_stale_pending_holds(session_factory: sessionmaker) -> None:
    with session_factory() as session:
        user = make_user(session, "hold-expire@example.com")
        court = make_court(session, "Hold Court")
        reservation = Reservation(
            court_id=court.id,
            user_id=user.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
            status=ReservationStatus.PENDING,
            hold_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        session.add(reservation)
        session.commit()
        reservation_id = reservation.id
        user_id = user.id

    worker.tick(session_factory)

    with session_factory() as session:
        refreshed = session.get(Reservation, reservation_id)
        assert refreshed.status == ReservationStatus.EXPIRED
        notifications = session.query(Notification).filter_by(user_id=user_id).all()
        assert any(n.type.value == "RESERVATION_EXPIRED" for n in notifications)


def test_worker_completes_past_checked_in_reservations(
    session_factory: sessionmaker,
) -> None:
    with session_factory() as session:
        user = make_user(session, "auto-complete@example.com")
        court = make_court(session, "Complete Court")
        reservation = Reservation(
            court_id=court.id,
            user_id=user.id,
            start_time=datetime.now(timezone.utc) - timedelta(hours=2),
            end_time=datetime.now(timezone.utc) - timedelta(hours=1),
            status=ReservationStatus.CHECKED_IN,
        )
        session.add(reservation)
        session.commit()
        reservation_id = reservation.id

    worker.tick(session_factory)

    with session_factory() as session:
        refreshed = session.get(Reservation, reservation_id)
        assert refreshed.status == ReservationStatus.COMPLETED


def test_worker_marks_past_confirmed_reservations_no_show(
    session_factory: sessionmaker,
) -> None:
    with session_factory() as session:
        user = make_user(session, "no-show@example.com")
        court = make_court(session, "No Show Court")
        reservation = Reservation(
            court_id=court.id,
            user_id=user.id,
            start_time=datetime.now(timezone.utc) - timedelta(hours=2),
            end_time=datetime.now(timezone.utc) - timedelta(hours=1),
            status=ReservationStatus.CONFIRMED,
        )
        session.add(reservation)
        session.commit()
        reservation_id = reservation.id

    worker.tick(session_factory)

    with session_factory() as session:
        refreshed = session.get(Reservation, reservation_id)
        assert refreshed.status == ReservationStatus.NO_SHOW


def test_worker_sends_reminder_once(session_factory: sessionmaker) -> None:
    with session_factory() as session:
        user = make_user(session, "reminder@example.com")
        court = make_court(session, "Reminder Court")
        reservation = Reservation(
            court_id=court.id,
            user_id=user.id,
            start_time=datetime.now(timezone.utc) + timedelta(hours=1),
            end_time=datetime.now(timezone.utc) + timedelta(hours=2),
            status=ReservationStatus.CONFIRMED,
        )
        session.add(reservation)
        session.commit()
        reservation_id = reservation.id
        user_id = user.id

    worker.tick(session_factory)
    worker.tick(session_factory)  # second tick must not send a duplicate

    with session_factory() as session:
        refreshed = session.get(Reservation, reservation_id)
        assert refreshed.reminder_sent_at is not None
        reminders = [
            n
            for n in session.query(Notification).filter_by(user_id=user_id).all()
            if n.type.value == "RESERVATION_REMINDER"
        ]
        assert len(reminders) == 1


def test_worker_tick_survives_one_failing_sub_task(
    session_factory: sessionmaker, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A bug in one housekeeping sub-task must not block the others — this
    is the exact failure mode docs/capability-map.md flagged: all 5 used to
    share one transaction, so one exception rolled back everything for that
    tick, silently, forever, until someone happened to read the log."""
    with session_factory() as session:
        user = make_user(session, "tick-isolation@example.com")
        court = make_court(session, "Isolation Court")
        reservation = Reservation(
            court_id=court.id,
            user_id=user.id,
            start_time=datetime.now(timezone.utc) + timedelta(days=1),
            end_time=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
            status=ReservationStatus.PENDING,
            hold_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        session.add(reservation)
        session.commit()
        reservation_id = reservation.id

    def _broken(db) -> None:
        raise RuntimeError("simulated failure in an unrelated sub-task")

    # The broken task runs *before* the real one in this list, so a
    # regression back to "one shared transaction" would roll back the real
    # task's work too, not just skip the broken one.
    monkeypatch.setattr(worker, "_SUB_TASKS", (_broken, worker._expire_stale_holds))

    worker.tick(session_factory)  # must not raise

    with session_factory() as session:
        refreshed = session.get(Reservation, reservation_id)
        assert refreshed.status == ReservationStatus.EXPIRED


def test_worker_expires_waitlist_offer_and_offers_next(
    session_factory: sessionmaker,
) -> None:
    with session_factory() as session:
        first_user = make_user(session, "waitlist-first@example.com")
        second_user = make_user(session, "waitlist-second@example.com")
        court = make_court(session, "Waitlist Court")
        start = datetime.now(timezone.utc) + timedelta(days=1)
        end = start + timedelta(hours=1)

        offered = WaitlistEntry(
            court_id=court.id,
            user_id=first_user.id,
            start_time=start,
            end_time=end,
            status=WaitlistStatus.OFFERED,
            offer_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        waiting = WaitlistEntry(
            court_id=court.id,
            user_id=second_user.id,
            start_time=start,
            end_time=end,
            status=WaitlistStatus.WAITING,
        )
        session.add_all([offered, waiting])
        session.commit()
        offered_id, waiting_id = offered.id, waiting.id

    worker.tick(session_factory)

    with session_factory() as session:
        refreshed_offered = session.get(WaitlistEntry, offered_id)
        refreshed_waiting = session.get(WaitlistEntry, waiting_id)
        assert refreshed_offered.status == WaitlistStatus.EXPIRED
        assert refreshed_waiting.status == WaitlistStatus.OFFERED
        assert refreshed_waiting.offer_expires_at is not None
