import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, func, literal_column, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base


class SportType(enum.StrEnum):
    TENNIS = "TENNIS"
    VOLLEYBALL = "VOLLEYBALL"
    BADMINTON = "BADMINTON"


class UserRole(enum.StrEnum):
    PLAYER = "PLAYER"
    VENUE_MANAGER = "VENUE_MANAGER"


class ReservationStatus(enum.StrEnum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class Court(Base):
    __tablename__ = "courts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    sport_type: Mapped[SportType] = mapped_column(Enum(SportType, name="sport_type"))
    indoor: Mapped[bool] = mapped_column(default=False)
    active: Mapped[bool] = mapped_column(default=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), default=UserRole.PLAYER)


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="reservation_time_order"),
        # Common rule: CONFIRMED reservations of the same court must not overlap.
        # Half-open ranges '[)' so back-to-back slots (10:00-11:00, 11:00-12:00) are allowed.
        ExcludeConstraint(
            (literal_column("court_id"), "="),
            (literal_column("tstzrange(start_time, end_time, '[)')"), "&&"),
            name="no_overlapping_confirmed_reservations",
            using="gist",
            where=text("status = 'CONFIRMED'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    court_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courts.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[ReservationStatus] = mapped_column(
        Enum(ReservationStatus, name="reservation_status"), default=ReservationStatus.DRAFT
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    court: Mapped[Court] = relationship()
    user: Mapped[User] = relationship()
