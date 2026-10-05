import uuid

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from reservations.models import (
    Notification,
    NotificationType,
    PushDelivery,
    PushSubscription,
    User,
)


def notify(
    db: Session, user_id: uuid.UUID, type_: NotificationType, title: str, message: str
) -> Notification | None:
    """Record an in-app notification and, if the user has a push
    subscription, queue a Web Push for it — both in the caller's
    transaction, with no network I/O (ADR-005). The push is sent by
    `push_delivery.py` after the caller commits; a rollback drops both."""
    muted = (
        db.scalar(select(User.muted_notification_types).where(User.id == user_id)) or []
    )
    if type_.value in muted:
        return None
    notification = Notification(
        user_id=user_id, type=type_, title=title, message=message
    )
    db.add(notification)
    if db.scalar(select(exists().where(PushSubscription.user_id == user_id))):
        db.add(PushDelivery(user_id=user_id, title=title, message=message))
    return notification
