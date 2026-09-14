import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations import rules
from reservations.booking_validation import (
    check_active_reservation_limit,
    check_facility_available,
    check_no_show_penalty,
    check_within_booking_window,
)
from reservations.deps import get_current_manager, get_current_user, get_db
from reservations.lifecycle import transition
from reservations.models import (
    Court,
    NotificationType,
    Reservation,
    ReservationEvent,
    ReservationEventType,
    ReservationGuest,
    ReservationSeries,
    ReservationStatus,
    User,
    UserRole,
)
from reservations.notifications import notify
from reservations.schemas.reservation import (
    ReservationAdminOut,
    ReservationCreate,
    ReservationEventOut,
    ReservationOut,
    ReservationReschedule,
    ReservationSeriesCreate,
    ReservationSeriesOut,
)
from reservations.schemas.reservation_guest import GuestInvite, ReservationGuestOut
from reservations.waitlist_service import offer_next

router = APIRouter(prefix="/reservations", tags=["reservations"])


def _get_court_or_404(db: Session, court_id: uuid.UUID) -> Court:
    court = db.get(Court, court_id)
    if court is None or not court.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")
    return court


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Reservation:
    court = _get_court_or_404(db, payload.court_id)
    check_within_booking_window(payload.start_time)
    check_facility_available(db, court.id, payload.start_time, payload.end_time)
    check_active_reservation_limit(db, current_user)
    check_no_show_penalty(db, current_user)

    hold_expires_at = datetime.now(timezone.utc) + rules.HOLD_DURATION
    reservation = Reservation(
        court_id=court.id,
        user_id=current_user.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status=ReservationStatus.PENDING,
        hold_expires_at=hold_expires_at,
    )
    db.add(reservation)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This slot is currently held or booked by someone else — join the waitlist to be notified if it frees up.",
        ) from exc

    db.add(
        ReservationEvent(
            reservation_id=reservation.id, event_type=ReservationEventType.CREATED, actor_id=current_user.id
        )
    )
    notify(
        db,
        current_user.id,
        NotificationType.RESERVATION_CREATED,
        "Slot held",
        f"{court.name} is held for you until {hold_expires_at.astimezone().strftime('%H:%M')} "
        f"({rules.HOLD_MINUTES} min) — confirm it from your dashboard.",
    )
    db.commit()
    db.refresh(reservation)
    return reservation


@router.get("", response_model=list[ReservationOut])
def list_my_reservations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Reservation]:
    stmt = select(Reservation).where(Reservation.user_id == current_user.id).order_by(Reservation.start_time.desc())
    return list(db.scalars(stmt))


@router.get("/admin", response_model=list[ReservationAdminOut])
def list_all_reservations(
    status_filter: ReservationStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> list[Reservation]:
    stmt = select(Reservation).order_by(Reservation.start_time.desc())
    if status_filter is not None:
        stmt = stmt.where(Reservation.status == status_filter)
    return list(db.scalars(stmt))


@router.get("/shared-with-me", response_model=list[ReservationOut])
def list_shared_reservations(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[Reservation]:
    stmt = (
        select(Reservation)
        .join(ReservationGuest, ReservationGuest.reservation_id == Reservation.id)
        .where(ReservationGuest.user_id == current_user.id)
        .order_by(Reservation.start_time.desc())
    )
    return list(db.scalars(stmt))


@router.post("/series", response_model=ReservationSeriesOut, status_code=status.HTTP_201_CREATED)
def create_reservation_series(
    payload: ReservationSeriesCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationSeriesOut:
    court = _get_court_or_404(db, payload.court_id)
    check_within_booking_window(payload.start_time)
    check_no_show_penalty(db, current_user)

    series = ReservationSeries(
        court_id=court.id,
        user_id=current_user.id,
        first_start_time=payload.start_time,
        first_end_time=payload.end_time,
        weeks=payload.weeks,
    )
    db.add(series)
    db.flush()

    booked: list[Reservation] = []
    failed_weeks: list[int] = []
    duration = payload.end_time - payload.start_time

    for week in range(payload.weeks):
        start_time = payload.start_time + timedelta(weeks=week)
        end_time = start_time + duration

        # Each occurrence gets its own savepoint so one conflicting week
        # doesn't roll back the ones that already succeeded.
        savepoint = db.begin_nested()
        try:
            check_facility_available(db, court.id, start_time, end_time)
            reservation = Reservation(
                court_id=court.id,
                user_id=current_user.id,
                start_time=start_time,
                end_time=end_time,
                status=ReservationStatus.PENDING,
                hold_expires_at=datetime.now(timezone.utc) + rules.HOLD_DURATION,
                series_id=series.id,
            )
            db.add(reservation)
            db.flush()
            db.add(
                ReservationEvent(
                    reservation_id=reservation.id,
                    event_type=ReservationEventType.CREATED,
                    actor_id=current_user.id,
                    note=f"Week {week + 1} of recurring series",
                )
            )
            savepoint.commit()
            booked.append(reservation)
        except (IntegrityError, HTTPException):
            savepoint.rollback()
            failed_weeks.append(week + 1)

    if not booked:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Every week in that series conflicted with an existing booking")

    notify(
        db,
        current_user.id,
        NotificationType.RESERVATION_CREATED,
        "Recurring booking created",
        f"Booked {len(booked)} of {payload.weeks} weeks on {court.name}."
        + (f" {len(failed_weeks)} week(s) conflicted." if failed_weeks else ""),
    )
    db.commit()
    for reservation in booked:
        db.refresh(reservation)

    return ReservationSeriesOut(
        series_id=series.id, requested_occurrences=payload.weeks, booked=booked, failed_weeks=failed_weeks
    )


def _get_owned_reservation(db: Session, current_user: User, reservation_id: uuid.UUID) -> Reservation:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.user_id != current_user.id and current_user.role != UserRole.VENUE_MANAGER:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your reservation")
    return reservation


@router.get("/{reservation_id}/history", response_model=list[ReservationEventOut])
def get_reservation_history(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReservationEvent]:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    stmt = (
        select(ReservationEvent)
        .where(ReservationEvent.reservation_id == reservation.id)
        .order_by(ReservationEvent.created_at)
    )
    return list(db.scalars(stmt))


@router.post("/{reservation_id}/confirm", response_model=ReservationOut)
def confirm_reservation(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Reservation:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    transition(db, reservation, ReservationStatus.CONFIRMED, actor_id=current_user.id)
    notify(
        db,
        reservation.user_id,
        NotificationType.RESERVATION_CONFIRMED,
        "Reservation confirmed",
        f"{reservation.court.name} is booked for you.",
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Slot was just taken by another reservation") from exc
    db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/check-in", response_model=ReservationOut)
def check_in_reservation(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Reservation:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    transition(db, reservation, ReservationStatus.CHECKED_IN, actor_id=current_user.id)
    db.commit()
    db.refresh(reservation)
    return reservation


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
def cancel_reservation(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Reservation:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    court_id, start_time, end_time = reservation.court_id, reservation.start_time, reservation.end_time

    transition(db, reservation, ReservationStatus.CANCELLED, actor_id=current_user.id)
    notify(
        db,
        reservation.user_id,
        NotificationType.RESERVATION_CANCELLED,
        "Reservation cancelled",
        f"Your {reservation.court.name} reservation was cancelled.",
    )
    offer_next(db, court_id, start_time, end_time)
    db.commit()
    db.refresh(reservation)
    return reservation


@router.patch("/{reservation_id}/reschedule", response_model=ReservationOut)
def reschedule_reservation(
    reservation_id: uuid.UUID,
    payload: ReservationReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Reservation:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    if reservation.status not in (ReservationStatus.PENDING, ReservationStatus.CONFIRMED):
        raise HTTPException(status.HTTP_409_CONFLICT, "Only pending or confirmed reservations can be rescheduled")

    check_within_booking_window(payload.start_time)
    check_facility_available(db, reservation.court_id, payload.start_time, payload.end_time)

    old_start, old_end = reservation.start_time, reservation.end_time
    reservation.start_time = payload.start_time
    reservation.end_time = payload.end_time
    db.add(
        ReservationEvent(
            reservation_id=reservation.id,
            event_type=ReservationEventType.TIME_CHANGED,
            actor_id=current_user.id,
            note=f"Moved from {old_start.isoformat()} to {payload.start_time.isoformat()}",
        )
    )
    notify(
        db,
        reservation.user_id,
        NotificationType.RESERVATION_CHANGED,
        "Reservation moved",
        f"{reservation.court.name} moved to {payload.start_time.astimezone().strftime('%d %b %H:%M')}.",
    )
    offer_next(db, reservation.court_id, old_start, old_end)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "New slot is already taken") from exc
    db.refresh(reservation)
    return reservation


@router.get("/{reservation_id}/guests", response_model=list[ReservationGuestOut])
def list_guests(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReservationGuest]:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    stmt = select(ReservationGuest).where(ReservationGuest.reservation_id == reservation.id).order_by(ReservationGuest.created_at)
    return list(db.scalars(stmt))


@router.post("/{reservation_id}/guests", response_model=ReservationGuestOut, status_code=status.HTTP_201_CREATED)
def invite_guest(
    reservation_id: uuid.UUID,
    payload: GuestInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationGuest:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    if reservation.status not in (ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN):
        raise HTTPException(status.HTTP_409_CONFLICT, "Can't invite guests to a reservation that's over")

    guest_count = db.scalar(
        select(func.count()).select_from(ReservationGuest).where(ReservationGuest.reservation_id == reservation.id)
    )
    if (guest_count or 0) >= rules.MAX_GUESTS_PER_RESERVATION:
        raise HTTPException(status.HTTP_409_CONFLICT, f"A reservation can have at most {rules.MAX_GUESTS_PER_RESERVATION} guests")

    invitee = db.scalar(select(User).where(User.email == payload.email))
    if invitee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No Courtly account with that email yet")
    if invitee.id == reservation.user_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "That's you — you're already on this reservation")

    guest = ReservationGuest(reservation_id=reservation.id, user_id=invitee.id, invited_by_id=current_user.id)
    db.add(guest)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That person is already invited") from exc

    notify(
        db,
        invitee.id,
        NotificationType.RESERVATION_CHANGED,
        "You've been added to a reservation",
        f"{current_user.name} invited you to {reservation.court.name} on "
        f"{reservation.start_time.astimezone().strftime('%d %b %H:%M')}.",
    )
    db.commit()
    db.refresh(guest)
    return guest


@router.delete("/{reservation_id}/guests/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_guest(
    reservation_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    guest = db.scalar(
        select(ReservationGuest)
        .where(ReservationGuest.reservation_id == reservation.id)
        .where(ReservationGuest.user_id == user_id)
    )
    if guest is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guest not found on this reservation")
    db.delete(guest)
    db.commit()
