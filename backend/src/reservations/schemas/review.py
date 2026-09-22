import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from reservations.schemas.auth import UserOut


class ReviewCreate(BaseModel):
    reservation_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewReplyCreate(BaseModel):
    reply: str = Field(min_length=1, max_length=1000)


class ReviewImageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    url: str


class ReviewOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    court_id: uuid.UUID
    reservation_id: uuid.UUID
    rating: int
    comment: str | None
    created_at: datetime
    user: UserOut
    manager_reply: str | None = None
    manager_reply_at: datetime | None = None
    # Populated only by the list endpoints (one aggregate query per page) —
    # left at defaults wherever a review is nested inside another response.
    helpful_count: int = 0
    voted_helpful_by_me: bool = False
    images: list[ReviewImageOut] = []
