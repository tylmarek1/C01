import uuid
from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from reservations.booking_validation import find_availability_conflict
from reservations.deps import (
    get_current_admin,
    get_current_manager,
    get_current_user,
    get_db,
    get_optional_user,
)
from reservations.images import compress_and_store_court_image
from reservations.models import (
    ACTIVE_RESERVATION_STATUSES,
    Amenity,
    Court,
    CourtImage,
    FacilityBlock,
    Favorite,
    Reservation,
    ReservationStatus,
    Review,
    SportType,
    User,
    UserRole,
    WaitlistEntry,
)
from reservations.schemas.availability import (
    AvailabilityCheckQuery,
    AvailabilityVerdict,
    BusySlot,
    CourtAvailability,
)
from reservations.schemas.court import CourtCreate, CourtOut, CourtUpdate
from reservations.schemas.reservation import CLOSING_HOUR, OPENING_HOUR, VENUE_TZ

router = APIRouter(prefix="/courts", tags=["courts"])

# A gallery beyond this size stops being useful and starts being an abuse
# vector for unbounded upload storage.
MAX_GALLERY_IMAGES = 8

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


def _attach_images(db: Session, courts: list[Court]) -> list[Court]:
    """Same pattern as `_attach_ratings`: one bulk query for the whole list,
    transient `.images` attribute read by `CourtOut` (from_attributes)."""
    if not courts:
        return courts
    court_ids = [c.id for c in courts]
    stmt = (
        select(CourtImage)
        .where(CourtImage.court_id.in_(court_ids))
        .order_by(CourtImage.position, CourtImage.created_at)
    )
    by_court: dict[uuid.UUID, list[CourtImage]] = {}
    for image in db.scalars(stmt):
        by_court.setdefault(image.court_id, []).append(image)
    for court in courts:
        court.images = by_court.get(court.id, [])
    return courts


@router.get("", response_model=list[CourtOut])
def list_courts(
    sport: SportType | None = None,
    include_inactive: bool = False,
    q: str | None = Query(default=None, description="Search court name/description"),
    amenity: Amenity | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> list[Court]:
    if include_inactive and (
        current_user is None
        or current_user.role not in (UserRole.VENUE_MANAGER, UserRole.ADMIN)
    ):
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
    stmt = stmt.order_by(Court.name).offset(offset).limit(limit)
    courts = _attach_ratings(db, list(db.scalars(stmt)))
    # Needed here (unlike trending/recommended) because this is the endpoint
    # the admin Courts tab's gallery editor reads from after an upload.
    return _attach_images(db, courts)


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
    unplayed = (
        base.where(Court.id.notin_(played_court_ids)) if played_court_ids else base
    )

    candidates = (
        _ranked(unplayed.where(Court.sport_type == favorite_sport[0]))
        if favorite_sport is not None
        else []
    )
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
    # Gallery images are only worth fetching for the single-court detail
    # view — list endpoints skip this to avoid a bulk-N-image payload on
    # every search result.
    _attach_images(db, [court])
    return court


@router.get("/{court_id}/availability", response_model=CourtAvailability)
def get_court_availability(
    court_id: uuid.UUID,
    date: date_type = Query(
        ..., description="Day to check, in the venue's local calendar (YYYY-MM-DD)"
    ),
    db: Session = Depends(get_db),
) -> CourtAvailability:
    court = _get_court(db, court_id)

    opens_at = datetime.combine(date, datetime.min.time(), tzinfo=VENUE_TZ).replace(
        hour=OPENING_HOUR
    )
    closes_at = datetime.combine(date, datetime.min.time(), tzinfo=VENUE_TZ).replace(
        hour=CLOSING_HOUR
    )

    stmt = (
        select(Reservation)
        .where(Reservation.court_id == court.id)
        .where(Reservation.status.in_(ACTIVE_RESERVATION_STATUSES))
        .where(Reservation.start_time < closes_at)
        .where(Reservation.end_time > opens_at)
        .order_by(Reservation.start_time)
    )
    busy = list(db.scalars(stmt))

    # A facility block rejects a new booking the same way an active
    # reservation does (booking_validation.check_facility_available) — the
    # availability timeline must show both, or a slot can look free here and
    # still 409 at submit.
    block_stmt = (
        select(FacilityBlock)
        .where(FacilityBlock.court_id == court.id)
        .where(FacilityBlock.start_time < closes_at)
        .where(FacilityBlock.end_time > opens_at)
        .order_by(FacilityBlock.start_time)
    )
    blocks = list(db.scalars(block_stmt))

    slots = [
        BusySlot(
            start_time=r.start_time,
            end_time=r.end_time,
            source="RESERVATION",
            status=r.status,
        )
        for r in busy
    ] + [
        BusySlot(
            start_time=b.start_time,
            end_time=b.end_time,
            source="FACILITY_BLOCK",
            reason=b.reason,
        )
        for b in blocks
    ]
    slots.sort(key=lambda slot: slot.start_time)

    return CourtAvailability(
        court_id=str(court.id),
        date=date.isoformat(),
        opens_at=opens_at.isoformat(),
        closes_at=closes_at.isoformat(),
        busy=slots,
    )


@router.get("/{court_id}/availability/check", response_model=AvailabilityVerdict)
def check_court_availability(
    court_id: uuid.UUID,
    interval: Annotated[AvailabilityCheckQuery, Query()],
    db: Session = Depends(get_db),
) -> AvailabilityVerdict:
    """OP-02 — is this court free for exactly this interval? Public and
    read-only; a snapshot, so only Create actually guarantees the slot."""
    court = _get_court(db, court_id)
    if not court.active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")

    conflict = find_availability_conflict(
        db, court.id, interval.start_time, interval.end_time
    )
    return AvailabilityVerdict(
        court_id=court.id,
        start_time=interval.start_time,
        end_time=interval.end_time,
        available=conflict is None,
        reason=conflict,
    )


@router.post("", response_model=CourtOut, status_code=status.HTTP_201_CREATED)
def create_court(
    payload: CourtCreate,
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> Court:
    existing = db.scalar(select(Court).where(Court.name == payload.name))
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A court with that name already exists"
        )

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


@router.post(
    "/{court_id}/images", response_model=CourtOut, status_code=status.HTTP_201_CREATED
)
def add_court_gallery_image(
    court_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> Court:
    court = _get_court(db, court_id)
    existing_count = db.scalar(
        select(func.count())
        .select_from(CourtImage)
        .where(CourtImage.court_id == court.id)
    )
    if existing_count >= MAX_GALLERY_IMAGES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"A court can have at most {MAX_GALLERY_IMAGES} gallery photos",
        )

    raw = file.file.read()
    url = compress_and_store_court_image(file, raw)
    db.add(CourtImage(court_id=court.id, url=url, position=existing_count))
    db.commit()
    db.refresh(court)
    _attach_images(db, [court])
    return court


@router.delete("/{court_id}/images/{image_id}", response_model=CourtOut)
def delete_court_gallery_image(
    court_id: uuid.UUID,
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    _manager: User = Depends(get_current_manager),
) -> Court:
    court = _get_court(db, court_id)
    image = db.get(CourtImage, image_id)
    if image is None or image.court_id != court.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gallery image not found")
    db.delete(image)
    db.commit()
    db.refresh(court)
    _attach_images(db, [court])
    return court


@router.delete("/{court_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_court(
    court_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> None:
    """Permanently remove a court — distinct from deactivating one (`active=False`),
    which is what retires a court that has actually been used. Only ever
    allowed for a court with no reservation history, so this can't destroy
    real booking history; the deactivate flag is the tool for that case.

    Locks the court row for the duration of the check + delete: Postgres
    takes an implicit FOR KEY SHARE lock on the referenced court when a new
    Reservation is inserted, so this FOR UPDATE blocks a concurrent booking
    from slipping in between the "no reservations" check and the delete —
    without it, that race could leave the has_reservations check stale and
    turn the delete into an unhandled FK-violation 500 instead of a clean 409.
    """
    court = db.get(Court, court_id, with_for_update=True)
    if court is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Court not found")

    has_reservations = (
        db.scalar(
            select(Reservation.id).where(Reservation.court_id == court.id).limit(1)
        )
        is not None
    )
    if has_reservations:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This court has reservation history and can't be deleted — deactivate it instead",
        )

    # Per-object ORM deletes (not a bulk Core statement) to match every other
    # delete endpoint in this codebase and keep working if these models ever
    # grow an ORM-level cascade/event hook.
    for favorite in db.scalars(select(Favorite).where(Favorite.court_id == court.id)):
        db.delete(favorite)
    for block in db.scalars(
        select(FacilityBlock).where(FacilityBlock.court_id == court.id)
    ):
        db.delete(block)
    for entry in db.scalars(
        select(WaitlistEntry).where(WaitlistEntry.court_id == court.id)
    ):
        db.delete(entry)
    for image in db.scalars(select(CourtImage).where(CourtImage.court_id == court.id)):
        db.delete(image)
    # `CourtImage` has no declared `relationship()` back to `Court` (unlike
    # Favorite/FacilityBlock/WaitlistEntry above), so the unit of work has
    # no dependency edge to order its DELETE before the court's — flush
    # explicitly so the FK is already gone before the court row is.
    db.flush()
    db.delete(court)
    db.commit()
