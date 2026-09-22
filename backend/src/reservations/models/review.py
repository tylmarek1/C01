import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.court import Court
from reservations.models.user import User


class Review(Base):
    """One review per completed reservation — you can only rate a court you
    actually played on, and only once per visit."""

    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="review_rating_range"),
        UniqueConstraint("reservation_id", name="review_one_per_reservation"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reservation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reservations.id"))
    rating: Mapped[int] = mapped_column()
    comment: Mapped[str | None] = mapped_column(String(1000), default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # A venue manager's public reply — at most one per review, so a nullable
    # pair of columns is simpler than a second table.
    manager_reply: Mapped[str | None] = mapped_column(String(1000), default=None)
    manager_reply_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    court: Mapped[Court] = relationship()
    user: Mapped[User] = relationship()
