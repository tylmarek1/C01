"""The reservation state machine. Every status change — user-driven or from
the background worker — goes through `transition()` so illegal jumps
(e.g. COMPLETED -> CONFIRMED) are rejected and every change leaves an
audit trail in reservation_events."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from reservations.models import (
    Reservation,
    ReservationEvent,
    ReservationEventType,
    ReservationStatus,
)

ALLOWED_TRANSITIONS: dict[ReservationStatus, set[ReservationStatus]] = {
    ReservationStatus.PENDING: {
        ReservationStatus.CONFIRMED,
        ReservationStatus.PENDING_APPROVAL,
        ReservationStatus.CANCELLED,
        ReservationStatus.EXPIRED,
    },
    ReservationStatus.PENDING_APPROVAL: {
        ReservationStatus.CONFIRMED,
        ReservationStatus.REJECTED,
        ReservationStatus.CANCELLED,
        ReservationStatus.EXPIRED,
    },
    ReservationStatus.CONFIRMED: {
        ReservationStatus.CHECKED_IN,
        ReservationStatus.CANCELLED,
        ReservationStatus.COMPLETED,
        ReservationStatus.NO_SHOW,
    },
    ReservationStatus.CHECKED_IN: {
        ReservationStatus.COMPLETED,
        ReservationStatus.CANCELLED,
    },
    ReservationStatus.COMPLETED: set(),
    ReservationStatus.CANCELLED: set(),
    ReservationStatus.EXPIRED: set(),
    ReservationStatus.REJECTED: set(),
    ReservationStatus.NO_SHOW: set(),
}

# BR-03: the only states a user-facing Cancel may start from. The wider
# ALLOWED_TRANSITIONS table above still lets a facility block cancel a
# CHECKED_IN reservation — that is a venue action, not a Cancel.
CANCELLABLE_STATUSES = (
    ReservationStatus.PENDING,
    ReservationStatus.PENDING_APPROVAL,
    ReservationStatus.CONFIRMED,
)

_EVENT_FOR_STATUS: dict[ReservationStatus, ReservationEventType] = {
    ReservationStatus.PENDING_APPROVAL: ReservationEventType.SUBMITTED,
    ReservationStatus.REJECTED: ReservationEventType.REJECTED,
    ReservationStatus.CONFIRMED: ReservationEventType.CONFIRMED,
    ReservationStatus.CHECKED_IN: ReservationEventType.CHECKED_IN,
    ReservationStatus.COMPLETED: ReservationEventType.COMPLETED,
    ReservationStatus.CANCELLED: ReservationEventType.CANCELLED,
    ReservationStatus.EXPIRED: ReservationEventType.EXPIRED,
    ReservationStatus.NO_SHOW: ReservationEventType.NO_SHOW,
}


def check_cancellable(reservation: Reservation, now: datetime | None = None) -> None:
    """BR-03 (state + time part): cancellable only while PENDING,
    PENDING_APPROVAL or CONFIRMED and strictly before the start instant. Ownership is checked by the caller."""
    now = now or datetime.now(timezone.utc)
    if reservation.status not in CANCELLABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot cancel a {reservation.status} reservation",
        )
    if now >= reservation.start_time:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This reservation has already started and can no longer be cancelled",
        )


def _check_guards(
    reservation: Reservation, new_status: ReservationStatus, approval_decision: bool
) -> None:
    """Conditions beyond "is this edge in the table" — the guards of BR-06,
    BR-11 and BR-12 in docs/specification.md. Kept here so no caller can reach
    CONFIRMED/PENDING_APPROVAL/REJECTED around them."""
    now = datetime.now(timezone.utc)
    old_status = reservation.status

    if old_status == ReservationStatus.PENDING and new_status in (
        ReservationStatus.CONFIRMED,
        ReservationStatus.PENDING_APPROVAL,
    ):
        # A hold past its deadline is dead even if the worker has not swept it yet (BR-06).
        if (
            reservation.hold_expires_at is not None
            and reservation.hold_expires_at < now
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "This hold has expired — book the slot again"
            )
        if not reservation.court.active:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "This court is no longer available"
            )
        # BR-11: on an approval-required court a hold can only be *submitted*;
        # CONFIRMED is reachable through Approve alone.
        if (
            new_status == ReservationStatus.CONFIRMED
            and reservation.court.requires_approval
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This court requires a venue manager's approval",
            )

    if old_status == ReservationStatus.PENDING_APPROVAL and new_status in (
        ReservationStatus.CONFIRMED,
        ReservationStatus.REJECTED,
    ):
        # Only the Approve/Reject operations (which check the Venue Manager role) may pass approval_decision.
        if not approval_decision:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Only a venue manager's decision can do that"
            )
        if (
            reservation.approval_expires_at is not None
            and reservation.approval_expires_at < now
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "This approval request has expired"
            )
        if new_status == ReservationStatus.CONFIRMED and not reservation.court.active:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "This court is no longer available"
            )


def transition(
    db: Session,
    reservation: Reservation,
    new_status: ReservationStatus,
    actor_id: uuid.UUID | None = None,
    note: str | None = None,
    *,
    approval_decision: bool = False,
) -> None:
    """`approval_decision=True` is passed only by Approve/Reject, after they
    have checked the caller is a venue manager (BR-10, BR-11).

    Concurrency contract (not enforced here — see docs/capability-map.md):
    the caller must already hold a row lock on `reservation` (`SELECT ...
    FOR UPDATE`, e.g. `_get_owned_reservation(..., lock=True)` in
    `api/reservations.py`, or a `.with_for_update()`-selected row as in
    `worker.py`/`facility_blocks.py`) before calling this. Every call site
    in this codebase does; a new one that doesn't would silently reopen the
    race two concurrent transitions on the same reservation would otherwise
    hit — this function only checks the state-machine edge, not isolation.
    """
    allowed = ALLOWED_TRANSITIONS[reservation.status]
    if new_status not in allowed:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot move a {reservation.status} reservation to {new_status}",
        )

    _check_guards(reservation, new_status, approval_decision)

    reservation.status = new_status
    if new_status in (ReservationStatus.CONFIRMED, ReservationStatus.PENDING_APPROVAL):
        reservation.hold_expires_at = None
    if new_status != ReservationStatus.PENDING_APPROVAL:
        # Whether approved, rejected, cancelled or expired, no approval is pending any more.
        reservation.approval_expires_at = None

    db.add(
        ReservationEvent(
            reservation_id=reservation.id,
            event_type=_EVENT_FOR_STATUS[new_status],
            actor_id=actor_id,
            note=note,
        )
    )
