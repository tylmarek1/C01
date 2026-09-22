import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from reservations.models import SportType, TeamRole
from reservations.schemas.auth import UserOut


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    sport_type: SportType | None = None
    description: str | None = Field(default=None, max_length=500)


class TeamMemberAdd(BaseModel):
    # user_id is the primary path now that the frontend has a player-search
    # box (an id is already in hand once someone is picked from it); email
    # stays as a fallback for adding someone by an address you already know
    # without searching. Exactly one of the two must be given.
    email: EmailStr | None = None
    user_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def exactly_one_target(self) -> "TeamMemberAdd":
        if (self.email is None) == (self.user_id is None):
            raise ValueError("Provide exactly one of email or user_id")
        return self


class TeamMemberOut(BaseModel):
    user: UserOut
    role: TeamRole
    joined_at: datetime


class TeamOut(BaseModel):
    id: uuid.UUID
    name: str
    sport_type: SportType | None
    description: str | None
    created_by: uuid.UUID
    created_at: datetime
    members: list[TeamMemberOut]
    my_role: TeamRole
