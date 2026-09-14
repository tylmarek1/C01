"""Checks shared by new bookings, reschedules, and recurring-series
occurrences — kept out of the route handlers so they stay easy to read."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from reservations import rules
from reservations.models import ACTIVE_RESERVATION_STATUSES, FacilityBlock, Reservation, ReservationStatus, User


def check_facility_available(db: Session, court_id: uuid.UUID, start_time: datetime, end_time: datetime) -> None:
    stmt = (
        select(FacilityBlock)
        .where(FacilityBlock.court_id == court_id)
        .where(FacilityBlock.start_time < end_time)
        .where(FacilityBlock.end_time > start_time)
    )
    block = db.scalar(stmt)
    if block is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Court unavailable: {block.reason}")


def check_within_booking_window(start_time: datetime) -> None:
    now = datetime.now(timezone.utc)
    if start_time < now + timedelta(minutes=rules.MIN_LEAD_MINUTES):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Reservations must start at least {rules.MIN_LEAD_MINUTES} minutes from now",
        )
    if start_time > now + timedelta(days=rules.MAX_ADVANCE_DAYS):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Reservations can only be made up to {rules.MAX_ADVANCE_DAYS} days in advance",
        )


def check_active_reservation_limit(db: Session, user: User) -> None:
    limit = rules.max_active_reservations(user.role)
    stmt = (
        select(func.count())
        .select_from(Reservation)
        .where(Reservation.user_id == user.id)
        .where(Reservation.status.in_(ACTIVE_RESERVATION_STATUSES))
    )
    count = db.scalar(stmt) or 0
    if count >= limit:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"You already have {limit} active reservations — cancel one before booking another",
        )


def check_no_show_penalty(db: Session, user: User) -> None:
    since = datetime.now(timezone.utc) - timedelta(days=rules.NO_SHOW_WINDOW_DAYS)
    stmt = (
        select(func.count())
        .select_from(Reservation)
        .where(Reservation.user_id == user.id)
        .where(Reservation.status == ReservationStatus.NO_SHOW)
        .where(Reservation.start_time >= since)
    )
    count = db.scalar(stmt) or 0
    if count >= rules.NO_SHOW_LIMIT:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"You've missed {count} recent reservations without checking in — "
            f"new bookings are paused for {rules.NO_SHOW_WINDOW_DAYS} days from your last no-show. Contact the venue if this is a mistake.",
        )
