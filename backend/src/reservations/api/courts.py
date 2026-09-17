import uuid
from datetime import date as date_type
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from reservations.deps import get_current_manager, get_current_user, get_db, get_optional_user
from reservations.images import compress_and_store_court_image
from reservations.models import (
    ACTIVE_RESERVATION_STATUSES,
    Amenity,
    Court,
    Reservation,
    ReservationStatus,
    Review,
    SportType,
    User,
    UserRole,
)
from reservations.schemas.availability import BusySlot, CourtAvailability
from reservations.schemas.court import CourtCreate, CourtOut, CourtUpdate
from reservations.schemas.reservation import CLOSING_HOUR, OPENING_HOUR, VENUE_TZ

router = APIRouter(prefix="/courts", tags=["courts"])

_REAL_BOOKING_STATUSES = (
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
    ReservationStatus.COMPLETED,
    ReservationStatus.NO_SHOW,
)


def _get_court(db: Session, court_id: uuid.UUID) -> Court:
    court = db.get(Court, court_id)
    if court is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")
    return court


def _attach_ratings(db: Session, courts: list[Court]) -> list[Court]:
    """Sets .average_rating/.review_count as transient attributes so CourtOut
    (from_attributes) can read them — one aggregate query for the whole list."""
    if not courts:
        return courts
    court_ids = [c.id for c in courts]
    stmt = (
        select(Review.court_id, func.avg(Review.rating), func.count(Review.id))
        .where(Review.court_id.in_(court_ids))
        .group_by(Review.court_id)
    )
    by_court = {row[0]: (float(row[1]), row[2]) for row in db.execute(stmt)}
    for court in courts:
        avg, count = by_court.get(court.id, (None, 0))
        court.average_rating = round(avg, 1) if avg is not None else None
        court.review_count = count
    return courts


@router.get("", response_model=list[CourtOut])
def list_courts(
    sport: SportType | None = None,
    include_inactive: bool = False,
    q: str | None = Query(default=None, description="Search court name/description"),
    amenity: Amenity | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> list[Court]:
    if include_inactive and (current_user is None or current_user.role != UserRole.VENUE_MANAGER):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Venue manager access required")

    stmt = select(Court)
    if not include_inactive:
        stmt = stmt.where(Court.active.is_(True))
    if sport is not None:
        stmt = stmt.where(Court.sport_type == sport)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Court.name.ilike(like), Court.description.ilike(like)))
    if amenity is not None:
        stmt = stmt.where(Court.amenities.any(amenity.value))
    stmt = stmt.order_by(Court.name)
    return _attach_ratings(db, list(db.scalars(stmt)))


@router.get("/trending", response_model=list[CourtOut])
def list_trending_courts(
    days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> list[Court]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = db.execute(
        select(Reservation.court_id, func.count())
        .where(Reservation.status.in_(_REAL_BOOKING_STATUSES))
        .where(Reservation.created_at >= since)
        .group_by(Reservation.court_id)
        .order_by(func.count().desc())
        .limit(limit)
    ).all()
    courts = [db.get(Court, court_id) for court_id, _ in rows]
    return _attach_ratings(db, [c for c in courts if c is not None and c.active])


@router.get("/recommended", response_model=list[CourtOut])
def list_recommended_courts(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Court]:
    """Courts of the sport the player books most, that they haven't tried
    yet — a simple, explainable heuristic rather than anything ML-based.
    Falls back gracefully (any unplayed court, then just top-rated overall)
    instead of ever coming back empty once someone's a regular."""
    played_court_ids = set(
        db.scalars(
            select(Reservation.court_id)
            .where(Reservation.user_id == current_user.id)
            .where(Reservation.status.in_(_REAL_BOOKING_STATUSES))
            .distinct()
        )
    )

    favorite_sport = db.execute(
        select(Court.sport_type, func.count())
        .join(Reservation, Reservation.court_id == Court.id)
        .where(Reservation.user_id == current_user.id)
        .where(Reservation.status.in_(_REAL_BOOKING_STATUSES))
        .group_by(Court.sport_type)
        .order_by(func.count().desc())
        .limit(1)
    ).first()

    def _ranked(stmt) -> list[Court]:
        courts = _attach_ratings(db, list(db.scalars(stmt)))
        courts.sort(key=lambda c: (c.average_rating is None, -(c.average_rating or 0)))
        return courts

    base = select(Court).where(Court.active.is_(True))
    unplayed = base.where(Court.id.notin_(played_court_ids)) if played_court_ids else base

    candidates = _ranked(unplayed.where(Court.sport_type == favorite_sport[0])) if favorite_sport is not None else []
    if not candidates:
        candidates = _ranked(unplayed)
    if not candidates:
        candidates = _ranked(base)
    return candidates[:limit]


@router.get("/{court_id}", response_model=CourtOut)
def get_court(court_id: uuid.UUID, db: Session = Depends(get_db)) -> Court:
    court = _get_court(db, court_id)
    if not court.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")
    _attach_ratings(db, [court])
    return court


@router.get("/{court_id}/availability", response_model=CourtAvailability)
def get_court_availability(
    court_id: uuid.UUID,
    date: date_type = Query(..., description="Day to check, in the venue's local calendar (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
) -> CourtAvailability:
    court = _get_court(db, court_id)

    opens_at = datetime.combine(date, datetime.min.time(), tzinfo=VENUE_TZ).replace(hour=OPENING_HOUR)
    closes_at = datetime.combine(date, datetime.min.time(), tzinfo=VENUE_TZ).replace(hour=CLOSING_HOUR)

    stmt = (
        select(Reservation)
        .where(Reservation.court_id == court.id)
        .where(Reservation.status.in_(ACTIVE_RESERVATION_STATUSES))
        .where(Reservation.start_time < closes_at)
        .where(Reservation.end_time > opens_at)
        .order_by(Reservation.start_time)
    )
    busy = list(db.scalars(stmt))

    return CourtAvailability(
        court_id=str(court.id),
        date=date.isoformat(),
        opens_at=opens_at.isoformat(),
        closes_at=closes_at.isoformat(),
        busy=[BusySlot(start_time=r.start_time, end_time=r.end_time, status=r.status) for r in busy],
    )


@router.post("", response_model=CourtOut, status_code=status.HTTP_201_CREATED)
def create_court(
    payload: CourtCreate,
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> Court:
    existing = db.scalar(select(Court).where(Court.name == payload.name))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A court with that name already exists")

    court = Court(**payload.model_dump())
    db.add(court)
    db.commit()
    db.refresh(court)
    return court


@router.patch("/{court_id}", response_model=CourtOut)
def update_court(
    court_id: uuid.UUID,
    payload: CourtUpdate,
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> Court:
    court = _get_court(db, court_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(court, field, value)
    db.commit()
    db.refresh(court)
    return court


@router.post("/{court_id}/image", response_model=CourtOut)
def upload_court_image(
    court_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> Court:
    court = _get_court(db, court_id)
    raw = file.file.read()
    court.image_url = compress_and_store_court_image(file, raw)
    db.commit()
    db.refresh(court)
    return court
