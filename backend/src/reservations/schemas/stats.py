import uuid

from pydantic import BaseModel, computed_field

from reservations.schemas.auth import UserOut


class PlayerStats(BaseModel):
    completed_reservations: int
    hours_played: float
    distinct_courts_played: int
    sports_played: int
    current_streak_weeks: int
    achievements_unlocked: int
    achievements_total: int


class LeaderboardEntry(BaseModel):
    user: UserOut
    completed_reservations: int
    hours_played: float
    rank: int


class TeammateOut(BaseModel):
    user: UserOut
    games_together: int


class CourtUtilizationCell(BaseModel):
    day_of_week: int  # 0 = Monday, matching Python's date.weekday()
    hour: int
    booked_count: int
    possible_count: int

    @computed_field
    @property
    def occupancy(self) -> float:
        return round(self.booked_count / self.possible_count, 3) if self.possible_count else 0.0


class CourtUtilization(BaseModel):
    court_id: uuid.UUID
    days_analyzed: int
    cells: list[CourtUtilizationCell]
