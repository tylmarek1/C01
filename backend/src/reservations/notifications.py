import uuid

from sqlalchemy.orm import Session

from reservations.models import Notification, NotificationType


def notify(db: Session, user_id: uuid.UUID, type_: NotificationType, title: str, message: str) -> Notification:
    notification = Notification(user_id=user_id, type=type_, title=title, message=message)
    db.add(notification)
    return notification
