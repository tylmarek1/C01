"""Shared test setup for the venue model (ADR-008).

Most tests don't care which venue a court belongs to, only that it has one,
and that a manager they create may manage it. Both use one "Test Venue".
Not named `test_*` / not a conftest so pytest neither collects nor
auto-imports it — test modules import what they need explicitly."""

import uuid

from sqlalchemy.orm import Session

from reservations.models import User, UserRole, Venue, VenueManager

DEFAULT_VENUE_NAME = "Test Venue"


def default_venue_id(session: Session) -> uuid.UUID:
    venue = session.query(Venue).filter_by(name=DEFAULT_VENUE_NAME).first()
    if venue is None:
        venue = Venue(name=DEFAULT_VENUE_NAME)
        session.add(venue)
        session.flush()
    return venue.id


def make_venue_manager(
    session: Session, user: User, venue_id: uuid.UUID | None = None
) -> None:
    """Give `user` the VENUE_MANAGER role and assign them to a venue (the
    default test venue unless one is given)."""
    user.role = UserRole.VENUE_MANAGER
    session.flush()
    session.add(
        VenueManager(venue_id=venue_id or default_venue_id(session), user_id=user.id)
    )
    session.flush()


def make_venue(session: Session, name: str) -> uuid.UUID:
    venue = Venue(name=name)
    session.add(venue)
    session.flush()
    return venue.id
