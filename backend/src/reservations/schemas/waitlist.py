import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from reservations.models import WaitlistStatus
from reservations.schemas.court import CourtOut


class WaitlistJoin(BaseModel):
    court_id: uuid.UUID
    start_time: datetime
    end_time: datetime

    @field_validator("start_time")
    @classmethod
    def start_time_must_be_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start_time must include a timezone offset")
        return value


class WaitlistEntryOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    court: CourtOut
    start_time: datetime
    end_time: datetime
    status: WaitlistStatus
    offer_expires_at: datetime | None
    created_at: datetime
