import uuid
from datetime import datetime

from pydantic import BaseModel

from reservations.models import PaymentMethod, PaymentStatus, ReservationStatus
from reservations.schemas.auth import UserOut
from reservations.schemas.court import CourtOut


class PaymentCreate(BaseModel):
    # Mock gateway only (ADR-010): ask it to decline the charge, to try the
    # failure path end to end.
    decline: bool = False


class PaymentOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    reservation_id: uuid.UUID
    amount: float
    currency: str
    method: PaymentMethod
    status: PaymentStatus
    provider: str | None
    failure_reason: str | None
    created_at: datetime
    paid_at: datetime | None
    refunded_at: datetime | None


class PaymentReservationOut(BaseModel):
    """Just enough of the reservation to recognise it in a payments list."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    court: CourtOut
    user: UserOut
    start_time: datetime
    end_time: datetime
    status: ReservationStatus


class PaymentAdminOut(PaymentOut):
    reservation: PaymentReservationOut
    refund_attempts: int
