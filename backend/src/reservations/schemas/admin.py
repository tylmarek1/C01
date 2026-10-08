import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from reservations.models import AuditAction, UserRole
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
    reservations_in_window: int
    window_days: int
    total_users: int
    total_courts: int
    top_courts: list[CourtPopularity]
    busiest_hours: list[HourlyDemand]


class AuditLogOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    created_at: datetime
    actor: UserOut | None
    request_id: str | None
    action: AuditAction
    entity_type: str
    entity_id: uuid.UUID
    changes: dict[str, Any]
