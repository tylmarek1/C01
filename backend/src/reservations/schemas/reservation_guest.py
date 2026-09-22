import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, model_validator

from reservations.schemas.auth import UserOut


class GuestInvite(BaseModel):
    # Same email-or-id shape as TeamMemberAdd (schemas/team.py) and for the
    # same reason: the frontend's player-search box already has the id once
    # someone is picked, email stays as the fallback for a known address.
    email: EmailStr | None = None
    user_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def exactly_one_target(self) -> "GuestInvite":
        if (self.email is None) == (self.user_id is None):
            raise ValueError("Provide exactly one of email or user_id")
        return self


class ReservationGuestOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user: UserOut
    created_at: datetime
