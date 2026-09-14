import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from reservations.schemas.court import CourtOut


class FacilityBlockCreate(BaseModel):
    court_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    reason: str = Field(min_length=1, max_length=300)

    @field_validator("start_time")
    @classmethod
    def start_time_must_be_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("start_time must include a timezone offset")
        return value

    @field_validator("end_time")
    @classmethod
    def end_time_after_start(cls, end_time: datetime, info) -> datetime:
        start_time = info.data.get("start_time")
        if start_time is not None and end_time <= start_time:
            raise ValueError("end_time must be after start_time")
        return end_time


class FacilityBlockOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    court: CourtOut
    start_time: datetime
    end_time: datetime
    reason: str
    created_at: datetime
