import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.court import Court
from reservations.models.user import User


class WaitlistStatus(enum.StrEnum):
    WAITING = "WAITING"
    OFFERED = "OFFERED"
    ACCEPTED = "ACCEPTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class WaitlistEntry(Base):
    """A user queued for one exact court+slot that was full when they asked.
    First-in-line gets a time-boxed offer when the slot frees up."""

    __tablename__ = "waitlist_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[WaitlistStatus] = mapped_column(Enum(WaitlistStatus, name="waitlist_status"), default=WaitlistStatus.WAITING)
    offer_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    court: Mapped[Court] = relationship()
    user: Mapped[User] = relationship()
