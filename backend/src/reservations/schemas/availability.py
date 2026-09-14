from datetime import datetime

from pydantic import BaseModel

from reservations.models import ReservationStatus


class BusySlot(BaseModel):
    start_time: datetime
    end_time: datetime
    status: ReservationStatus


class CourtAvailability(BaseModel):
    court_id: str
    date: str
    opens_at: str
    closes_at: str
    busy: list[BusySlot]
