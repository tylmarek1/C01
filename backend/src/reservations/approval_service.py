"""The approval process for courts that require it (BR-11 / BR-12 in
docs/specification.md): computing the approval deadline and moving a held
reservation into PENDING_APPROVAL, telling the people who have to act."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations import rules
from reservations.lifecycle import transition
from reservations.models import NotificationType, Reservation, ReservationStatus, User, UserRole
from reservations.notifications import notify


def approval_deadline(start_time: datetime, now: datetime | None = None) -> datetime:
    """BR-12: min(submission + APPROVAL_WINDOW, start) — never later than the
    slot itself, so a request can't be decided after the game began."""
    now = now or datetime.now(timezone.utc)
    return min(now + rules.APPROVAL_WINDOW, start_time)


def notify_approval_requested(db: Session, reservation: Reservation) -> None:
    """Owner gets a receipt; every venue manager learns there is something to decide."""
    court_name = reservation.court.name
    when = reservation.start_time.astimezone().strftime("%d %b %H:%M")
    notify(
        db,
        reservation.user_id,
        NotificationType.RESERVATION_CHANGED,
        "Approval requested",
        f"{court_name} on {when} needs a venue manager's approval — you'll be notified of the decision.",
    )
    managers = db.scalars(select(User).where(User.role == UserRole.VENUE_MANAGER))
    for manager in managers:
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
