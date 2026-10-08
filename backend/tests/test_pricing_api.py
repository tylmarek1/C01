"""ADR-009: court rates by weekday and time, and the price snapshot on a
reservation."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from support import make_venue, make_venue_manager
from test_spec_baseline import at, bearer, create, make_court, make_user

from reservations.main import app
from reservations.models import Court, User, UserRole

WEEKDAY = at(9).weekday()


def set_base_price(
    session_factory: sessionmaker, court_id: uuid.UUID, price: float | None
) -> None:
    with session_factory() as session:
        session.get(Court, court_id).price_per_hour = price
        session.commit()


def put_rules(client: TestClient, token: str, court_id: uuid.UUID, rules: list[dict]):
    return client.put(
        f"/courts/{court_id}/price-rules", json={"rules": rules}, headers=bearer(token)
    )


def quote(client: TestClient, court_id: uuid.UUID, start, end):
    return client.get(
        f"/courts/{court_id}/quote",
        params={"start_time": start.isoformat(), "end_time": end.isoformat()},
    )


def peak_from_17(price: float = 600) -> list[dict]:
    return [
        {
            "weekday": WEEKDAY,
            "starts_at": "17:00",
            "ends_at": "22:00",
            "price_per_hour": price,
        }
    ]


def test_a_slot_is_priced_per_half_hour_across_a_rate_boundary(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    court_id = make_court(session_factory)
    set_base_price(session_factory, court_id, 400)
    assert put_rules(client, manager, court_id, peak_from_17()).status_code == 200

    off_peak = quote(client, court_id, at(10), at(11)).json()["price_total"]
    straddling = quote(client, court_id, at(16, 30), at(18)).json()["price_total"]
    peak = quote(client, court_id, at(18), at(20)).json()["price_total"]

    assert off_peak == 400
    assert straddling == 200 + 600  # half an hour at 400, an hour at 600
    assert peak == 1200


def test_a_slot_with_no_published_rate_has_no_price(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    court_id = make_court(session_factory)  # no base price
    put_rules(client, manager, court_id, peak_from_17())

    assert quote(client, court_id, at(16, 30), at(17, 30)).json()["price_total"] is None
    assert quote(client, court_id, at(17), at(18)).json()["price_total"] == 600


def test_the_booked_price_is_kept_when_rates_change_and_requoted_when_moved(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, player = make_user(session_factory, "player@example.com")
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    court_id = make_court(session_factory)
    set_base_price(session_factory, court_id, 400)
    reservation = create(client, player, court_id, at(18), at(19)).json()
    assert reservation["price_total"] == 400

    put_rules(client, manager, court_id, peak_from_17(900))
    split = client.get(
        f"/reservations/{reservation['id']}/split", headers=bearer(player)
    ).json()
    assert split["total_cost"] == 400  # agreed when booked

    moved = client.patch(
        f"/reservations/{reservation['id']}/reschedule",
        json={"start_time": at(19).isoformat(), "end_time": at(20).isoformat()},
        headers=bearer(player),
    )
    assert moved.json()["price_total"] == 900  # a new slot is a new quote


def test_overlapping_rules_are_refused_by_the_database(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    court_id = make_court(session_factory)
    put_rules(client, manager, court_id, peak_from_17())

    response = put_rules(
        client,
        manager,
        court_id,
        [
            {
                "weekday": 1,
                "starts_at": "17:00",
                "ends_at": "20:00",
                "price_per_hour": 500,
            },
            {
                "weekday": 1,
                "starts_at": "19:00",
                "ends_at": "22:00",
                "price_per_hour": 550,
            },
        ],
    )

    assert response.status_code == 409
    # The failed replace rolled back: the previous rules are still there.
    assert client.get(f"/courts/{court_id}/price-rules").json() == peak_from_17()


def test_touching_rules_and_the_same_hours_on_another_day_are_fine(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    court_id = make_court(session_factory)
    rules = [
        {"weekday": 1, "starts_at": "07:00", "ends_at": "17:00", "price_per_hour": 300},
        {"weekday": 1, "starts_at": "17:00", "ends_at": "22:00", "price_per_hour": 500},
        {"weekday": 2, "starts_at": "17:00", "ends_at": "22:00", "price_per_hour": 500},
    ]

    response = put_rules(client, manager, court_id, rules)

    assert response.status_code == 200
    assert response.json() == rules


def test_only_a_manager_of_the_courts_venue_sets_its_rates(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, player = make_user(session_factory, "player@example.com")
    outsider_id, outsider = make_user(session_factory, "outsider@example.com")
    with session_factory() as session:
        make_venue_manager(
            session, session.get(User, outsider_id), make_venue(session, "Elsewhere")
        )
        session.commit()
    court_id = make_court(session_factory)

    assert put_rules(client, player, court_id, peak_from_17()).status_code == 403
    assert put_rules(client, outsider, court_id, peak_from_17()).status_code == 403
    assert client.get(f"/courts/{court_id}/price-rules").json() == []
