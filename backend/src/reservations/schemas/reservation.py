import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from reservations.models import ReservationEventType, ReservationStatus
from reservations.schemas.auth import UserOut
from reservations.schemas.court import CourtOut
from reservations.schemas.reservation_guest import ReservationGuestOut

ALLOWED_DURATIONS_MINUTES = {60, 90, 120}
OPENING_HOUR = 7
CLOSING_HOUR = 22
# Opening hours are a wall-clock rule at the venue, not at whatever UTC
# offset a client happens to send — always check it in the venue's own zone.
VENUE_TZ = ZoneInfo("Europe/Prague")


def validate_slot_shape(start_time: datetime, end_time: datetime) -> None:
    """Duration, opening hours, and on-the-half-hour checks shared by new
    bookings, reschedules, and recurring-series occurrences."""
    if start_time.tzinfo is None or end_time.tzinfo is None:
        raise ValueError("start_time and end_time must include a timezone offset")
    if end_time <= start_time:
        raise ValueError("end_time must be after start_time")

    duration_minutes = (end_time - start_time).total_seconds() / 60
    if duration_minutes not in ALLOWED_DURATIONS_MINUTES:
        raise ValueError("reservation must be 60, 90 or 120 minutes long")

    local_start = start_time.astimezone(VENUE_TZ)
    local_end = end_time.astimezone(VENUE_TZ)

    if local_start.minute not in (0, 30):
        raise ValueError("reservation must start on the hour or half hour")

    opens_at = local_start.replace(hour=OPENING_HOUR, minute=0, second=0, microsecond=0)
    closes_at = local_start.replace(
        hour=CLOSING_HOUR, minute=0, second=0, microsecond=0
    )
    if local_start < opens_at or local_end > closes_at:
        raise ValueError("reservation must lie within opening hours 07:00-22:00")


class ReservationCreate(BaseModel):
    court_id: uuid.UUID
    start_time: datetime
    end_time: datetime

    @field_validator("start_time")
    @classmethod
    def start_time_must_be_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start_time must include a timezone offset")
        return value

    @field_validator("end_time")
    @classmethod
    def validate_slot(cls, end_time: datetime, info: ValidationInfo) -> datetime:
        start_time: datetime | None = info.data.get("start_time")
        if start_time is None:
            return end_time
        validate_slot_shape(start_time, end_time)
        return end_time


class ReservationOpenUpdate(BaseModel):
    open_to_join: bool
    open_note: str | None = Field(default=None, max_length=200)


class ReservationReschedule(BaseModel):
    start_time: datetime
    end_time: datetime

    @field_validator("start_time")
    @classmethod
    def start_time_must_be_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start_time must include a timezone offset")
        return value

    @field_validator("end_time")
    @classmethod
    def validate_slot(cls, end_time: datetime, info: ValidationInfo) -> datetime:
        start_time: datetime | None = info.data.get("start_time")
        if start_time is None:
            return end_time
        validate_slot_shape(start_time, end_time)
        return end_time


class ReservationSeriesCreate(BaseModel):
    court_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    weeks: int = Field(ge=2, le=26)

    @field_validator("start_time")
    @classmethod
    def start_time_must_be_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start_time must include a timezone offset")
        return value

    @field_validator("end_time")
    @classmethod
    def validate_slot(cls, end_time: datetime, info: ValidationInfo) -> datetime:
        start_time: datetime | None = info.data.get("start_time")
        if start_time is None:
            return end_time
        validate_slot_shape(start_time, end_time)
        return end_time


class ReservationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    court: CourtOut
    start_time: datetime
    end_time: datetime
    status: ReservationStatus
    hold_expires_at: datetime | None
    approval_expires_at: datetime | None
    series_id: uuid.UUID | None
    open_to_join: bool
    open_note: str | None
    created_at: datetime


class ReservationAdminOut(ReservationOut):
    """Same as ReservationOut, plus who booked it — for venue-manager views only."""

    user: UserOut
    guests: list[ReservationGuestOut] = []


class OpenGameOut(ReservationOut):
    """A reservation browsed via GET /reservations/open — includes the
    booker (so you know who you'd be playing with) and remaining capacity."""

    user: UserOut
    spots_left: int


class ReservationSplitParticipant(BaseModel):
    user: UserOut
    share: float


class ReservationSplit(BaseModel):
    total_cost: float | None
    currency_note: str = "Informational only — no payment is processed."
    duration_hours: float
    participant_count: int
    per_person: float | None
    participants: list[ReservationSplitParticipant]


class ReservationEventOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    event_type: ReservationEventType
    actor_id: uuid.UUID | None
    actor: UserOut | None
    note: str | None
    created_at: datetime


class ReservationSeriesOut(BaseModel):
    series_id: uuid.UUID
    requested_occurrences: int
    booked: list[ReservationOut]
    failed_weeks: list[int]
