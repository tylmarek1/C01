import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from reservations.models import SportType
from reservations.schemas.achievement import AchievementOut
from reservations.schemas.auth import UserOut
from reservations.schemas.rating import SkillRatingOut


class PlayerSearchResult(BaseModel):
    id: uuid.UUID
    name: str
    avatar_url: str | None = None


class RecentMatchOut(BaseModel):
    reservation_id: uuid.UUID
    court_name: str
    sport_type: SportType
    played_at: datetime
    # Both only set for a 1-on-1 reservation (booker + exactly one guest) —
    # same scope restriction as MatchResult/ratings.py, since a group
    # booking has no well-defined opponent.
    opponent: PlayerSearchResult | None = None
    result: Literal["win", "loss", "draw"] | None = None


class PlayerProfileStats(BaseModel):
    completed_reservations: int
    distinct_courts_played: int
    sports_played: int
    current_streak_weeks: int
    achievements: list[AchievementOut]
    ratings: list[SkillRatingOut]
    recent_matches: list[RecentMatchOut]


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


class ProfileUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=300)
    profile_public: bool | None = None
