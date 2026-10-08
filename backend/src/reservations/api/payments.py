"""Paying for a reservation (ADR-010). The logic and the gateway live in
payments.py; this router only checks who may do what."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations import payments
from reservations.deps import get_current_manager, get_current_user, get_db
from reservations.models import Payment, PaymentStatus, Reservation, User
from reservations.schemas.payment import PaymentCreate, PaymentOut
from reservations.venue_access import manages_venue, require_court_manager

router = APIRouter(prefix="/reservations", tags=["payments"])


@router.post(
    "/{reservation_id}/payments",
    response_model=PaymentOut,
    status_code=status.HTTP_201_CREATED,
)
def pay_for_reservation(
    reservation_id: uuid.UUID,
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Payment:
    """Charge the reservation's quoted price (`price_total`) to its booker.
    A declined charge answers 402 and leaves a FAILED payment behind."""
    payment = payments.pay_online(
        db, reservation_id, current_user, decline=payload.decline
    )
    if payment.status == PaymentStatus.FAILED:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED, payment.failure_reason or "Payment failed"
        )
    return payment


@router.post(
    "/{reservation_id}/payments/cash",
    response_model=PaymentOut,
    status_code=status.HTTP_201_CREATED,
)
def record_cash_payment(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> Payment:
    """A manager of the court's venue took the price at the desk."""
    reservation = db.get(Reservation, reservation_id, with_for_update=True)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    require_court_manager(db, manager, reservation.court)
    payment = payments.record_cash(db, reservation, manager)
    db.commit()
    return payment


@router.get("/{reservation_id}/payments", response_model=list[PaymentOut])
def list_reservation_payments(
    reservation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Payment]:
    """Newest first — the booker's own, or for a manager of the venue."""
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.user_id != current_user.id and not manages_venue(
        db, current_user, reservation.court.venue_id
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your reservation")
    stmt = (
        select(Payment)
        .where(Payment.reservation_id == reservation.id)
        .order_by(Payment.created_at.desc(), Payment.id)
    )
    return list(db.scalars(stmt))
