"""Web Push integration (ADR-005) — the only module that knows the push
vendor API (`pywebpush`, VAPID). It drains the `push_deliveries` outbox
that `notifications.notify()` fills inside business transactions, so a
slow or failing push service can neither hold a reservation's row lock nor
announce a change that later rolled back.

Delivery is at-least-once: a delivery that reached one of a user's
subscriptions but failed transiently on another is retried as a whole."""

import json
import logging
from datetime import datetime, timedelta, timezone

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from reservations.config import settings
from reservations.models import PushDelivery, PushDeliveryStatus, PushSubscription

logger = logging.getLogger("reservations.push")

DISPATCH_SECONDS = 5
BATCH_SIZE = 50
MAX_ATTEMPTS = 5
REQUEST_TIMEOUT_SECONDS = 5
# Backoff after the n-th failed attempt: 30 s, 1 min, 2 min, 4 min — the
# last retry happens ~7.5 min after the first try, then FAILED.
RETRY_BASE = timedelta(seconds=30)


def _send_to_subscriptions(db: Session, delivery: PushDelivery) -> str | None:
    """Push to every subscription the user has right now. Returns the last
    transient error, or None if nothing needs retrying."""
    subscriptions = list(
        db.scalars(select(PushSubscription).where(PushSubscription.user_id == delivery.user_id))
    )
    payload = json.dumps({"title": delivery.title, "body": delivery.message})
    error = None
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": f"mailto:{settings.vapid_contact_email}"},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except WebPushException as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code in (404, 410):
                # The browser/push service revoked this subscription — permanent, no retry.
                db.delete(subscription)
            else:
                error = f"WebPushException {status_code}: {exc}"
        except Exception as exc:
            # A network hiccup or bad config: transient from our point of view.
            error = f"{type(exc).__name__}: {exc}"
    return error


def dispatch_due(db: Session, now: datetime | None = None) -> int:
    """Attempt every PENDING delivery whose next attempt is due. Rows are
    locked with SKIP LOCKED, so two dispatchers never send the same row at
    once. Returns how many deliveries were attempted."""
    now = now or datetime.now(timezone.utc)
    deliveries = list(
        db.scalars(
            select(PushDelivery)
            .where(PushDelivery.status == PushDeliveryStatus.PENDING)
            .where(PushDelivery.next_attempt_at <= now)
            .order_by(PushDelivery.created_at)
            .limit(BATCH_SIZE)
            .with_for_update(skip_locked=True)
        )
    )
    for delivery in deliveries:
        error = _send_to_subscriptions(db, delivery)
        delivery.attempts += 1
        if error is None:
            delivery.status = PushDeliveryStatus.SENT
            delivery.sent_at = now
            delivery.last_error = None
            continue
        delivery.last_error = error[:500]
        if delivery.attempts >= MAX_ATTEMPTS:
            delivery.status = PushDeliveryStatus.FAILED
            logger.warning("Giving up on push delivery %s: %s", delivery.id, error)
        else:
            delivery.next_attempt_at = now + RETRY_BASE * 2 ** (delivery.attempts - 1)
    return len(deliveries)


def dispatch_once(session_factory: sessionmaker) -> None:
    with session_factory() as db:
        dispatch_due(db)
        db.commit()
