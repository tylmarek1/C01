import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from reservations.models import Amenity, SportType
from reservations.schemas.time_of_day import TimeOfDay, to_minute


class CourtImageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    url: str
    position: int


class CourtOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    venue_id: uuid.UUID
    sport_type: SportType
    indoor: bool
    active: bool
    requires_approval: bool = False
    description: str | None = None
    image_url: str | None = None
    amenities: list[str] = []
    price_per_hour: float | None = None
    # Populated only by endpoints that bother computing it (list/detail) —
    # left as None/0 wherever a court is just nested inside another response.
    average_rating: float | None = None
    review_count: int = 0
    # Additional gallery photos beyond the single cover `image_url`; empty
    # unless the endpoint calls `_attach_images` (list/detail, same pattern
    # as `average_rating`/`review_count`).
    images: list[CourtImageOut] = []


class CourtCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    # Optional while a manager manages exactly one venue (or, for an admin,
    # while only one venue exists) — then the court goes there (ADR-008).
    venue_id: uuid.UUID | None = None
    sport_type: SportType
    indoor: bool = False
    requires_approval: bool = False
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)
    amenities: list[Amenity] = []
    price_per_hour: float | None = Field(default=None, ge=0)


class CourtUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    sport_type: SportType | None = None
    indoor: bool | None = None
    active: bool | None = None
    requires_approval: bool | None = None
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=500)
    amenities: list[Amenity] | None = None
    price_per_hour: float | None = Field(default=None, ge=0)


class PriceRuleIn(BaseModel):
    """An hourly rate for one weekday between two venue-local times; outside
    every rule the court's `price_per_hour` applies."""

    model_config = {"from_attributes": True}

    weekday: int = Field(ge=0, le=6, description="0 = Monday … 6 = Sunday")
    starts_at: TimeOfDay
    ends_at: TimeOfDay
    price_per_hour: float = Field(ge=0)

    @model_validator(mode="after")
    def starts_before_it_ends(self) -> "PriceRuleIn":
        if to_minute(self.starts_at) >= to_minute(self.ends_at):
            raise ValueError("starts_at must be before ends_at")
        return self


class PriceRulesUpdate(BaseModel):
    rules: list[PriceRuleIn] = Field(max_length=200)


class PriceQuote(BaseModel):
    court_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    # None when (part of) the slot has no published rate.
    price_total: float | None
