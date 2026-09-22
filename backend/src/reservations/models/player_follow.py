import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class PlayerFollow(Base):
    """One-directional "I follow this player" relationship — no accept/
    decline handshake, matching how ReservationGuest invites already work
    in this codebase."""

    __tablename__ = "player_follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "followee_id", name="player_follow_unique"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    follower_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    followee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
