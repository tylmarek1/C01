import uuid

from sqlalchemy import Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base
from reservations.models.court import SportType


class SkillRating(Base):
    """One Elo-style rating per user per sport — created lazily (default
    1000) the first time a match result touches that sport for that user."""

    __tablename__ = "skill_ratings"
    __table_args__ = (
        UniqueConstraint("user_id", "sport_type", name="skill_rating_unique"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    sport_type: Mapped[SportType] = mapped_column(Enum(SportType, name="sport_type"))
    rating: Mapped[int] = mapped_column(default=1000)
    matches_played: Mapped[int] = mapped_column(default=0)
