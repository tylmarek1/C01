import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class ReviewVote(Base):
    """A "this review was helpful" vote — one per user per review, toggled
    on/off, used to sort reviews by usefulness instead of just recency."""

    __tablename__ = "review_votes"
    __table_args__ = (UniqueConstraint("review_id", "user_id", name="review_vote_unique_per_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reviews.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
