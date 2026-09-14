import uuid
from datetime import datetime

from pydantic import BaseModel

from reservations.models import NotificationType


class NotificationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    type: NotificationType
    title: str
    message: str
    read_at: datetime | None
    created_at: datetime
