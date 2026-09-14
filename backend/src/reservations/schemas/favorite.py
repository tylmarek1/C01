from pydantic import BaseModel

from reservations.schemas.court import CourtOut


class FavoriteOut(BaseModel):
    court: CourtOut
