"""The reservation state machine. Every status change — user-driven or from
the background worker — goes through `transition()` so illegal jumps
(e.g. COMPLETED -> CONFIRMED) are rejected and every change leaves an
audit trail in reservation_events."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from reservations.models import Reservation, ReservationEvent, ReservationEventType, ReservationStatus

ALLOWED_TRANSITIONS: dict[ReservationStatus, set[ReservationStatus]] = {
    ReservationStatus.PENDING: {
        ReservationStatus.CONFIRMED,
        ReservationStatus.CANCELLED,
        ReservationStatus.EXPIRED,
    },
    ReservationStatus.CONFIRMED: {
        ReservationStatus.CHECKED_IN,
        ReservationStatus.CANCELLED,
        ReservationStatus.COMPLETED,
        ReservationStatus.NO_SHOW,
    },
    ReservationStatus.CHECKED_IN: {ReservationStatus.COMPLETED, ReservationStatus.CANCELLED},
    ReservationStatus.COMPLETED: set(),
    ReservationStatus.CANCELLED: set(),
    ReservationStatus.EXPIRED: set(),
    ReservationStatus.NO_SHOW: set(),
}

# BR-03: the only states a user-facing Cancel may start from. The wider
# ALLOWED_TRANSITIONS table above still lets a facility block cancel a
# CHECKED_IN reservation — that is a venue action, not a Cancel.
CANCELLABLE_STATUSES = (ReservationStatus.PENDING, ReservationStatus.CONFIRMED)

_EVENT_FOR_STATUS: dict[ReservationStatus, ReservationEventType] = {
    ReservationStatus.CONFIRMED: ReservationEventType.CONFIRMED,
    ReservationStatus.CHECKED_IN: ReservationEventType.CHECKED_IN,
    ReservationStatus.COMPLETED: ReservationEventType.COMPLETED,
    ReservationStatus.CANCELLED: ReservationEventType.CANCELLED,
    ReservationStatus.EXPIRED: ReservationEventType.EXPIRED,
    ReservationStatus.NO_SHOW: ReservationEventType.NO_SHOW,
}


def check_cancellable(reservation: Reservation, now: datetime | None = None) -> None:
    """BR-03 (state + time part): cancellable only while PENDING/CONFIRMED and
    strictly before the start instant. Ownership is checked by the caller."""
    now = now or datetime.now(timezone.utc)
    if reservation.status not in CANCELLABLE_STATUSES:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot cancel a {reservation.status} reservation")
    if now >= reservation.start_time:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This reservation has already started and can no longer be cancelled"
        )


def _check_confirmable(reservation: Reservation) -> None:
    """Guards of PENDING -> CONFIRMED (REQ-04): a hold past its deadline is
    dead even if the worker has not swept it yet (BR-06), and a deactivated
    court cannot take a new allocation."""
    if reservation.hold_expires_at is not None and reservation.hold_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_409_CONFLICT, "This hold has expired — book the slot again")
    if not reservation.court.active:
        raise HTTPException(status.HTTP_409_CONFLICT, "This court is no longer available")


def transition(
    db: Session,
    reservation: Reservation,
    new_status: ReservationStatus,
    actor_id: uuid.UUID | None = None,
    note: str | None = None,
) -> None:
    allowed = ALLOWED_TRANSITIONS[reservation.status]
    if new_status not in allowed:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot move a {reservation.status} reservation to {new_status}",
        )

    if new_status == ReservationStatus.CONFIRMED:
        _check_confirmable(reservation)

    reservation.status = new_status
    if new_status == ReservationStatus.CONFIRMED:
        reservation.hold_expires_at = None

    db.add(
        ReservationEvent(
            reservation_id=reservation.id,
            event_type=_EVENT_FOR_STATUS[new_status],
            actor_id=actor_id,
            note=note,
        )
    )
