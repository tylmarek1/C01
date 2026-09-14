import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from reservations.schemas.auth import UserOut


class ReviewCreate(BaseModel):
    reservation_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    court_id: uuid.UUID
    reservation_id: uuid.UUID
    rating: int
    comment: str | None
    created_at: datetime
    user: UserOut
