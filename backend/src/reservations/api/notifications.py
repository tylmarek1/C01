import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from reservations.deps import get_current_user, get_db
from reservations.models import Notification, User
from reservations.schemas.notification import (
    NotificationOut,
    NotificationPreferencesOut,
    NotificationPreferencesUpdate,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/preferences", response_model=NotificationPreferencesOut)
def get_notification_preferences(
    current_user: User = Depends(get_current_user),
) -> NotificationPreferencesOut:
    return NotificationPreferencesOut(muted_types=current_user.muted_notification_types)


@router.put("/preferences", response_model=NotificationPreferencesOut)
def update_notification_preferences(
    payload: NotificationPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationPreferencesOut:
    # Dedupe (a repeated type in the payload is harmless but pointless to store).
    current_user.muted_notification_types = sorted(
        {t.value for t in payload.muted_types}
    )
    db.commit()
    return NotificationPreferencesOut(muted_types=current_user.muted_notification_types)


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    return list(db.scalars(stmt))


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict[str, int]:
    stmt = (
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == current_user.id)
        .where(Notification.read_at.is_(None))
    )
    return {"count": db.scalar(stmt) or 0}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Notification:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return notification


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict[str, int]:
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .where(Notification.read_at.is_(None))
    )
    now = datetime.now(timezone.utc)
    updated = 0
    for notification in db.scalars(stmt):
        notification.read_at = now
        updated += 1
    db.commit()
    return {"updated": updated}
