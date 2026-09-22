import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from reservations.models import ConversationKind
from reservations.schemas.auth import UserOut


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class ReactionToggle(BaseModel):
    # Checked against ALLOWED_REACTION_EMOJI in the route handler.
    emoji: str = Field(min_length=1, max_length=8)


class MessageReactionSummary(BaseModel):
    emoji: str
    count: int
    reacted_by_me: bool


class MessageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender: UserOut
    body: str
    image_url: str | None
    deleted_at: datetime | None
    created_at: datetime
    # Always attached explicitly by the bulk-query-then-transient-attribute
    # pattern (api/chat.py's _attach_reactions) before serialization — the
    # default here is only a safety net, not a real "no reactions" default.
    reactions: list[MessageReactionSummary] = []


class ConversationOut(BaseModel):
    id: uuid.UUID
    kind: ConversationKind
    participants: list[UserOut]
    last_message: MessageOut | None
    unread_count: int
    created_at: datetime
