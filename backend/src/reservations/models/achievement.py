import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class UserAchievement(Base):
    """One row per achievement a user has unlocked. The catalog of possible
    achievements lives in code (reservations.achievements) — this table only
    records who has earned which key and when."""

    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "key", name="user_achievement_unique"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    key: Mapped[str] = mapped_column(String(50))
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
