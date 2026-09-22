import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from reservations.models import SportType, TeamRole
from reservations.schemas.auth import UserOut


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    sport_type: SportType | None = None
    description: str | None = Field(default=None, max_length=500)


class TeamMemberAdd(BaseModel):
    # By email, not id — matches how inviting a guest to a reservation
    # already works (GuestInvite), rather than requiring the frontend to
    # already know the target's opaque user id.
    email: EmailStr


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
