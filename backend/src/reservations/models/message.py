import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from reservations.db import Base
from reservations.models.user import User


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id"))
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(String(1000))
    # Relative path under /static, same convention as ReviewImage.url —
    # optional, a message can be image-only (empty body) or text-only.
    image_url: Mapped[str | None] = mapped_column(String(500), default=None)
    # Soft-delete: a tombstone reads better in a conversation than the row
    # just vanishing mid-thread. Set alongside clearing body/image_url so a
    # deleted message doesn't keep serving its content.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    sender: Mapped[User] = relationship()
