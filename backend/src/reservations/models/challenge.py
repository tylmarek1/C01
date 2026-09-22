import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base
from reservations.models.court import SportType


class ChallengeMetric(enum.StrEnum):
    RESERVATIONS_COMPLETED = "RESERVATIONS_COMPLETED"
    COURTS_PLAYED = "COURTS_PLAYED"
    GUESTS_INVITED = "GUESTS_INVITED"
    REVIEWS_WRITTEN = "REVIEWS_WRITTEN"


class Challenge(Base):
    """A time-boxed goal, e.g. "play 10 sessions this autumn" — mirrors
    achievements.py's catalog/check shape, but admin/manager-authored via
    the API instead of hardcoded in code, so a manager can run a new
    seasonal push without a redeploy."""

    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500))
    # Optional — a challenge can span all sports.
    sport_type: Mapped[SportType | None] = mapped_column(
        Enum(SportType, name="sport_type"), default=None
    )
    metric: Mapped[ChallengeMetric] = mapped_column(
        Enum(ChallengeMetric, name="challenge_metric")
    )
    target: Mapped[int] = mapped_column()
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
