from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.config import settings
from reservations.deps import get_current_user, get_db
from reservations.models import PushSubscription, User
from reservations.schemas.push import PushSubscriptionCreate, VapidPublicKeyOut

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/public-key", response_model=VapidPublicKeyOut)
def get_public_key() -> VapidPublicKeyOut:
    return VapidPublicKeyOut(public_key=settings.vapid_public_key)


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def subscribe(
    payload: PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    # A browser re-subscribing (e.g. after clearing site data) reuses the
    # same endpoint — upsert on it rather than growing duplicate rows.
    existing = db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    if existing is not None:
        existing.user_id = current_user.id
        existing.p256dh = payload.p256dh
        existing.auth = payload.auth
    else:
        db.add(
            PushSubscription(
                user_id=current_user.id,
                endpoint=payload.endpoint,
                p256dh=payload.p256dh,
                auth=payload.auth,
            )
        )
    db.commit()


@router.delete("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    endpoint: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    # Idempotent by design: the frontend calls this on "turn notifications
    # off" without first checking whether a push delivery already deleted
    # the same row as stale (see notifications.py's _send_web_push).
    subscription = db.scalar(
        select(PushSubscription)
        .where(PushSubscription.endpoint == endpoint)
        .where(PushSubscription.user_id == current_user.id)
    )
    if subscription is not None:
        db.delete(subscription)
        db.commit()
