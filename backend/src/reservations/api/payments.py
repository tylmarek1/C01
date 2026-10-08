"""Paying for a reservation (ADR-010). The logic and the gateway live in
payments.py; this router only checks who may do what."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from reservations import payments
from reservations.deps import get_current_manager, get_current_user, get_db
from reservations.models import Court, Payment, PaymentStatus, Reservation, User
from reservations.schemas.payment import PaymentAdminOut, PaymentCreate, PaymentOut
from reservations.venue_access import (
    managed_venue_ids,
    manages_venue,
    require_court_manager,
)

router = APIRouter(tags=["payments"])


@router.post(
    "/reservations/{reservation_id}/payments",
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
    "/reservations/{reservation_id}/payments/cash",
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


@router.get("/reservations/{reservation_id}/payments", response_model=list[PaymentOut])
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


@router.get("/payments", response_model=list[PaymentAdminOut])
def list_payments(
    status_filter: PaymentStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> list[Payment]:
    """Newest first, for the venues the caller manages (every venue for an
    admin) — where a manager finds cash to hand back and failed refunds."""
    stmt = (
        select(Payment)
        .join(Reservation, Reservation.id == Payment.reservation_id)
        .options(selectinload(Payment.reservation).selectinload(Reservation.court))
        .options(selectinload(Payment.reservation).selectinload(Reservation.user))
    )
    venues = managed_venue_ids(db, manager)
    if venues is not None:
        stmt = stmt.join(Court, Court.id == Reservation.court_id).where(
            Court.venue_id.in_(venues)
        )
    if status_filter is not None:
        stmt = stmt.where(Payment.status == status_filter)
    stmt = (
        stmt.order_by(Payment.created_at.desc(), Payment.id).offset(offset).limit(limit)
    )
    return list(db.scalars(stmt))


def _managed_payment(db: Session, manager: User, payment_id: uuid.UUID) -> Payment:
    payment = db.get(Payment, payment_id, with_for_update=True)
    if payment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    require_court_manager(db, manager, payment.reservation.court)
    return payment


@router.post("/payments/{payment_id}/cash-refund", response_model=PaymentAdminOut)
def hand_back_cash(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> Payment:
    """A released reservation's cash was handed back at the desk."""
    payment = _managed_payment(db, manager, payment_id)
    payments.refund_cash(db, payment)
    db.commit()
    return payment


@router.post("/payments/{payment_id}/retry-refund", response_model=PaymentAdminOut)
def retry_failed_refund(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    manager: User = Depends(get_current_manager),
) -> Payment:
    """Give a refund the gateway kept refusing another round of attempts."""
    payment = _managed_payment(db, manager, payment_id)
    payments.retry_refund(db, payment)
    db.commit()
    return payment
