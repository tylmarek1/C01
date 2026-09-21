import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations.deps import get_current_user, get_db
from reservations.models import (
    ACTIVE_RESERVATION_STATUSES,
    Court,
    NotificationType,
    Reservation,
    ReservationEvent,
    ReservationEventType,
    ReservationStatus,
    User,
    WaitlistEntry,
    WaitlistStatus,
)
from reservations import approval_service
from reservations.notifications import notify
from reservations.schemas.reservation import ReservationOut
from reservations.schemas.waitlist import WaitlistEntryOut, WaitlistJoin
from reservations.waitlist_service import offer_next

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


def _get_active_court(db: Session, court_id: uuid.UUID) -> Court:
    court = db.get(Court, court_id)
    if court is None or not court.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")
    return court


def _get_owned_entry(db: Session, current_user: User, entry_id: uuid.UUID) -> WaitlistEntry:
    entry = db.get(WaitlistEntry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Waitlist entry not found")
    if entry.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your waitlist entry")
    return entry


@router.post("", response_model=WaitlistEntryOut, status_code=status.HTTP_201_CREATED)
def join_waitlist(
    payload: WaitlistJoin,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WaitlistEntry:
    court = _get_active_court(db, payload.court_id)

    taken = db.scalar(
        select(Reservation)
        .where(Reservation.court_id == court.id)
        .where(Reservation.start_time == payload.start_time)
        .where(Reservation.end_time == payload.end_time)
        .where(Reservation.status.in_(ACTIVE_RESERVATION_STATUSES))
    )
    if taken is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This slot is available — book it directly instead of waitlisting")

    existing = db.scalar(
        select(WaitlistEntry)
        .where(WaitlistEntry.court_id == court.id)
        .where(WaitlistEntry.user_id == current_user.id)
        .where(WaitlistEntry.start_time == payload.start_time)
        .where(WaitlistEntry.end_time == payload.end_time)
        .where(WaitlistEntry.status.in_([WaitlistStatus.WAITING, WaitlistStatus.OFFERED]))
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already on the waitlist for this slot")

    entry = WaitlistEntry(
        court_id=court.id, user_id=current_user.id, start_time=payload.start_time, end_time=payload.end_time
    )
    db.add(entry)
    notify(
        db,
        current_user.id,
        NotificationType.WAITLIST_JOINED,
        "Joined the waitlist",
        f"We'll notify you if {court.name} frees up for that time.",
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/mine", response_model=list[WaitlistEntryOut])
def list_my_waitlist(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[WaitlistEntry]:
    stmt = (
        select(WaitlistEntry).where(WaitlistEntry.user_id == current_user.id).order_by(WaitlistEntry.created_at.desc())
    )
    return list(db.scalars(stmt))


@router.post("/{entry_id}/accept", response_model=ReservationOut)
def accept_waitlist_offer(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Reservation:
    entry = _get_owned_entry(db, current_user, entry_id)
    if entry.status != WaitlistStatus.OFFERED:
        raise HTTPException(status.HTTP_409_CONFLICT, "This waitlist entry has no active offer")
    if entry.offer_expires_at is not None and entry.offer_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_409_CONFLICT, "This offer has expired")

    # BR-11: on an approval-required court an accepted offer is a request, not a booking.
    needs_approval = entry.court.requires_approval
    reservation = Reservation(
        court_id=entry.court_id,
        user_id=current_user.id,
        start_time=entry.start_time,
        end_time=entry.end_time,
        status=ReservationStatus.PENDING_APPROVAL if needs_approval else ReservationStatus.CONFIRMED,
        approval_expires_at=approval_service.approval_deadline(entry.start_time) if needs_approval else None,
    )
    db.add(reservation)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That slot was just taken") from exc

    entry.status = WaitlistStatus.ACCEPTED
    db.add(
        ReservationEvent(
            reservation_id=reservation.id,
            event_type=ReservationEventType.CREATED,
            actor_id=current_user.id,
            note="Booked from a waitlist offer",
        )
    )
    if needs_approval:
        db.add(
            ReservationEvent(
                reservation_id=reservation.id, event_type=ReservationEventType.SUBMITTED, actor_id=current_user.id
            )
        )
        approval_service.notify_approval_requested(db, reservation)
    else:
        db.add(
            ReservationEvent(
                reservation_id=reservation.id, event_type=ReservationEventType.CONFIRMED, actor_id=current_user.id
            )
        )
        notify(
            db,
            current_user.id,
            NotificationType.RESERVATION_CONFIRMED,
            "Waitlist slot booked",
            f"You're confirmed for {entry.court.name}.",
        )
    db.commit()
    db.refresh(reservation)
    return reservation


@router.post("/{entry_id}/cancel", response_model=WaitlistEntryOut)
def cancel_waitlist_entry(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WaitlistEntry:
    entry = _get_owned_entry(db, current_user, entry_id)
    if entry.status in (WaitlistStatus.ACCEPTED, WaitlistStatus.CANCELLED, WaitlistStatus.EXPIRED):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Waitlist entry is already {entry.status.lower()}")

    was_offered = entry.status == WaitlistStatus.OFFERED
    court_id, start_time, end_time = entry.court_id, entry.start_time, entry.end_time
    entry.status = WaitlistStatus.CANCELLED

    if was_offered:
        offer_next(db, court_id, start_time, end_time)

    db.commit()
    db.refresh(entry)
    return entry
