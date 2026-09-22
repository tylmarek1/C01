import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from reservations.deps import get_current_user, get_db
from reservations.models import ActivityEvent, PlayerFollow, User
from reservations.schemas.activity import ActivityEventOut
from reservations.schemas.auth import UserOut

router = APIRouter(tags=["activity"])


@router.get("/activity/feed", response_model=list[ActivityEventOut])
def get_activity_feed(
    limit: int = 30,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ActivityEventOut]:
    followee_ids = list(
        db.scalars(
            select(PlayerFollow.followee_id).where(
                PlayerFollow.follower_id == current_user.id
            )
        )
    )
    if not followee_ids:
        return []

    rows = db.execute(
        select(ActivityEvent, User)
        .join(User, User.id == ActivityEvent.user_id)
        .where(ActivityEvent.user_id.in_(followee_ids))
        .order_by(ActivityEvent.created_at.desc())
        .limit(min(limit, 100))
        .offset(max(offset, 0))
    ).all()

    return [
        ActivityEventOut(
            id=event.id,
            user=UserOut.model_validate(user),
            type=event.type,
            payload=event.payload,
            created_at=event.created_at,
        )
        for event, user in rows
    ]
