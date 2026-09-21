"""Seed demo courts (with amenities), a demo player + teammate + venue
manager account, a handful of demo reservations (with history, a review, a
favorite, a guest invite, notifications) and one facility block so the
frontend has something real to look at.

Run with: uv run python -m reservations.seed
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from reservations.achievements import evaluate_and_award
from reservations.db import create_schema, make_engine, make_session_factory
from reservations.models import (
    Court,
    Favorite,
    FacilityBlock,
    Notification,
    NotificationType,
    Reservation,
    ReservationEvent,
    ReservationEventType,
    ReservationGuest,
    ReservationStatus,
    Review,
    SportType,
    User,
    UserRole,
)
from reservations.security import hash_password

VENUE_TZ = ZoneInfo("Europe/Prague")

DEMO_COURTS = [
    Court(
        name="Tennis Court 1",
        sport_type=SportType.TENNIS,
        indoor=False,
        description="Outdoor clay court with floodlights for evening play.",
        amenities=["LIGHTING", "PARKING"],
        price_per_hour=350,
    ),
    Court(
        name="Tennis Court 2",
        sport_type=SportType.TENNIS,
        indoor=True,
        requires_approval=True,
        description="Climate-controlled indoor hard court, open year-round.",
        amenities=["LOCKERS", "SHOWERS", "EQUIPMENT_RENTAL"],
        price_per_hour=480,
    ),
    Court(
        name="Volleyball Court",
        sport_type=SportType.VOLLEYBALL,
        indoor=False,
        description="Full-size outdoor sand court, popular for evening leagues.",
        amenities=["LIGHTING", "SEATING"],
        price_per_hour=300,
    ),
    Court(
        name="Volleyball Arena",
        sport_type=SportType.VOLLEYBALL,
        indoor=True,
        description="Indoor sprung-floor arena with spectator seating.",
        amenities=["SEATING", "SHOWERS", "WHEELCHAIR_ACCESSIBLE", "CAFE"],
        price_per_hour=550,
    ),
    Court(
        name="Badminton Court 1",
        sport_type=SportType.BADMINTON,
        indoor=True,
        description="Tournament-grade indoor court with a matte, glare-free floor.",
        amenities=["EQUIPMENT_RENTAL", "LOCKERS"],
        price_per_hour=250,
    ),
    Court(
        name="Badminton Court 2",
        sport_type=SportType.BADMINTON,
        indoor=True,
        description="Second indoor badminton court, right next to Court 1.",
        amenities=["EQUIPMENT_RENTAL"],
        price_per_hour=250,
    ),
]

DEMO_MANAGER = {
    "name": "Venue Manager",
    "email": "admin@courtly.app",
    "password": "adminadmin",
    "role": UserRole.VENUE_MANAGER,
}
DEMO_PLAYER = {
    "name": "Demo Player",
    "email": "player@courtly.app",
    "password": "playerplayer",
    "role": UserRole.PLAYER,
}
DEMO_TEAMMATE = {
    "name": "Demo Teammate",
    "email": "teammate@courtly.app",
    "password": "teammate1",
    "role": UserRole.PLAYER,
}
DEMO_ACCOUNTS = (DEMO_MANAGER, DEMO_PLAYER, DEMO_TEAMMATE)


def _slot(days_ahead: int, hour: int, duration_minutes: int = 60) -> tuple[datetime, datetime]:
    start = datetime.now(VENUE_TZ).replace(hour=hour, minute=0, second=0, microsecond=0) + timedelta(days=days_ahead)
    return start, start + timedelta(minutes=duration_minutes)


def main() -> None:
    engine = make_engine()
    create_schema(engine)
    session_factory = make_session_factory(engine)

    with session_factory() as session:
        courts_by_name: dict[str, Court] = {}
        created_courts = 0
        for court in DEMO_COURTS:
            existing = session.query(Court).filter_by(name=court.name).first()
            if existing is None:
                session.add(court)
                session.flush()
                courts_by_name[court.name] = court
                created_courts += 1
            else:
                courts_by_name[court.name] = existing
        session.commit()

        created_users = 0
        users_by_email: dict[str, User] = {}
        for account in DEMO_ACCOUNTS:
            existing_user = session.query(User).filter_by(email=account["email"]).first()
            if existing_user is None:
                user = User(
                    name=account["name"],
                    email=account["email"],
                    password_hash=hash_password(account["password"]),
                    role=account["role"],
                )
                session.add(user)
                session.flush()
                users_by_email[account["email"]] = user
                created_users += 1
            else:
                users_by_email[account["email"]] = existing_user
        session.commit()

        player = users_by_email[DEMO_PLAYER["email"]]
        teammate = users_by_email[DEMO_TEAMMATE["email"]]
        manager = users_by_email[DEMO_MANAGER["email"]]

        created_reservations = 0
        confirmed_reservation = None
        if session.query(Reservation).filter_by(user_id=player.id).count() == 0:
            demo_reservations = [
                (courts_by_name["Tennis Court 1"], *_slot(1, 18), ReservationStatus.CONFIRMED),
                (courts_by_name["Volleyball Arena"], *_slot(2, 19, 90), ReservationStatus.CONFIRMED),
                (courts_by_name["Badminton Court 1"], *_slot(3, 8), ReservationStatus.PENDING),
            ]
            for court, start, end, reservation_status in demo_reservations:
                reservation = Reservation(
                    court_id=court.id,
                    user_id=player.id,
                    start_time=start,
                    end_time=end,
                    status=reservation_status,
                    hold_expires_at=(datetime.now(VENUE_TZ) + timedelta(minutes=5))
                    if reservation_status == ReservationStatus.PENDING
                    else None,
                )
                session.add(reservation)
                session.flush()
                session.add(
                    ReservationEvent(
                        reservation_id=reservation.id, event_type=ReservationEventType.CREATED, actor_id=player.id
                    )
                )
                if reservation_status == ReservationStatus.CONFIRMED:
                    session.add(
                        ReservationEvent(
                            reservation_id=reservation.id,
                            event_type=ReservationEventType.CONFIRMED,
                            actor_id=player.id,
                        )
                    )
                    if confirmed_reservation is None:
                        confirmed_reservation = reservation
                created_reservations += 1

            if confirmed_reservation is not None:
                confirmed_reservation.open_to_join = True
                confirmed_reservation.open_note = "Need one more for doubles — all levels welcome!"

            # A handful of finished visits in the past — something to review,
            # and enough history for player stats/achievements/leaderboard to
            # show real numbers instead of empty states.
            past_visits = [
                (courts_by_name["Tennis Court 2"], 5, 9),
                (courts_by_name["Volleyball Court"], 10, 18),
                (courts_by_name["Badminton Court 2"], 15, 20),
            ]
            past_reservation = None
            for court, days_ago, hour in past_visits:
                past_start = datetime.now(VENUE_TZ).replace(hour=hour, minute=0, second=0, microsecond=0) - timedelta(
                    days=days_ago
                )
                visit = Reservation(
                    court_id=court.id,
                    user_id=player.id,
                    start_time=past_start,
                    end_time=past_start + timedelta(hours=1),
                    status=ReservationStatus.COMPLETED,
                )
                session.add(visit)
                session.flush()
                session.add(
                    ReservationEvent(reservation_id=visit.id, event_type=ReservationEventType.CREATED, actor_id=player.id)
                )
                session.add(ReservationEvent(reservation_id=visit.id, event_type=ReservationEventType.COMPLETED))
                created_reservations += 1
                if past_reservation is None:
                    past_reservation = visit

            # A couple of completed visits for the teammate too, so the
            # leaderboard has more than one row to rank.
            for court, days_ago, hour in [(courts_by_name["Tennis Court 1"], 3, 17), (courts_by_name["Volleyball Arena"], 8, 19)]:
                mate_start = datetime.now(VENUE_TZ).replace(hour=hour, minute=0, second=0, microsecond=0) - timedelta(
                    days=days_ago
                )
                mate_visit = Reservation(
                    court_id=court.id,
                    user_id=teammate.id,
                    start_time=mate_start,
                    end_time=mate_start + timedelta(hours=1),
                    status=ReservationStatus.COMPLETED,
                )
                session.add(mate_visit)
                session.flush()
                session.add(
                    ReservationEvent(reservation_id=mate_visit.id, event_type=ReservationEventType.CREATED, actor_id=teammate.id)
                )
                session.add(ReservationEvent(reservation_id=mate_visit.id, event_type=ReservationEventType.COMPLETED))
                created_reservations += 1

            session.commit()

            session.add(
                Review(
                    court_id=courts_by_name["Tennis Court 2"].id,
                    user_id=player.id,
                    reservation_id=past_reservation.id,
                    rating=5,
                    comment="Great indoor court — booked again already.",
                )
            )
            session.commit()

        if confirmed_reservation is not None and session.query(ReservationGuest).count() == 0:
            session.add(
                ReservationGuest(
                    reservation_id=confirmed_reservation.id, user_id=teammate.id, invited_by_id=player.id
                )
            )
            session.commit()

        if session.query(Favorite).filter_by(user_id=player.id).count() == 0:
            session.add(Favorite(user_id=player.id, court_id=courts_by_name["Volleyball Arena"].id))
            session.commit()

        created_notifications = 0
        if session.query(Notification).filter_by(user_id=player.id).count() == 0:
            session.add(
                Notification(
                    user_id=player.id,
                    type=NotificationType.RESERVATION_CONFIRMED,
                    title="Reservation confirmed",
                    message="Tennis Court 1 is booked for you.",
                )
            )
            session.add(
                Notification(
                    user_id=player.id,
                    type=NotificationType.RESERVATION_CREATED,
                    title="Slot held",
                    message="Badminton Court 1 is held for you — confirm it from your dashboard.",
                )
            )
            created_notifications = 2
            session.commit()

        created_blocks = 0
        if session.query(FacilityBlock).count() == 0:
            block_start, block_end = _slot(4, 14, 240)
            session.add(
                FacilityBlock(
                    court_id=courts_by_name["Badminton Court 2"].id,
                    start_time=block_start,
                    end_time=block_end,
                    reason="Court resurfacing",
                    created_by_id=manager.id,
                )
            )
            created_blocks = 1
            session.commit()

        evaluate_and_award(session, player.id)
        evaluate_and_award(session, teammate.id)
        session.commit()

    print(
        f"Seeded {created_courts} new court(s), {created_users} new demo account(s), "
        f"{created_reservations} new demo reservation(s), {created_notifications} notification(s), "
        f"{created_blocks} facility block(s)."
    )
    print(f"Demo venue manager login: {DEMO_MANAGER['email']} / {DEMO_MANAGER['password']}")
    print(f"Demo player login:        {DEMO_PLAYER['email']} / {DEMO_PLAYER['password']}")
    print(f"Demo teammate login:      {DEMO_TEAMMATE['email']} / {DEMO_TEAMMATE['password']}")


if __name__ == "__main__":
    main()
