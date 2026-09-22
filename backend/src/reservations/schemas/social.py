import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from reservations.schemas.achievement import AchievementOut
from reservations.schemas.auth import UserOut
from reservations.schemas.rating import SkillRatingOut


class PlayerProfileStats(BaseModel):
    completed_reservations: int
    distinct_courts_played: int
    sports_played: int
    current_streak_weeks: int
    achievements: list[AchievementOut]
    ratings: list[SkillRatingOut]


class PlayerProfileOut(BaseModel):
    user: UserOut
    bio: str | None
    profile_public: bool
    is_self: bool
    is_following: bool
    followers_count: int
    following_count: int
    # None when the profile is private and the viewer isn't its owner —
    # the profile itself (name/avatar/follow button) still resolves, only
    # the stats/bio are withheld.
    stats: PlayerProfileStats | None


class FollowerOut(BaseModel):
    user: UserOut
    followed_at: datetime


class PlayerSearchResult(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None = None


class ProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=300)
    profile_public: bool | None = None
