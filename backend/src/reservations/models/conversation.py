import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class ConversationKind(enum.StrEnum):
    DM = "DM"
    RESERVATION = "RESERVATION"
    TEAM = "TEAM"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    kind: Mapped[ConversationKind] = mapped_column(
        Enum(ConversationKind, name="conversation_kind")
    )
    # Only set for kind=DM: a stable "smaller-uuid:larger-uuid" key so an
    # existing DM between two users can be looked up idempotently with one
    # indexed query instead of a participants join. Null for RESERVATION/
    # TEAM kinds, which look themselves up by reservation_id (below) or a
    # future team_id instead.
    dm_key: Mapped[str | None] = mapped_column(String(73), unique=True, default=None)
    reservation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reservations.id"), unique=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
