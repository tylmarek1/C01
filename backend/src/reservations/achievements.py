"""Achievement catalog and awarding logic — entirely derived from existing
reservation/review/join-request history, no new user input required. Kept
out of the route handlers the same way rules.py/lifecycle.py are."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from reservations.models import (
    JoinRequest,
    JoinRequestStatus,
    NotificationType,
    Reservation,
    ReservationGuest,
    ReservationStatus,
    Review,
    SportType,
    UserAchievement,
)
from reservations.notifications import notify
from reservations.schemas.reservation import VENUE_TZ


@dataclass
class _Stats:
    completed_count: int = 0
    no_show_count: int = 0
    distinct_courts_played: int = 0
    sports_played: int = 0
    early_bird_count: int = 0
    night_owl_count: int = 0
    guests_invited_total: int = 0
    joined_games_count: int = 0
    reviews_written: int = 0
    current_streak_weeks: int = 0
    weeks_played: set[tuple[int, int]] = field(default_factory=set)


@dataclass
class AchievementDef:
    key: str
    title: str
    description: str
    icon: str
    check: Callable[[_Stats], bool]


def _compute_stats(db: Session, user_id: uuid.UUID) -> _Stats:
    stats = _Stats()

    completed = list(
        db.scalars(
            select(Reservation)
            .where(Reservation.user_id == user_id)
            .where(Reservation.status == ReservationStatus.COMPLETED)
        )
    )
    stats.completed_count = len(completed)
    stats.distinct_courts_played = len({r.court_id for r in completed})
    stats.sports_played = len({r.court.sport_type for r in completed})
    stats.early_bird_count = sum(1 for r in completed if r.start_time.astimezone(VENUE_TZ).hour < 8)
    stats.night_owl_count = sum(1 for r in completed if r.start_time.astimezone(VENUE_TZ).hour >= 20)
    for r in completed:
        local = r.start_time.astimezone(VENUE_TZ)
        stats.weeks_played.add(local.isocalendar()[:2])

    stats.no_show_count = db.scalar(
        select(func.count())
        .select_from(Reservation)
        .where(Reservation.user_id == user_id)
        .where(Reservation.status == ReservationStatus.NO_SHOW)
    ) or 0

    stats.guests_invited_total = db.scalar(
        select(func.count()).select_from(ReservationGuest).where(ReservationGuest.invited_by_id == user_id)
    ) or 0
    stats.joined_games_count = db.scalar(
        select(func.count())
        .select_from(JoinRequest)
        .where(JoinRequest.user_id == user_id)
        .where(JoinRequest.status == JoinRequestStatus.ACCEPTED)
    ) or 0
    stats.reviews_written = db.scalar(
        select(func.count()).select_from(Review).where(Review.user_id == user_id)
    ) or 0

    streak = 0
    cursor = datetime.now(VENUE_TZ)
    while cursor.isocalendar()[:2] in stats.weeks_played:
        streak += 1
        cursor -= timedelta(weeks=1)
    stats.current_streak_weeks = streak

    return stats


ACHIEVEMENTS: list[AchievementDef] = [
    AchievementDef("FIRST_SERVE", "First Serve", "Complete your first reservation.", "🎾", lambda s: s.completed_count >= 1),
    AchievementDef("REGULAR", "Regular", "Complete 5 reservations.", "📅", lambda s: s.completed_count >= 5),
    AchievementDef("COURT_VETERAN", "Court Veteran", "Complete 20 reservations.", "🏆", lambda s: s.completed_count >= 20),
    AchievementDef("EXPLORER", "Explorer", "Play at 3 different courts.", "🧭", lambda s: s.distinct_courts_played >= 3),
    AchievementDef(
        "ALL_ROUNDER", "All-Rounder", f"Play all {len(SportType)} sports offered.", "🌟",
        lambda s: s.sports_played >= len(SportType),
    ),
    AchievementDef("EARLY_BIRD", "Early Bird", "Play 3 sessions starting before 08:00.", "🌅", lambda s: s.early_bird_count >= 3),
    AchievementDef("NIGHT_OWL", "Night Owl", "Play 3 sessions starting at 20:00 or later.", "🌙", lambda s: s.night_owl_count >= 3),
    AchievementDef("SOCIAL_BUTTERFLY", "Social Butterfly", "Invite 5 guests to your reservations.", "🦋", lambda s: s.guests_invited_total >= 5),
    AchievementDef("TEAM_PLAYER", "Team Player", "Join 3 games opened up by other players.", "🤝", lambda s: s.joined_games_count >= 3),
    AchievementDef("ON_A_ROLL", "On a Roll", "Play at least once a week for 3 weeks running.", "🔥", lambda s: s.current_streak_weeks >= 3),
    AchievementDef(
        "PERFECT_ATTENDANCE", "Perfect Attendance", "Complete 10 reservations with zero no-shows.", "✅",
        lambda s: s.completed_count >= 10 and s.no_show_count == 0,
    ),
    AchievementDef("CRITIC", "Critic", "Write 5 court reviews.", "✍️", lambda s: s.reviews_written >= 5),
]

_BY_KEY = {a.key: a for a in ACHIEVEMENTS}


def evaluate_and_award(db: Session, user_id: uuid.UUID) -> list[AchievementDef]:
    """Recomputes stats for a user and inserts UserAchievement rows for any
    newly-earned achievements, notifying them. Doesn't commit — callers
    already do that after their own transition/notify calls."""
    already_earned = set(
        db.scalars(select(UserAchievement.key).where(UserAchievement.user_id == user_id))
    )
    newly_earned: list[AchievementDef] = []
    to_check = [a for a in ACHIEVEMENTS if a.key not in already_earned]
    if not to_check:
        return newly_earned

    stats = _compute_stats(db, user_id)
    for achievement in to_check:
        if achievement.check(stats):
            db.add(UserAchievement(user_id=user_id, key=achievement.key))
            notify(
                db,
                user_id,
                NotificationType.ACHIEVEMENT_UNLOCKED,
                f"Achievement unlocked: {achievement.title}",
                achievement.description,
            )
            newly_earned.append(achievement)
    return newly_earned


def player_stats(db: Session, user_id: uuid.UUID) -> _Stats:
    return _compute_stats(db, user_id)
