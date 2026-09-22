import uuid
from datetime import datetime

from pydantic import BaseModel

from reservations.models import SportType
from reservations.schemas.auth import UserOut


class MatchResultCreate(BaseModel):
    # None means a friendly/draw — no winner.
    winner_user_id: uuid.UUID | None = None


class MatchResultOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    reservation_id: uuid.UUID
    reported_by: uuid.UUID
    winner_user_id: uuid.UUID | None
    created_at: datetime


class SkillRatingOut(BaseModel):
    model_config = {"from_attributes": True}

    sport_type: SportType
    rating: int
    matches_played: int


class RatingLeaderboardEntry(BaseModel):
    user: UserOut
    sport_type: SportType
    rating: int
    matches_played: int
    rank: int
