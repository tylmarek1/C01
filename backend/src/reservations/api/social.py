import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from reservations import achievements
from reservations.deps import get_current_user, get_db
from reservations.models import (
    NotificationType,
    PlayerFollow,
    SkillRating,
    User,
    UserAchievement,
    UserRole,
)
from reservations.notifications import notify
from reservations.schemas.achievement import AchievementOut
from reservations.schemas.auth import UserOut
from reservations.schemas.rating import SkillRatingOut
from reservations.schemas.social import (
    FollowerOut,
    PlayerProfileOut,
    PlayerProfileStats,
    ProfileUpdate,
)

router = APIRouter(prefix="/users", tags=["social"])


def _follow_count(db: Session, column, user_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(PlayerFollow).where(column == user_id)
        )
        or 0
    )


def _profile_stats(db: Session, user_id: uuid.UUID) -> PlayerProfileStats:
    stats = achievements.player_stats(db, user_id)
    earned_at_by_key = dict(
        db.execute(
            select(UserAchievement.key, UserAchievement.earned_at).where(
                UserAchievement.user_id == user_id
            )
        ).all()
    )
    earned = [
        AchievementOut(
            key=a.key,
            title=a.title,
            description=a.description,
            icon=a.icon,
            earned_at=earned_at_by_key[a.key],
        )
        for a in achievements.ACHIEVEMENTS
        if a.key in earned_at_by_key
    ]
    ratings = [
        SkillRatingOut.model_validate(r)
        for r in db.scalars(select(SkillRating).where(SkillRating.user_id == user_id))
    ]
    return PlayerProfileStats(
        completed_reservations=stats.completed_count,
        distinct_courts_played=stats.distinct_courts_played,
        sports_played=stats.sports_played,
        current_streak_weeks=stats.current_streak_weeks,
        achievements=earned,
        ratings=ratings,
    )


@router.get("/{user_id}/profile", response_model=PlayerProfileOut)
def get_player_profile(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlayerProfileOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Player not found")

    is_self = user.id == current_user.id
    followers_count = _follow_count(db, PlayerFollow.followee_id, user.id)
    following_count = _follow_count(db, PlayerFollow.follower_id, user.id)
    is_following = (
        not is_self
        and db.scalar(
            select(PlayerFollow)
            .where(PlayerFollow.follower_id == current_user.id)
            .where(PlayerFollow.followee_id == user.id)
        )
        is not None
    )

    visible = is_self or user.profile_public or current_user.role == UserRole.ADMIN
    return PlayerProfileOut(
        user=UserOut.model_validate(user),
        bio=user.bio if visible else None,
        profile_public=user.profile_public,
        is_self=is_self,
        is_following=is_following,
        followers_count=followers_count,
        following_count=following_count,
        stats=_profile_stats(db, user.id) if visible else None,
    )


@router.put("/me/profile", response_model=PlayerProfileOut)
def update_my_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PlayerProfileOut:
    if payload.bio is not None:
        current_user.bio = payload.bio or None
    if payload.profile_public is not None:
        current_user.profile_public = payload.profile_public
    db.commit()
    return get_player_profile(current_user.id, db, current_user)


@router.post("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def follow_player(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if user_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot follow yourself")
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Player not found")

    existing = db.scalar(
        select(PlayerFollow)
        .where(PlayerFollow.follower_id == current_user.id)
        .where(PlayerFollow.followee_id == user_id)
    )
    if existing is None:
        db.add(PlayerFollow(follower_id=current_user.id, followee_id=user_id))
        notify(
            db,
            user_id,
            NotificationType.NEW_FOLLOWER,
            "New follower",
            f"{current_user.name} started following you.",
        )
        db.commit()


@router.delete("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_player(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    existing = db.scalar(
        select(PlayerFollow)
        .where(PlayerFollow.follower_id == current_user.id)
        .where(PlayerFollow.followee_id == user_id)
    )
    if existing is not None:
        db.delete(existing)
        db.commit()


@router.get("/{user_id}/followers", response_model=list[FollowerOut])
def list_followers(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[FollowerOut]:
    rows = db.execute(
        select(User, PlayerFollow.created_at)
        .join(PlayerFollow, PlayerFollow.follower_id == User.id)
        .where(PlayerFollow.followee_id == user_id)
        .order_by(PlayerFollow.created_at.desc())
    ).all()
    return [
        FollowerOut(user=UserOut.model_validate(user), followed_at=followed_at)
        for user, followed_at in rows
    ]


@router.get("/{user_id}/following", response_model=list[FollowerOut])
def list_following(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> list[FollowerOut]:
    rows = db.execute(
        select(User, PlayerFollow.created_at)
        .join(PlayerFollow, PlayerFollow.followee_id == User.id)
        .where(PlayerFollow.follower_id == user_id)
        .order_by(PlayerFollow.created_at.desc())
    ).all()
    return [
        FollowerOut(user=UserOut.model_validate(user), followed_at=followed_at)
        for user, followed_at in rows
    ]
