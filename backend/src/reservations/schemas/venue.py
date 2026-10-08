import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from reservations.schemas.auth import UserOut


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
