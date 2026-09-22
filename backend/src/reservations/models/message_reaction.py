import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base

# A fixed, small palette rather than a free-text emoji picker — keeps
# server-side validation trivial and avoids designing a whole emoji-picker
# UI for a "wire in reactions" request that didn't ask for one.
ALLOWED_REACTION_EMOJI = ("👍", "❤️", "😂", "😮", "😢", "🎉")


class MessageReaction(Base):
    """One (message, user, emoji) reaction. Toggled, not incremented — the
    same user reacting with the same emoji twice removes it (see
    api/chat.py's react_to_message)."""

    __tablename__ = "message_reactions"
    __table_args__ = (
        UniqueConstraint(
            "message_id", "user_id", "emoji", name="message_reaction_unique"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("messages.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    emoji: Mapped[str] = mapped_column(String(8))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
