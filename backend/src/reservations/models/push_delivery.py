import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class PushDeliveryStatus(enum.StrEnum):
    PENDING = "PENDING"  # waiting for (another) attempt by the dispatcher
    SENT = "SENT"
    FAILED = "FAILED"  # gave up after MAX_ATTEMPTS — the in-app row still exists


class PushDelivery(Base):
    """Transactional outbox for Web Push (ADR-005). `notify()` adds a row in
    the same transaction as the business change it reports, so a push exists
    iff that change committed; `push_delivery.py` sends it afterwards,
    outside any reservation row lock, and retries transient failures."""

    __tablename__ = "push_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(String(500))
    status: Mapped[PushDeliveryStatus] = mapped_column(
        Enum(PushDeliveryStatus, name="push_delivery_status"),
        default=PushDeliveryStatus.PENDING,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_error: Mapped[str | None] = mapped_column(String(500), default=None)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
