"""Venue opening hours, read from the database (ADR-009).

Times are venue-local wall-clock minutes since midnight. Every comparison
converts the instant to VENUE_TZ first (known pitfall #1)."""

import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.models import Venue, VenueOpeningHours
from reservations.schemas.reservation import VENUE_TZ

# What a new venue starts with: every day 07:00–22:00 — the hours the whole
# app had hardcoded before ADR-009, and what migration 0004 gave existing venues.
DEFAULT_OPENS_MINUTE = 7 * 60
DEFAULT_CLOSES_MINUTE = 22 * 60


def add_default_hours(db: Session, venue: Venue) -> None:
    for weekday in range(7):
        db.add(
            VenueOpeningHours(
                venue_id=venue.id,
                weekday=weekday,
                opens_minute=DEFAULT_OPENS_MINUTE,
                closes_minute=DEFAULT_CLOSES_MINUTE,
            )
        )


def weekly_hours(db: Session, venue_id: uuid.UUID) -> dict[int, tuple[int, int]]:
    """{weekday: (opens_minute, closes_minute)}; a missing weekday is closed."""
    rows = db.scalars(
        select(VenueOpeningHours).where(VenueOpeningHours.venue_id == venue_id)
    )
    return {row.weekday: (row.opens_minute, row.closes_minute) for row in rows}


def hours_on(
    db: Session, venue_id: uuid.UUID, day: date
) -> tuple[datetime, datetime] | None:
    """Opening and closing instants on a venue-local calendar day, or None
    when the venue is closed that day."""
    hours = weekly_hours(db, venue_id).get(day.weekday())
    return None if hours is None else instants(day, hours)


def instants(day: date, minutes: tuple[int, int]) -> tuple[datetime, datetime]:
    midnight = datetime.combine(day, datetime.min.time(), tzinfo=VENUE_TZ)
    # Adding minutes to a zone-aware midnight keeps the wall-clock meaning
    # on a DST day too (Python datetime arithmetic is wall-clock arithmetic).
    return midnight + timedelta(minutes=minutes[0]), midnight + timedelta(
        minutes=minutes[1]
    )
