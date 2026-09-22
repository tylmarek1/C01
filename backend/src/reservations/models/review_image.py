import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class ReviewImage(Base):
    """A photo attached to a review by its author — same shape as
    `CourtImage`, one table per gallery-style concept rather than a shared
    generic one."""

    __tablename__ = "review_images"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reviews.id"))
    url: Mapped[str] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
