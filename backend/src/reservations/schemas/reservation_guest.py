import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from reservations.schemas.auth import UserOut


class GuestInvite(BaseModel):
    email: EmailStr


class ReservationGuestOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user: UserOut
    created_at: datetime
