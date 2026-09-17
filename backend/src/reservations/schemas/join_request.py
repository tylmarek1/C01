import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from reservations.models import JoinRequestStatus
from reservations.schemas.auth import UserOut


class JoinRequestCreate(BaseModel):
    note: str | None = Field(default=None, max_length=200)


class JoinRequestOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user: UserOut
    status: JoinRequestStatus
    note: str | None
    created_at: datetime


class JoinRequestReservationOut(JoinRequestOut):
    """Same as JoinRequestOut, plus which reservation it's for — used on the
    requester's own "my join requests" listing."""

    reservation_id: uuid.UUID
