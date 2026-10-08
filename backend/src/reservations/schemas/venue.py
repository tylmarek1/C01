import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from reservations.schemas.auth import UserOut
from reservations.schemas.time_of_day import TimeOfDay, to_minute


class VenueOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    address: str | None = None
    description: str | None = None
    active: bool
    # Active courts only — filled in by the list/detail endpoints.
    court_count: int = 0


class VenueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    address: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=500)


class VenueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    address: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    active: bool | None = None


class VenueManagerOut(BaseModel):
    model_config = {"from_attributes": True}

    user: UserOut
    created_at: datetime


class OpeningHoursDay(BaseModel):
    """One open weekday. A weekday missing from the list is closed."""

    weekday: int = Field(ge=0, le=6, description="0 = Monday … 6 = Sunday")
    opens_at: TimeOfDay
    closes_at: TimeOfDay

    @model_validator(mode="after")
    def opens_before_it_closes(self) -> "OpeningHoursDay":
        if to_minute(self.opens_at) >= to_minute(self.closes_at):
            raise ValueError("opens_at must be before closes_at")
        return self


class OpeningHoursUpdate(BaseModel):
    days: list[OpeningHoursDay] = Field(max_length=7)

    @model_validator(mode="after")
    def one_entry_per_weekday(self) -> "OpeningHoursUpdate":
        weekdays = [day.weekday for day in self.days]
        if len(weekdays) != len(set(weekdays)):
            raise ValueError("each weekday may appear only once")
        return self
