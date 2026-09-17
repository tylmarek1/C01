import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations import achievements, rules
from reservations.booking_validation import (
    check_active_reservation_limit,
    check_facility_available,
    check_no_show_penalty,
    check_within_booking_window,
)
from reservations.calendar_export import build_calendar_feed_ics, build_single_event_ics
from reservations.deps import get_current_manager, get_current_user, get_db
from reservations.lifecycle import transition
from reservations.models import (
    ACTIVE_RESERVATION_STATUSES,
    Court,
    JoinRequest,
    JoinRequestStatus,
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
from reservations.schemas.auth import UserOut
from reservations.schemas.join_request import JoinRequestCreate, JoinRequestOut, JoinRequestReservationOut
from reservations.schemas.reservation import (
    OpenGameOut,
    ReservationAdminOut,
    ReservationCreate,
    ReservationEventOut,
    ReservationOpenUpdate,
    ReservationOut,
    ReservationReschedule,
    ReservationSeriesCreate,
    ReservationSeriesOut,
    ReservationSplit,
    ReservationSplitParticipant,
)
from reservations.schemas.reservation_guest import GuestInvite, ReservationGuestOut
from reservations.schemas.stats import TeammateOut
from reservations.waitlist_service import offer_next

router = APIRouter(prefix="/reservations", tags=["reservations"])


def _guest_count(db: Session, reservation_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(ReservationGuest).where(ReservationGuest.reservation_id == reservation_id)
    ) or 0


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


@router.get("/open", response_model=list[OpenGameOut])
def list_open_games(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OpenGameOut]:
    """"Find a partner" browse — upcoming confirmed reservations the booker
    has opened up for other players to request a guest spot on."""
    already_on = select(ReservationGuest.reservation_id).where(ReservationGuest.user_id == current_user.id)
    stmt = (
        select(Reservation)
        .where(Reservation.open_to_join.is_(True))
        .where(Reservation.status == ReservationStatus.CONFIRMED)
        .where(Reservation.start_time > datetime.now(timezone.utc))
        .where(Reservation.user_id != current_user.id)
        .where(Reservation.id.notin_(already_on))
        .order_by(Reservation.start_time)
    )
    reservations = list(db.scalars(stmt))
    results: list[OpenGameOut] = []
    for reservation in reservations:
        spots_left = rules.MAX_GUESTS_PER_RESERVATION - _guest_count(db, reservation.id)
        if spots_left > 0:
            reservation.spots_left = spots_left  # transient, read by OpenGameOut (from_attributes)
            results.append(OpenGameOut.model_validate(reservation))
    return results


@router.get("/frequent-teammates", response_model=list[TeammateOut])
def list_frequent_teammates(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TeammateOut]:
    """People who've shown up on the same reservation as you — either you
    invited them, or they invited you — ranked by how often, to power a
    quick-invite list."""
    as_host = (
        select(ReservationGuest.user_id.label("teammate_id"))
        .join(Reservation, Reservation.id == ReservationGuest.reservation_id)
        .where(Reservation.user_id == current_user.id)
    )
    as_guest = (
        select(Reservation.user_id.label("teammate_id"))
        .join(ReservationGuest, ReservationGuest.reservation_id == Reservation.id)
        .where(ReservationGuest.user_id == current_user.id)
    )
    union_stmt = as_host.union_all(as_guest).subquery()
    rows = db.execute(
        select(union_stmt.c.teammate_id, func.count())
        .group_by(union_stmt.c.teammate_id)
        .order_by(func.count().desc())
        .limit(limit)
    ).all()

    teammates: list[TeammateOut] = []
    for teammate_id, count in rows:
        user = db.get(User, teammate_id)
        if user is not None:
            teammates.append(TeammateOut(user=UserOut.model_validate(user), games_together=count))
    return teammates


@router.get("/join-requests/mine", response_model=list[JoinRequestReservationOut])
def list_my_join_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[JoinRequest]:
    stmt = select(JoinRequest).where(JoinRequest.user_id == current_user.id).order_by(JoinRequest.created_at.desc())
    return list(db.scalars(stmt))


@router.get("/calendar.ics")
def personal_calendar_feed(token: str, db: Session = Depends(get_db)) -> Response:
    """A stable, subscribable .ics feed URL — calendar apps can't send a
    Bearer header, so a long opaque token in the query string stands in for
    one (see POST /auth/me/calendar-token)."""
    user = db.scalar(select(User).where(User.calendar_token == token))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid or revoked calendar token")

    stmt = (
        select(Reservation)
        .where(Reservation.user_id == user.id)
        .where(Reservation.status.in_((*ACTIVE_RESERVATION_STATUSES, ReservationStatus.COMPLETED)))
        .order_by(Reservation.start_time)
    )
    reservations = list(db.scalars(stmt))
    return Response(content=build_calendar_feed_ics(reservations), media_type="text/calendar")


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
    achievements.evaluate_and_award(db, current_user.id)
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


@router.patch("/{reservation_id}/open", response_model=ReservationOut)
def set_open_to_join(
    reservation_id: uuid.UUID,
    payload: ReservationOpenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Reservation:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    if reservation.status != ReservationStatus.CONFIRMED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a confirmed reservation can be opened up to other players")

    reservation.open_to_join = payload.open_to_join
    reservation.open_note = payload.open_note if payload.open_to_join else None
    db.commit()
    db.refresh(reservation)
    return reservation


@router.get("/{reservation_id}/join-requests", response_model=list[JoinRequestOut])
def list_join_requests(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[JoinRequest]:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    stmt = (
        select(JoinRequest)
        .where(JoinRequest.reservation_id == reservation.id)
        .order_by(JoinRequest.created_at)
    )
    return list(db.scalars(stmt))


@router.post("/{reservation_id}/join-requests", response_model=JoinRequestOut, status_code=status.HTTP_201_CREATED)
def request_to_join(
    reservation_id: uuid.UUID,
    payload: JoinRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JoinRequest:
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if not reservation.open_to_join or reservation.status != ReservationStatus.CONFIRMED:
        raise HTTPException(status.HTTP_409_CONFLICT, "This reservation isn't open for join requests")
    if reservation.user_id == current_user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already the host of this reservation")

    already_guest = db.scalar(
        select(ReservationGuest)
        .where(ReservationGuest.reservation_id == reservation.id)
        .where(ReservationGuest.user_id == current_user.id)
    )
    if already_guest is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "You're already on this reservation")
    if _guest_count(db, reservation.id) >= rules.MAX_GUESTS_PER_RESERVATION:
        raise HTTPException(status.HTTP_409_CONFLICT, "This game is already full")

    join_request = JoinRequest(reservation_id=reservation.id, user_id=current_user.id, note=payload.note)
    db.add(join_request)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You already requested to join this reservation") from exc

    notify(
        db,
        reservation.user_id,
        NotificationType.JOIN_REQUEST_RECEIVED,
        "Someone wants to join your game",
        f"{current_user.name} asked to join your {reservation.court.name} reservation.",
    )
    db.commit()
    db.refresh(join_request)
    return join_request


@router.post("/{reservation_id}/join-requests/{request_id}/accept", response_model=ReservationGuestOut)
def accept_join_request(
    reservation_id: uuid.UUID,
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationGuest:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    join_request = db.get(JoinRequest, request_id)
    if join_request is None or join_request.reservation_id != reservation.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Join request not found")
    if join_request.status != JoinRequestStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request was already answered")
    if _guest_count(db, reservation.id) >= rules.MAX_GUESTS_PER_RESERVATION:
        raise HTTPException(status.HTTP_409_CONFLICT, f"A reservation can have at most {rules.MAX_GUESTS_PER_RESERVATION} guests")

    join_request.status = JoinRequestStatus.ACCEPTED
    guest = ReservationGuest(reservation_id=reservation.id, user_id=join_request.user_id, invited_by_id=current_user.id)
    db.add(guest)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That person is already on this reservation") from exc

    notify(
        db,
        join_request.user_id,
        NotificationType.JOIN_REQUEST_ACCEPTED,
        "You're in!",
        f"{current_user.name} accepted your request to join {reservation.court.name}.",
    )
    achievements.evaluate_and_award(db, join_request.user_id)
    db.commit()
    db.refresh(guest)
    return guest


@router.post("/{reservation_id}/join-requests/{request_id}/decline", response_model=JoinRequestOut)
def decline_join_request(
    reservation_id: uuid.UUID,
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JoinRequest:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    join_request = db.get(JoinRequest, request_id)
    if join_request is None or join_request.reservation_id != reservation.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Join request not found")
    if join_request.status != JoinRequestStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request was already answered")

    join_request.status = JoinRequestStatus.DECLINED
    notify(
        db,
        join_request.user_id,
        NotificationType.JOIN_REQUEST_DECLINED,
        "Join request declined",
        f"Your request to join {reservation.court.name} wasn't accepted this time.",
    )
    db.commit()
    db.refresh(join_request)
    return join_request


@router.get("/{reservation_id}/ics")
def download_reservation_ics(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    return Response(
        content=build_single_event_ics(reservation),
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="reservation-{reservation.id}.ics"'},
    )


@router.get("/{reservation_id}/split", response_model=ReservationSplit)
def split_reservation_cost(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReservationSplit:
    """A calculator only — nothing is charged. Splits the court's published
    hourly rate evenly across the booker and their guests."""
    reservation = _get_owned_reservation(db, current_user, reservation_id)
    duration_hours = (reservation.end_time - reservation.start_time).total_seconds() / 3600

    guests = list(
        db.scalars(select(ReservationGuest).where(ReservationGuest.reservation_id == reservation.id))
    )
    participants = [reservation.user, *(g.user for g in guests)]
    participant_count = len(participants)

    price_per_hour = reservation.court.price_per_hour
    total_cost = round(float(price_per_hour) * duration_hours, 2) if price_per_hour is not None else None
    per_person = round(total_cost / participant_count, 2) if total_cost is not None else None

    return ReservationSplit(
        total_cost=total_cost,
        duration_hours=duration_hours,
        participant_count=participant_count,
        per_person=per_person,
        participants=[
            ReservationSplitParticipant(user=UserOut.model_validate(u), share=per_person or 0.0) for u in participants
        ],
    )
