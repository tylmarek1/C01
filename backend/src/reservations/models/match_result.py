import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class MatchResult(Base):
    """One result per reservation, reported by either participant. Only
    meaningful for a 1-on-1 reservation (booker + exactly one guest) — see
    ratings.py for why a looser group booking has no well-defined winner."""

    __tablename__ = "match_results"
    __table_args__ = (
        UniqueConstraint("reservation_id", name="match_result_one_per_reservation"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    reservation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reservations.id"))
    reported_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    # None = a friendly/draw — no winner, ratings still update via the draw case.
    winner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
