import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.models import Notification, NotificationType, User


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
    return notification
