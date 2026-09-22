import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from reservations.models import ConversationKind
from reservations.schemas.auth import UserOut


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class MessageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender: UserOut
    body: str
    created_at: datetime


class ConversationOut(BaseModel):
    id: uuid.UUID
    kind: ConversationKind
    participants: list[UserOut]
    last_message: MessageOut | None
    unread_count: int
    created_at: datetime
