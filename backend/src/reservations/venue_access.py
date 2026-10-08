"""Which venues a user may manage (ADR-008).

`get_current_manager` (deps.py) still answers "is this a manager at all";
these helpers answer "a manager of *what*". An ADMIN manages every venue; a
VENUE_MANAGER only the venues in `venue_managers`; anyone else none."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, select, true
from sqlalchemy.orm import Session

from reservations.models import Court, User, UserRole, VenueManager


def managed_venue_ids(db: Session, user: User) -> set[uuid.UUID] | None:
    """None means "every venue" (an admin); otherwise the explicit set."""
    if user.role == UserRole.ADMIN:
        return None
    if user.role != UserRole.VENUE_MANAGER:
        return set()
    return set(
        db.scalars(select(VenueManager.venue_id).where(VenueManager.user_id == user.id))
    )


def manages_venue(db: Session, user: User, venue_id: uuid.UUID) -> bool:
    venues = managed_venue_ids(db, user)
    return venues is None or venue_id in venues


def require_venue_manager(db: Session, user: User, venue_id: uuid.UUID) -> None:
    if not manages_venue(db, user, venue_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't manage this venue")


def require_court_manager(db: Session, user: User, court: Court) -> None:
    require_venue_manager(db, user, court.venue_id)


def managed_courts_filter(
    db: Session, user: User, court_id_column: ColumnElement
) -> ColumnElement[bool]:
    """A WHERE clause limiting a query to courts the user manages — for the
    manager-facing lists and reports."""
    venues = managed_venue_ids(db, user)
    if venues is None:
        return true()
    return court_id_column.in_(select(Court.id).where(Court.venue_id.in_(venues)))
