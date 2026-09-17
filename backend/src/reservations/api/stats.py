from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from reservations import achievements
from reservations.deps import get_current_user, get_db
from reservations.models import Reservation, ReservationStatus, User, UserAchievement
from reservations.schemas.achievement import AchievementOut
from reservations.schemas.auth import UserOut
from reservations.schemas.stats import LeaderboardEntry, PlayerStats

router = APIRouter(tags=["stats"])


@router.get("/achievements", response_model=list[AchievementOut])
def list_achievement_catalog() -> list[AchievementOut]:
    return [
        AchievementOut(key=a.key, title=a.title, description=a.description, icon=a.icon)
        for a in achievements.ACHIEVEMENTS
    ]


@router.get("/achievements/mine", response_model=list[AchievementOut])
def list_my_achievements(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[AchievementOut]:
    achievements.evaluate_and_award(db, current_user.id)
    db.commit()

    earned_at_by_key = dict(
        db.execute(
            select(UserAchievement.key, UserAchievement.earned_at).where(UserAchievement.user_id == current_user.id)
        ).all()
    )
    return [
        AchievementOut(key=a.key, title=a.title, description=a.description, icon=a.icon, earned_at=earned_at_by_key.get(a.key))
        for a in achievements.ACHIEVEMENTS
    ]


@router.get("/stats/me", response_model=PlayerStats)
def get_my_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PlayerStats:
    stats = achievements.player_stats(db, current_user.id)
    completed = list(
        db.scalars(
            select(Reservation)
            .where(Reservation.user_id == current_user.id)
            .where(Reservation.status == ReservationStatus.COMPLETED)
        )
    )
    hours_played = sum((r.end_time - r.start_time).total_seconds() for r in completed) / 3600
    unlocked_count = db.scalar(
        select(func.count()).select_from(UserAchievement).where(UserAchievement.user_id == current_user.id)
    ) or 0

    return PlayerStats(
        completed_reservations=stats.completed_count,
        hours_played=round(hours_played, 1),
        distinct_courts_played=stats.distinct_courts_played,
        sports_played=stats.sports_played,
        current_streak_weeks=stats.current_streak_weeks,
        achievements_unlocked=unlocked_count,
        achievements_total=len(achievements.ACHIEVEMENTS),
    )


@router.get("/stats/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(limit: int = 20, db: Session = Depends(get_db), _current_user: User = Depends(get_current_user)) -> list[LeaderboardEntry]:
    rows = db.execute(
        select(
            Reservation.user_id,
            func.count(),
            func.sum(func.extract("epoch", Reservation.end_time - Reservation.start_time)),
        )
        .where(Reservation.status == ReservationStatus.COMPLETED)
        .group_by(Reservation.user_id)
        .order_by(func.count().desc())
        .limit(limit)
    ).all()

    entries: list[LeaderboardEntry] = []
    for rank, (user_id, count, total_seconds) in enumerate(rows, start=1):
        user = db.get(User, user_id)
        if user is None:
            continue
        entries.append(
            LeaderboardEntry(
                user=UserOut.model_validate(user),
                completed_reservations=count,
                hours_played=round((total_seconds or 0) / 3600, 1),
                rank=rank,
            )
        )
    return entries
