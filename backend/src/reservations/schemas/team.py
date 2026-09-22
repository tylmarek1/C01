import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from reservations.models import SportType, TeamJoinRequestStatus, TeamRole
from reservations.schemas.auth import UserOut


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    sport_type: SportType | None = None
    description: str | None = Field(default=None, max_length=500)


class TeamUpdate(BaseModel):
    """All fields optional (PATCH semantics, like CourtUpdate) — owner/
    captain can edit name/sport/description, but is_public is owner-only,
    enforced in the route handler rather than here since it depends on the
    caller's role, not the payload shape."""

    name: str | None = Field(default=None, min_length=1, max_length=80)
    sport_type: SportType | None = None
    description: str | None = Field(default=None, max_length=500)
    is_public: bool | None = None


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


class TeamMemberRoleUpdate(BaseModel):
    # Owner-only, and only ever toggles a non-owner between CAPTAIN and
    # MEMBER — see api/teams.py's set_member_role for why OWNER is rejected
    # here rather than modeled as a valid target.
    role: TeamRole


class TeamMemberOut(BaseModel):
    user: UserOut
    role: TeamRole
    joined_at: datetime


class TeamOut(BaseModel):
    id: uuid.UUID
    name: str
    sport_type: SportType | None
    description: str | None
    avatar_url: str | None
    is_public: bool
    created_by: uuid.UUID
    created_at: datetime
    members: list[TeamMemberOut]
    my_role: TeamRole


class TeamSummaryOut(BaseModel):
    """The lightweight shape for GET /teams/discover — no roster, so
    browsing public teams doesn't expose their membership to a non-member
    the way TeamOut would."""

    id: uuid.UUID
    name: str
    sport_type: SportType | None
    description: str | None
    avatar_url: str | None
    member_count: int


class TeamJoinRequestOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    team_id: uuid.UUID
    user: UserOut
    status: TeamJoinRequestStatus
    created_at: datetime
