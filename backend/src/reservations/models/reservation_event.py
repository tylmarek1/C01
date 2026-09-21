import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class ReservationEventType(enum.StrEnum):
    CREATED = "CREATED"
    SUBMITTED = "SUBMITTED"  # PENDING -> PENDING_APPROVAL
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    REJECTED = "REJECTED"
    NO_SHOW = "NO_SHOW"
    TIME_CHANGED = "TIME_CHANGED"


class ReservationEvent(Base):
    """Append-only audit trail — one row per status transition or edit, so a
    reservation's full history can be reconstructed and shown to the user."""

    __tablename__ = "reservation_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    reservation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reservations.id"))
    event_type: Mapped[ReservationEventType] = mapped_column(Enum(ReservationEventType, name="reservation_event_type"))
    # Null actor means the system (background worker) made the change.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), default=None)
    note: Mapped[str | None] = mapped_column(String(500), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
