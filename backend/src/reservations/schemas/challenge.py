import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from reservations.models import ChallengeMetric, SportType


class ChallengeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=500)
    sport_type: SportType | None = None
    metric: ChallengeMetric
    target: int = Field(ge=1)
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def _check_window(self) -> "ChallengeCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class ChallengeOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    title: str
    description: str
    sport_type: SportType | None
    metric: ChallengeMetric
    target: int
    starts_at: datetime
    ends_at: datetime
    created_by: uuid.UUID
    # How many players have completed it so far — cheap (a persisted
    # ChallengeCompletion row per completion), unlike a live "how many are
    # currently making progress" count, which isn't tracked anywhere and
    # would mean scanning every player's progress on every list call.
    completed_count: int = 0


class ChallengeProgressOut(ChallengeOut):
    progress: int
    completed: bool
    completed_at: datetime | None
