from datetime import datetime

from pydantic import BaseModel

from reservations.models import UserRole
from reservations.schemas.auth import UserOut
from reservations.schemas.court import CourtOut


class UserAdminOut(UserOut):
    created_at: datetime
    active_reservation_count: int
    no_show_count: int


class UserRoleUpdate(BaseModel):
    role: UserRole


class CourtPopularity(BaseModel):
    court: CourtOut
    reservation_count: int


class HourlyDemand(BaseModel):
    hour: int
    count: int


class AdminStats(BaseModel):
    total_reservations: int
    status_breakdown: dict[str, int]
    no_show_rate: float
    reservations_last_30_days: int
    total_users: int
    total_courts: int
    top_courts: list[CourtPopularity]
    busiest_hours: list[HourlyDemand]
