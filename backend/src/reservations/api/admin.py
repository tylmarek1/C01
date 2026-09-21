import csv
import io
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from reservations.deps import get_current_manager, get_db
from reservations.models import (
    ACTIVE_RESERVATION_STATUSES,
    Court,
    Reservation,
    ReservationStatus,
    User,
    UserRole,
)
from reservations.schemas.admin import (
    AdminStats,
    CourtPopularity,
    HourlyDemand,
    UserAdminOut,
    UserRoleUpdate,
)
from reservations.schemas.court import CourtOut
from reservations.schemas.reservation import CLOSING_HOUR, OPENING_HOUR, VENUE_TZ
from reservations.schemas.stats import CourtUtilization, CourtUtilizationCell

router = APIRouter(prefix="/admin", tags=["admin"])

_REAL_BOOKING_STATUSES = (
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
    ReservationStatus.COMPLETED,
    ReservationStatus.NO_SHOW,
)


@router.get("/stats", response_model=AdminStats)
def get_stats(
    db: Session = Depends(get_db), _manager: User = Depends(get_current_manager)
) -> AdminStats:
    total_reservations = db.scalar(select(func.count()).select_from(Reservation)) or 0

    status_rows = db.execute(
        select(Reservation.status, func.count()).group_by(Reservation.status)
    ).all()
    status_breakdown = {row[0].value: row[1] for row in status_rows}

    completed = status_breakdown.get(ReservationStatus.COMPLETED.value, 0)
    no_shows = status_breakdown.get(ReservationStatus.NO_SHOW.value, 0)
    no_show_rate = (
        round(no_shows / (completed + no_shows), 3)
        if (completed + no_shows) > 0
        else 0.0
    )

    since = datetime.now(timezone.utc) - timedelta(days=30)
    reservations_last_30_days = (
        db.scalar(
            select(func.count())
            .select_from(Reservation)
            .where(Reservation.created_at >= since)
        )
        or 0
    )

    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    total_courts = db.scalar(select(func.count()).select_from(Court)) or 0

    top_rows = (
        db.execute(
            select(Reservation.court_id, func.count())
            .where(Reservation.status.in_(_REAL_BOOKING_STATUSES))
            .group_by(Reservation.court_id)
            .order_by(func.count().desc())
            .limit(5)
        )
    ).all()
    top_courts: list[CourtPopularity] = []
    for court_id, count in top_rows:
        court = db.get(Court, court_id)
        if court is not None:
            top_courts.append(
                CourtPopularity(
                    court=CourtOut.model_validate(court), reservation_count=count
                )
            )

    hour_expr = func.extract(
        "hour", Reservation.start_time.op("AT TIME ZONE")("Europe/Prague")
    )
    hour_rows = db.execute(
        select(hour_expr, func.count())
        .where(Reservation.status.in_(_REAL_BOOKING_STATUSES))
        .group_by(hour_expr)
        .order_by(hour_expr)
    ).all()
    busiest_hours = [HourlyDemand(hour=int(row[0]), count=row[1]) for row in hour_rows]

    return AdminStats(
        total_reservations=total_reservations,
        status_breakdown=status_breakdown,
        no_show_rate=no_show_rate,
        reservations_last_30_days=reservations_last_30_days,
        total_users=total_users,
        total_courts=total_courts,
        top_courts=top_courts,
        busiest_hours=busiest_hours,
    )


@router.get("/users", response_model=list[UserAdminOut])
def list_users(
    db: Session = Depends(get_db), _manager: User = Depends(get_current_manager)
) -> list[UserAdminOut]:
    users = list(db.scalars(select(User).order_by(User.created_at.desc())))
    if not users:
        return []

    user_ids = [u.id for u in users]
    active_counts = dict(
        db.execute(
            select(Reservation.user_id, func.count())
            .where(Reservation.user_id.in_(user_ids))
            .where(Reservation.status.in_(ACTIVE_RESERVATION_STATUSES))
            .group_by(Reservation.user_id)
        ).all()
    )
    no_show_counts = dict(
        db.execute(
            select(Reservation.user_id, func.count())
            .where(Reservation.user_id.in_(user_ids))
            .where(Reservation.status == ReservationStatus.NO_SHOW)
            .group_by(Reservation.user_id)
        ).all()
    )

    return [
        UserAdminOut(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role,
            avatar_url=u.avatar_url,
            created_at=u.created_at,
            active_reservation_count=active_counts.get(u.id, 0),
            no_show_count=no_show_counts.get(u.id, 0),
        )
        for u in users
    ]


@router.patch("/users/{user_id}/role", response_model=UserAdminOut)
def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> UserAdminOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == manager.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can't change your own role")
    # Granting/revoking ADMIN, or touching an existing admin's role at all,
    # is reserved to admins themselves — a venue manager keeps the existing
    # PLAYER <-> VENUE_MANAGER toggle only.
    if manager.role != UserRole.ADMIN and (
        payload.role == UserRole.ADMIN or user.role == UserRole.ADMIN
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")

    user.role = payload.role
    db.commit()
    db.refresh(user)

    active_count = (
        db.scalar(
            select(func.count())
            .select_from(Reservation)
            .where(Reservation.user_id == user.id)
            .where(Reservation.status.in_(ACTIVE_RESERVATION_STATUSES))
        )
        or 0
    )
    no_show_count = (
        db.scalar(
            select(func.count())
            .select_from(Reservation)
            .where(Reservation.user_id == user.id)
            .where(Reservation.status == ReservationStatus.NO_SHOW)
        )
        or 0
    )

    return UserAdminOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        active_reservation_count=active_count,
        no_show_count=no_show_count,
    )


@router.get("/reservations/export.csv")
def export_reservations_csv(
    db: Session = Depends(get_db), _manager: User = Depends(get_current_manager)
) -> StreamingResponse:
    stmt = select(Reservation).order_by(Reservation.start_time.desc())
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "court",
            "sport",
            "booked_by",
            "email",
            "start_time",
            "end_time",
            "status",
            "created_at",
        ]
    )
    for r in db.scalars(stmt):
        writer.writerow(
            [
                r.id,
                r.court.name,
                r.court.sport_type.value,
                r.user.name,
                r.user.email,
                r.start_time.isoformat(),
                r.end_time.isoformat(),
                r.status.value,
                r.created_at.isoformat(),
            ]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reservations.csv"},
    )


@router.get("/courts/{court_id}/utilization", response_model=CourtUtilization)
def get_court_utilization(
    court_id: uuid.UUID,
    days: int = Query(default=30, ge=1, le=180),
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> CourtUtilization:
    """How full each weekday/hour slot has been over the trailing window —
    feeds an admin heatmap so managers can spot dead hours and busy hours."""
    court = db.get(Court, court_id)
    if court is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    possible_count: Counter[tuple[int, int]] = Counter()
    day = since
    while day < now:
        weekday = day.astimezone(VENUE_TZ).weekday()
        for hour in range(OPENING_HOUR, CLOSING_HOUR):
            possible_count[(weekday, hour)] += 1
        day += timedelta(days=1)

    stmt = (
        select(Reservation)
        .where(Reservation.court_id == court_id)
        .where(
            Reservation.status.in_(
                (*ACTIVE_RESERVATION_STATUSES, ReservationStatus.COMPLETED)
            )
        )
        .where(Reservation.start_time >= since)
        .where(Reservation.start_time < now)
    )
    booked_count: Counter[tuple[int, int]] = Counter()
    for reservation in db.scalars(stmt):
        local_start = reservation.start_time.astimezone(VENUE_TZ)
        span_hours = int(
            (reservation.end_time - reservation.start_time).total_seconds() // 3600
        )
        for offset in range(max(span_hours, 1)):
            slot = local_start + timedelta(hours=offset)
            booked_count[(slot.weekday(), slot.hour)] += 1

    cells = [
        CourtUtilizationCell(
            day_of_week=weekday,
            hour=hour,
            booked_count=booked_count.get((weekday, hour), 0),
            possible_count=possible_count.get((weekday, hour), 0),
        )
        for weekday in range(7)
        for hour in range(OPENING_HOUR, CLOSING_HOUR)
    ]
    return CourtUtilization(court_id=court.id, days_analyzed=days, cells=cells)
