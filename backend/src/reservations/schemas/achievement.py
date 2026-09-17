from datetime import datetime

from pydantic import BaseModel, computed_field


class AchievementOut(BaseModel):
    key: str
    title: str
    description: str
    icon: str
    earned_at: datetime | None = None

    @computed_field
    @property
    def unlocked(self) -> bool:
        return self.earned_at is not None
