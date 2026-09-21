"""In-process background worker — no Celery/Redis needed for this scale.
One asyncio task, woken every TICK_SECONDS, does all the housekeeping a real
reservation engine needs on its own:

- expire PENDING holds nobody confirmed in time
- expire PENDING_APPROVAL requests no venue manager decided in time
- send a one-time reminder ~2h before a confirmed slot starts
- auto-complete reservations whose slot has passed
- expire unanswered waitlist offers and cascade to the next person
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from reservations import achievements, rules, waitlist_service
from reservations.lifecycle import transition
from reservations.models import (
    NotificationType,
    Reservation,
    ReservationStatus,
    WaitlistEntry,
    WaitlistStatus,
)
from reservations.notifications import notify

logger = logging.getLogger("reservations.worker")

TICK_SECONDS = 30


def _expire_stale_holds(db) -> None:
    now = datetime.now(timezone.utc)
    stmt = (
        select(Reservation)
        .where(Reservation.status == ReservationStatus.PENDING)
        .where(Reservation.hold_expires_at.is_not(None))
        .where(Reservation.hold_expires_at < now)
        # Skip rows a Confirm/Cancel holds locked right now (REQ-07); a still
        # expired hold is simply picked up again on the next tick.
        .with_for_update(skip_locked=True)
    )
    for reservation in db.scalars(stmt):
        transition(
            db, reservation, ReservationStatus.EXPIRED, note="Hold expired unconfirmed"
        )
        notify(
            db,
            reservation.user_id,
            NotificationType.RESERVATION_EXPIRED,
            "Your hold expired",
            f"Your {rules.HOLD_MINUTES}-minute hold on {reservation.court.name} expired before you confirmed it.",
        )
        waitlist_service.offer_next(
            db, reservation.court_id, reservation.start_time, reservation.end_time
        )


def _expire_stale_approvals(db) -> None:
    now = datetime.now(timezone.utc)
    stmt = (
        select(Reservation)
        .where(Reservation.status == ReservationStatus.PENDING_APPROVAL)
        .where(Reservation.approval_expires_at.is_not(None))
        .where(Reservation.approval_expires_at < now)
        # Skip rows an Approve/Reject/Cancel holds locked right now (REQ-07).
        .with_for_update(skip_locked=True)
    )
    for reservation in db.scalars(stmt):
        transition(
            db,
            reservation,
            ReservationStatus.EXPIRED,
            note="Approval request expired undecided",
        )
        notify(
            db,
            reservation.user_id,
            NotificationType.RESERVATION_EXPIRED,
            "Your request expired",
            f"No venue manager decided on your {reservation.court.name} request in time, so it was released.",
        )
        waitlist_service.offer_next(
            db, reservation.court_id, reservation.start_time, reservation.end_time
        )


def _send_reminders(db) -> None:
    now = datetime.now(timezone.utc)
    window_end = now + rules.REMINDER_LEAD
    stmt = (
        select(Reservation)
        .where(
            Reservation.status.in_(
                [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN]
            )
        )
        .where(Reservation.reminder_sent_at.is_(None))
        .where(Reservation.start_time > now)
        .where(Reservation.start_time <= window_end)
        .with_for_update(skip_locked=True)
    )
    for reservation in db.scalars(stmt):
        reservation.reminder_sent_at = now
        notify(
            db,
            reservation.user_id,
            NotificationType.RESERVATION_REMINDER,
            "Upcoming reservation",
            f"Your {reservation.court.name} reservation starts at {reservation.start_time.strftime('%H:%M')}.",
        )


def _auto_complete(db) -> None:
    """A slot that's ended either has someone who checked in (COMPLETED) or
    doesn't (NO_SHOW) — CONFIRMED reservations never checked in are the
    latter, which also feeds the no-show booking penalty."""
    now = datetime.now(timezone.utc)

    checked_in_stmt = (
        select(Reservation)
        .where(Reservation.status == ReservationStatus.CHECKED_IN)
        .where(Reservation.end_time < now)
        .with_for_update(skip_locked=True)
    )
    for reservation in db.scalars(checked_in_stmt):
        transition(
            db,
            reservation,
            ReservationStatus.COMPLETED,
            note="Auto-completed after end time",
        )
        achievements.evaluate_and_award(db, reservation.user_id)

    no_show_stmt = (
        select(Reservation)
        .where(Reservation.status == ReservationStatus.CONFIRMED)
        .where(Reservation.end_time < now)
        .with_for_update(skip_locked=True)
    )
    for reservation in db.scalars(no_show_stmt):
        transition(
            db,
            reservation,
            ReservationStatus.NO_SHOW,
            note="Never checked in before the slot ended",
        )


def _expire_waitlist_offers(db) -> None:
    now = datetime.now(timezone.utc)
    stmt = (
        select(WaitlistEntry)
        .where(WaitlistEntry.status == WaitlistStatus.OFFERED)
        .where(WaitlistEntry.offer_expires_at < now)
        .with_for_update(skip_locked=True)
    )
    for entry in db.scalars(stmt):
        entry.status = WaitlistStatus.EXPIRED
        waitlist_service.offer_next(
            db, entry.court_id, entry.start_time, entry.end_time
        )


# Each sub-task gets its own session/transaction in tick() below, so one
# failing task can't roll back or block the others — see docs/capability-map.md.
_SUB_TASKS = (
    _expire_stale_holds,
    _expire_stale_approvals,
    _send_reminders,
    _auto_complete,
    _expire_waitlist_offers,
)


def tick(session_factory: sessionmaker) -> None:
    for sub_task in _SUB_TASKS:
        try:
            with session_factory() as db:
                sub_task(db)
                db.commit()
        except Exception:
            logger.exception("Background worker sub-task %s failed", sub_task.__name__)


async def run_forever(session_factory: sessionmaker) -> None:
    while True:
        try:
            tick(session_factory)
        except Exception:
            logger.exception("Background worker tick failed")
        await asyncio.sleep(TICK_SECONDS)
