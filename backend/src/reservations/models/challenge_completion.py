import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class ChallengeCompletion(Base):
    """One row per challenge a user has completed — the exact UserAchievement
    shape (the catalog/definition lives elsewhere, this table only records
    who completed what and when)."""

    __tablename__ = "challenge_completions"
    __table_args__ = (
        UniqueConstraint("challenge_id", "user_id", name="challenge_completion_unique"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("challenges.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
