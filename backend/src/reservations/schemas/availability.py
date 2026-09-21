import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

from reservations.models import ReservationStatus
from reservations.schemas.reservation import validate_slot_shape


class BusySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    status: ReservationStatus


class CourtAvailability(BaseModel):
    court_id: str
    date: str
    opens_at: str
    closes_at: str
    busy: list[BusySlot]


class AvailabilityCheckQuery(BaseModel):
    """Query string of GET /courts/{id}/availability/check — the interval must
    be a valid slot (BR-01, BR-04)."""

    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def validate_interval(self) -> "AvailabilityCheckQuery":
        validate_slot_shape(self.start_time, self.end_time)
        return self


class AvailabilityVerdict(BaseModel):
    court_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    available: bool
    reason: Literal["RESERVATION_OVERLAP", "FACILITY_BLOCK"] | None = None
