"""Payments for reservations (ADR-010) — the only module that talks to the
payment gateway.

The rule from ADR-005 holds here too: no gateway call inside a business
transaction. Paying is three steps — record a PENDING payment and commit;
call the gateway with no transaction open; record the result in a new
transaction. Refunds are only *queued* where a reservation is released
(`release_for`, called by `lifecycle.transition`); `process_refunds` in the
background worker makes the gateway calls, and a venue manager hands cash
back at the desk (`refund_cash`).

Paying never changes a reservation's status: a reservation is confirmed by
the specified Confirm/Approve flow whether or not it has been paid
(decision recorded in ADR-010)."""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from reservations.models import (
    NotificationType,
    Payment,
    PaymentMethod,
    PaymentStatus,
    Reservation,
    ReservationStatus,
    User,
)
from reservations.notifications import notify
from reservations.payment_gateway import get_gateway
from reservations.venue_access import venue_staff

logger = logging.getLogger("reservations.payments")

# A reservation can be paid while it still holds its court.
PAYABLE_STATUSES = (
    ReservationStatus.PENDING,
    ReservationStatus.PENDING_APPROVAL,
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
)
# Cash is taken at the desk, so also after the game.
CASH_PAYABLE_STATUSES = (
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKED_IN,
    ReservationStatus.COMPLETED,
)
# Leaving one of these for good owes the player their money back. A NO_SHOW
# keeps it (the slot was held for them); COMPLETED was played.
REFUNDED_ON = (
    ReservationStatus.CANCELLED,
    ReservationStatus.REJECTED,
    ReservationStatus.EXPIRED,
)
REFUND_MAX_ATTEMPTS = 5
# A PENDING payment whose gateway result never got recorded (the process
# died mid-call) is given up after this long.
ABANDONED_AFTER = timedelta(minutes=15)
REFUND_BATCH = 50


def _amount_due(reservation: Reservation) -> Decimal:
    if reservation.price_total is None or reservation.price_total <= 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This reservation has no price to pay"
        )
    return reservation.price_total


def _add(db: Session, payment: Payment) -> Payment:
    db.add(payment)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This reservation is already paid or being paid"
        ) from exc
    return payment


def pay_online(
    db: Session, reservation_id, payer: User, *, decline: bool = False
) -> Payment:
    """Charge the booker for their reservation. Commits twice, around the
    gateway call; returns the payment as PAID, FAILED or — if the
    reservation was released while the charge ran — REFUND_PENDING."""
    reservation = db.get(Reservation, reservation_id, with_for_update=True)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reservation not found")
    if reservation.user_id != payer.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the booker pays online for a reservation"
        )
    if reservation.status not in PAYABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A {reservation.status} reservation can't be paid",
        )
    gateway = get_gateway()
    payment = _add(
        db,
        Payment(
            reservation_id=reservation.id,
            user_id=payer.id,
            amount=_amount_due(reservation),
            method=PaymentMethod.ONLINE,
            provider=gateway.name,
        ),
    )
    db.commit()  # step 1 done: the reservation's row lock is released

    result = gateway.charge(
        payment.id, payment.amount, payment.currency, decline=decline
    )

    # populate_existing: the session keeps objects across commits
    # (expire_on_commit=False), and a Cancel may have changed both rows
    # while the gateway ran — re-read them rather than trust the cache.
    payment = db.get(Payment, payment.id, with_for_update=True, populate_existing=True)
    now = datetime.now(timezone.utc)
    if not result.ok:
        if payment.status == PaymentStatus.PENDING:
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = result.error
    else:
        # Read before touching the payment, so autoflush doesn't split this
        # one change into two flushes (and two audit rows).
        reservation = db.get(
            Reservation, payment.reservation_id, populate_existing=True
        )
        payment.provider_ref = result.provider_ref
        payment.paid_at = now
        if (
            payment.status == PaymentStatus.PENDING
            and reservation.status in PAYABLE_STATUSES
        ):
            payment.status = PaymentStatus.PAID
            _notify_paid(db, payment)
        else:
            # Released while the charge ran (release_for already gave up on
            # this PENDING payment): the money was taken, so give it back.
            payment.status = PaymentStatus.REFUND_PENDING
            payment.failure_reason = None
    db.commit()
    logger.info(
        "online payment %s",
        payment.status,
        extra={
            "payment_id": str(payment.id),
            "reservation_id": str(payment.reservation_id),
        },
    )
    return payment


def record_cash(db: Session, reservation: Reservation, manager: User) -> Payment:
    """A venue manager took the price in cash. Caller holds the reservation
    lock, has checked the manager's venue, and commits."""
    if reservation.status not in CASH_PAYABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A {reservation.status} reservation can't be paid at the desk",
        )
    payment = _add(
        db,
        Payment(
            reservation_id=reservation.id,
            user_id=reservation.user_id,
            amount=_amount_due(reservation),
            method=PaymentMethod.CASH,
            status=PaymentStatus.PAID,
            recorded_by_id=manager.id,
            paid_at=datetime.now(timezone.utc),
        ),
    )
    _notify_paid(db, payment)
    return payment


def refund_cash(db: Session, payment: Payment) -> None:
    """A venue manager handed a released reservation's cash back. Caller
    holds the payment lock, has checked the manager's venue, and commits."""
    if (
        payment.method != PaymentMethod.CASH
        or payment.status != PaymentStatus.REFUND_PENDING
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only a cash payment waiting for its refund can be handed back",
        )
    _mark_refunded(db, payment)


def retry_refund(db: Session, payment: Payment) -> None:
    """Put a refund the gateway kept refusing back in the worker's queue."""
    if payment.status != PaymentStatus.REFUND_FAILED:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a failed refund can be retried"
        )
    payment.status = PaymentStatus.REFUND_PENDING
    payment.refund_attempts = 0
    payment.failure_reason = None


def latest_status_by_reservation(db: Session, reservation_ids: list) -> dict:
    """{reservation_id: status of its most recent payment}, for the
    reservation lists (`ReservationOut.payment_status`)."""
    if not reservation_ids:
        return {}
    stmt = (
        select(Payment.reservation_id, Payment.status)
        .where(Payment.reservation_id.in_(reservation_ids))
        .order_by(Payment.reservation_id, Payment.created_at.desc(), Payment.id.desc())
        .distinct(Payment.reservation_id)
    )
    return dict(db.execute(stmt).all())


def _money(payment: Payment) -> str:
    return f"{payment.amount:.2f} {payment.currency}"


def _notify_paid(db: Session, payment: Payment) -> None:
    court = payment.reservation.court.name
    notify(
        db,
        payment.user_id,
        NotificationType.PAYMENT_RECEIVED,
        "Payment received",
        f"{_money(payment)} for {court} — thank you.",
    )


def _mark_refunded(db: Session, payment: Payment) -> None:
    payment.status = PaymentStatus.REFUNDED
    payment.refunded_at = datetime.now(timezone.utc)
    payment.failure_reason = None
    notify(
        db,
        payment.user_id,
        NotificationType.PAYMENT_REFUNDED,
        "Payment refunded",
        f"{_money(payment)} for {payment.reservation.court.name} was refunded.",
    )


def release_for(db: Session, reservation: Reservation) -> None:
    """Called by `lifecycle.transition` when a reservation is released.
    Queues the refund of a paid payment — the worker refunds an online one,
    a manager hands cash back (`refund_cash`) — and gives up a charge still
    in flight (pay_online refunds it if it goes through). No network I/O."""
    if reservation.status not in REFUNDED_ON:
        return
    stmt = (
        select(Payment)
        .where(Payment.reservation_id == reservation.id)
        .with_for_update()
    )
    for payment in db.scalars(stmt):
        if payment.status == PaymentStatus.PAID:
            payment.status = PaymentStatus.REFUND_PENDING
        elif payment.status == PaymentStatus.PENDING:
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = (
                "The reservation was released before the payment completed"
            )


def process_refunds(db: Session) -> None:
    """Worker sub-task: refund queued payments, and give up abandoned ones.
    Holds only the payment rows' locks (SKIP LOCKED), never a reservation's."""
    now = datetime.now(timezone.utc)
    abandoned = (
        select(Payment)
        .where(Payment.status == PaymentStatus.PENDING)
        .where(Payment.created_at < now - ABANDONED_AFTER)
        .with_for_update(skip_locked=True)
    )
    for payment in db.scalars(abandoned):
        payment.status = PaymentStatus.FAILED
        payment.failure_reason = "The payment was never completed"

    queued = (
        select(Payment)
        .where(Payment.status == PaymentStatus.REFUND_PENDING)
        # Cash goes back at the desk, not through the gateway.
        .where(Payment.method == PaymentMethod.ONLINE)
        .order_by(Payment.created_at)
        .limit(REFUND_BATCH)
        .with_for_update(skip_locked=True)
    )
    gateway = get_gateway()
    for payment in db.scalars(queued):
        result = gateway.refund(payment.provider_ref, payment.amount, payment.currency)
        if result.ok:
            _mark_refunded(db, payment)
            continue
        payment.refund_attempts += 1
        payment.failure_reason = result.error
        if payment.refund_attempts >= REFUND_MAX_ATTEMPTS:
            payment.status = PaymentStatus.REFUND_FAILED
            logger.error("refund gave up", extra={"payment_id": str(payment.id)})
            # Somebody has to sort this out with the provider by hand.
            reservation = payment.reservation
            for person in venue_staff(db, reservation.court.venue_id):
                notify(
                    db,
                    person.id,
                    NotificationType.REFUND_FAILED,
                    "Refund failed",
                    f"{_money(payment)} for {reservation.court.name} couldn't be refunded "
                    f"to {payment.user.name}: {result.error}",
                )
