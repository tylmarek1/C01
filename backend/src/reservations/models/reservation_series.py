import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.court import Court
from reservations.models.user import User


class ReservationSeries(Base):
    """A weekly-recurring booking request. Each occurrence is a normal
    Reservation row (series_id pointing back here) so the rest of the app
    (availability, cancellation, waitlist...) never needs to know series exist."""

    __tablename__ = "reservation_series"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    first_start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    first_end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    weeks: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    court: Mapped[Court] = relationship()
    user: Mapped[User] = relationship()
