import json
import logging
import uuid

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.config import settings
from reservations.models import Notification, NotificationType, PushSubscription, User

logger = logging.getLogger("reservations.push")


def _send_web_push(db: Session, user_id: uuid.UUID, title: str, message: str) -> None:
    """Best-effort: a subscriber's browser gets a push even if the app tab
    is closed. Runs inside the caller's own transaction (before its
    commit), so a subscription a push service reports as gone (410/404) is
    deleted atomically with everything else in that request — but it also
    means a push can fire for a notification whose surrounding transaction
    later rolls back for an unrelated reason. No call site in this codebase
    does further failable work after notify(), so that's a theoretical gap,
    not an observed one; a genuine outbox would close it but isn't
    warranted at this scale (same tradeoff class as rate_limit.py's
    single-process store)."""
    subscriptions = list(
        db.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id))
    )
    if not subscriptions:
        return
    payload = json.dumps({"title": title, "body": message})
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
                timeout=5,
            )
        except WebPushException as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code in (404, 410):
                # The browser/push service revoked this subscription.
                db.delete(subscription)
            else:
                logger.warning("Web push delivery failed: %s", exc)
        except Exception:
            # Push is a nice-to-have side channel — a network hiccup or bad
            # config here must never break the caller's own flow.
            logger.exception("Unexpected error sending web push")


def notify(
    db: Session, user_id: uuid.UUID, type_: NotificationType, title: str, message: str
) -> Notification | None:
    muted = (
        db.scalar(select(User.muted_notification_types).where(User.id == user_id)) or []
    )
    if type_.value in muted:
        return None
    notification = Notification(
        user_id=user_id, type=type_, title=title, message=message
    )
    db.add(notification)
    _send_web_push(db, user_id, title, message)
    return notification
