import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.reservation import Reservation
from reservations.models.user import User


class PaymentStatus(enum.StrEnum):
    PENDING = "PENDING"  # created, the gateway hasn't answered yet
    PAID = "PAID"
    FAILED = "FAILED"  # the charge was declined (or abandoned) — nothing was taken
    REFUND_PENDING = (
        "REFUND_PENDING"  # the reservation was released; the worker refunds it
    )
    REFUNDED = "REFUNDED"
    REFUND_FAILED = "REFUND_FAILED"  # the gateway kept refusing; needs a person


class PaymentMethod(enum.StrEnum):
    ONLINE = "ONLINE"  # through the payment gateway (a mock for now, ADR-010)
    CASH = "CASH"  # recorded by a venue manager at the desk


# A reservation has at most one payment that still holds or owes money.
LIVE_PAYMENT_STATUSES = (
    PaymentStatus.PENDING,
    PaymentStatus.PAID,
    PaymentStatus.REFUND_PENDING,
)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        Index(
            "payment_one_live_per_reservation",
            "reservation_id",
            unique=True,
            postgresql_where=text("status IN ('PENDING', 'PAID', 'REFUND_PENDING')"),
        ),
        CheckConstraint("amount > 0", name="payment_amount_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reservations.id"), index=True
    )
    # Who paid — the booker online, or the booker a manager took cash from.
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    currency: Mapped[str] = mapped_column(String(3), default="CZK")
    method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method")
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.PENDING
    )
    provider: Mapped[str | None] = mapped_column(String(30), default=None)
    # The gateway's id for the charge; refunds are made against it.
    provider_ref: Mapped[str | None] = mapped_column(String(100), default=None)
    failure_reason: Mapped[str | None] = mapped_column(String(300), default=None)
    refund_attempts: Mapped[int] = mapped_column(default=0)
    # Set for CASH: the manager who took the money.
    recorded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    refunded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    reservation: Mapped[Reservation] = relationship()
    user: Mapped[User] = relationship(foreign_keys=[user_id])
