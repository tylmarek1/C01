import enum
import uuid

from sqlalchemy import Enum, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from reservations.db import Base


class SportType(enum.StrEnum):
    TENNIS = "TENNIS"
    VOLLEYBALL = "VOLLEYBALL"
    BADMINTON = "BADMINTON"


class Amenity(enum.StrEnum):
    LIGHTING = "LIGHTING"
    PARKING = "PARKING"
    SHOWERS = "SHOWERS"
    LOCKERS = "LOCKERS"
    EQUIPMENT_RENTAL = "EQUIPMENT_RENTAL"
    SEATING = "SEATING"
    WHEELCHAIR_ACCESSIBLE = "WHEELCHAIR_ACCESSIBLE"
    CAFE = "CAFE"


class Court(Base):
    __tablename__ = "courts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    sport_type: Mapped[SportType] = mapped_column(Enum(SportType, name="sport_type"))
    indoor: Mapped[bool] = mapped_column(default=False)
    active: Mapped[bool] = mapped_column(default=True)
    description: Mapped[str | None] = mapped_column(String(500), default=None)
    # Optional override photo; when unset the frontend renders a branded
    # illustration for the court's sport_type instead.
    image_url: Mapped[str | None] = mapped_column(String(500), default=None)
    amenities: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list)
