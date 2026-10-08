"""The approval process for courts that require it (BR-11 / BR-12 in
docs/specification.md): computing the approval deadline and moving a held
reservation into PENDING_APPROVAL, telling the people who have to act."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from reservations import rules
from reservations.lifecycle import transition
from reservations.models import (
    NotificationType,
    Reservation,
    ReservationStatus,
)
from reservations.notifications import notify
from reservations.schemas.reservation import VENUE_TZ
from reservations.venue_access import venue_staff


def approval_deadline(start_time: datetime, now: datetime | None = None) -> datetime:
    """BR-12: min(submission + APPROVAL_WINDOW, start) — never later than the
    slot itself, so a request can't be decided after the game began."""
    now = now or datetime.now(timezone.utc)
    return min(now + rules.APPROVAL_WINDOW, start_time)


def notify_approval_requested(db: Session, reservation: Reservation) -> None:
    """Owner gets a receipt; the managers of the court's venue — and the
    admins, who can decide anywhere — learn there is something to decide."""
    court_name = reservation.court.name
    when = reservation.start_time.astimezone(VENUE_TZ).strftime("%d %b %H:%M")
    notify(
        db,
        reservation.user_id,
        NotificationType.RESERVATION_CHANGED,
        "Approval requested",
        f"{court_name} on {when} needs a venue manager's approval — you'll be notified of the decision.",
    )
    for manager in venue_staff(db, reservation.court.venue_id):
        notify(
            db,
            manager.id,
            NotificationType.APPROVAL_REQUESTED,
            "Approval needed",
            f"{reservation.user.name} requested {court_name} on {when}.",
        )


def submit_for_approval(db: Session, reservation: Reservation, actor_id) -> None:
    """PENDING -> PENDING_APPROVAL: the player's Confirm on an approval-required court."""
    transition(db, reservation, ReservationStatus.PENDING_APPROVAL, actor_id=actor_id)
    reservation.approval_expires_at = approval_deadline(reservation.start_time)
    notify_approval_requested(db, reservation)
