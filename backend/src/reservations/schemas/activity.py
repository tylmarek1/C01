import uuid
from datetime import datetime

from pydantic import BaseModel

from reservations.schemas.auth import UserOut


class ActivityEventOut(BaseModel):
    id: uuid.UUID
    user: UserOut
    type: str
    payload: dict
    created_at: datetime
