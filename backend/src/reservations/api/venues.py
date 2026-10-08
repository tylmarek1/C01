"""Venues and their manager assignments (ADR-008).

Creating a venue and (un)assigning managers is admin-only; a venue's own
managers may edit its details and see who else manages it."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from reservations.deps import (
    get_current_admin,
    get_current_manager,
    get_db,
    get_optional_user,
)
from reservations.models import Court, User, UserRole, Venue, VenueManager
from reservations.schemas.venue import (
    VenueCreate,
    VenueManagerOut,
    VenueOut,
    VenueUpdate,
)
from reservations.venue_access import managed_venue_ids, require_venue_manager

router = APIRouter(prefix="/venues", tags=["venues"])


def _get_venue(db: Session, venue_id: uuid.UUID) -> Venue:
    venue = db.get(Venue, venue_id)
    if venue is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venue not found")
    return venue


def _with_court_counts(db: Session, venues: list[Venue]) -> list[VenueOut]:
    counts = dict(
        db.execute(
            select(Court.venue_id, func.count())
            .where(Court.venue_id.in_([v.id for v in venues]))
            .where(Court.active.is_(True))
            .group_by(Court.venue_id)
        ).all()
    )
    return [
        VenueOut.model_validate(v).model_copy(
            update={"court_count": counts.get(v.id, 0)}
        )
        for v in venues
    ]


def _managers(db: Session, venue_id: uuid.UUID) -> list[VenueManager]:
    stmt = (
        select(VenueManager)
        .options(selectinload(VenueManager.user))
        .where(VenueManager.venue_id == venue_id)
        .order_by(VenueManager.created_at)
    )
    return list(db.scalars(stmt))


@router.get("", response_model=list[VenueOut])
def list_venues(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> list[VenueOut]:
    if include_inactive and (
        current_user is None or current_user.role != UserRole.ADMIN
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    stmt = select(Venue).order_by(Venue.name)
    if not include_inactive:
        stmt = stmt.where(Venue.active.is_(True))
    return _with_court_counts(db, list(db.scalars(stmt)))


@router.get("/mine", response_model=list[VenueOut])
def list_my_venues(
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> list[VenueOut]:
    """The venues the caller manages — every venue for an admin."""
    venues = managed_venue_ids(db, manager)
    stmt = select(Venue).order_by(Venue.name)
    if venues is not None:
        stmt = stmt.where(Venue.id.in_(venues))
    return _with_court_counts(db, list(db.scalars(stmt)))


@router.get("/{venue_id}", response_model=VenueOut)
def get_venue(venue_id: uuid.UUID, db: Session = Depends(get_db)) -> VenueOut:
    return _with_court_counts(db, [_get_venue(db, venue_id)])[0]


@router.post("", response_model=VenueOut, status_code=status.HTTP_201_CREATED)
def create_venue(
    payload: VenueCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> VenueOut:
    if db.scalar(select(Venue.id).where(Venue.name == payload.name)) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "A venue with that name already exists"
        )
    venue = Venue(**payload.model_dump())
    db.add(venue)
    db.commit()
    db.refresh(venue)
    return _with_court_counts(db, [venue])[0]


@router.patch("/{venue_id}", response_model=VenueOut)
def update_venue(
    venue_id: uuid.UUID,
    payload: VenueUpdate,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> VenueOut:
    venue = _get_venue(db, venue_id)
    require_venue_manager(db, manager, venue.id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] != venue.name:
        if db.scalar(select(Venue.id).where(Venue.name == changes["name"])) is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "A venue with that name already exists"
            )
    for field, value in changes.items():
        setattr(venue, field, value)
    db.commit()
    db.refresh(venue)
    return _with_court_counts(db, [venue])[0]


@router.get("/{venue_id}/managers", response_model=list[VenueManagerOut])
def list_venue_managers(
    venue_id: uuid.UUID,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> list[VenueManager]:
    venue = _get_venue(db, venue_id)
    require_venue_manager(db, manager, venue.id)
    return _managers(db, venue.id)


@router.put("/{venue_id}/managers/{user_id}", response_model=list[VenueManagerOut])
def assign_venue_manager(
    venue_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[VenueManager]:
    """Idempotent. The user must already hold the VENUE_MANAGER role (granted
    through PATCH /admin/users/{id}/role) — assigning doesn't promote."""
    venue = _get_venue(db, venue_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.role != UserRole.VENUE_MANAGER:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a venue manager can be assigned to a venue"
        )
    existing = db.scalar(
        select(VenueManager)
        .where(VenueManager.venue_id == venue.id)
        .where(VenueManager.user_id == user.id)
    )
    if existing is None:
        db.add(VenueManager(venue_id=venue.id, user_id=user.id))
        db.commit()
    return _managers(db, venue.id)


@router.delete("/{venue_id}/managers/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def unassign_venue_manager(
    venue_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> None:
    assignment = db.scalar(
        select(VenueManager)
        .where(VenueManager.venue_id == venue_id)
        .where(VenueManager.user_id == user_id)
    )
    if assignment is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "That user doesn't manage this venue"
        )
    db.delete(assignment)
    db.commit()
