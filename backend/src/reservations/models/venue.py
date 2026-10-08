import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.user import User


class Venue(Base):
    """A sports facility that owns courts (ADR-008). A venue manager can
    manage only the venues they're assigned to; an admin manages all."""

    __tablename__ = "venues"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    address: Mapped[str | None] = mapped_column(String(200), default=None)
    description: Mapped[str | None] = mapped_column(String(500), default=None)
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class VenueManager(Base):
    """Assigns a VENUE_MANAGER user to one venue. Only admins create these."""

    __tablename__ = "venue_managers"
    __table_args__ = (
        UniqueConstraint("venue_id", "user_id", name="venue_manager_once"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    venue: Mapped[Venue] = relationship()
    user: Mapped[User] = relationship()
