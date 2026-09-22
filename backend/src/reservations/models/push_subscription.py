import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class PushSubscription(Base):
    """One browser/device's Web Push subscription for a user. A user can
    have several (one per browser/device they enabled notifications on);
    `endpoint` is unique across all users, mirroring the Push API's own
    identity for a subscription."""

    __tablename__ = "push_subscriptions"
    __table_args__ = (
        UniqueConstraint("endpoint", name="push_subscription_unique_endpoint"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    endpoint: Mapped[str] = mapped_column(String(1000))
    p256dh: Mapped[str] = mapped_column(String(255))
    auth: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
