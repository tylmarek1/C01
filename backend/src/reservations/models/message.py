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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    sender: Mapped[User] = relationship()
