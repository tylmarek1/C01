"""The reservation state machine. Every status change — user-driven or from
the background worker — goes through `transition()` so illegal jumps
(e.g. COMPLETED -> CONFIRMED) are rejected and every change leaves an
audit trail in reservation_events."""

import uuid

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

_EVENT_FOR_STATUS: dict[ReservationStatus, ReservationEventType] = {
    ReservationStatus.CONFIRMED: ReservationEventType.CONFIRMED,
    ReservationStatus.CHECKED_IN: ReservationEventType.CHECKED_IN,
    ReservationStatus.COMPLETED: ReservationEventType.COMPLETED,
    ReservationStatus.CANCELLED: ReservationEventType.CANCELLED,
    ReservationStatus.EXPIRED: ReservationEventType.EXPIRED,
    ReservationStatus.NO_SHOW: ReservationEventType.NO_SHOW,
}


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
