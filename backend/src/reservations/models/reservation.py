import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, func, literal_column, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.court import Court
from reservations.models.user import User


class ReservationStatus(enum.StrEnum):
    PENDING = "PENDING"  # temporary hold; must be confirmed before it expires
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"  # a PENDING hold that timed out unconfirmed
    NO_SHOW = "NO_SHOW"  # confirmed but never checked in before the slot ended


# Statuses that still occupy the court — the exclusion constraint below and
# every "is this slot free" check must agree on this set.
ACTIVE_RESERVATION_STATUSES = (
    ReservationStatus.PENDING,
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
)


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="reservation_time_order"),
        # Half-open ranges '[)' so back-to-back slots (10:00-11:00, 11:00-12:00)
        # are allowed. Any status that still holds the court — including a
        # PENDING hold, not just CONFIRMED — must not overlap another.
        ExcludeConstraint(
            (literal_column("court_id"), "="),
            (literal_column("tstzrange(start_time, end_time, '[)')"), "&&"),
            name="no_overlapping_active_reservations",
            using="gist",
            where=text("status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus, name="reservation_status"), default=ReservationStatus.PENDING
    )
    # Set while PENDING; the background worker expires the hold once this
    # passes. Cleared (NULL) once confirmed.
    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    series_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("reservation_series.id"), default=None)
    # "Find a partner": the booker can open their own slot up for other
    # players to request a guest spot on, instead of inviting people by email.
    open_to_join: Mapped[bool] = mapped_column(default=False)
    open_note: Mapped[str | None] = mapped_column(String(200), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    court: Mapped[Court] = relationship()
    user: Mapped[User] = relationship()
