import uuid

from pydantic import BaseModel, Field

from reservations.models import Amenity, SportType


class CourtImageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    url: str
    position: int


class CourtOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
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
