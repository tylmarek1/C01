"""ADR-009: opening hours per venue and weekday, from the database.

The VE-* examples here are the v0.3 additions to BR-04 in
docs/specification.md; the 07:00–22:00 examples of v0.1 (VE-01.x in
test_spec_baseline.py) still hold because every venue starts with those hours."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from support import default_venue_id
from test_spec_baseline import at, bearer, check, create, make_court, make_user

from reservations.main import app
from reservations.models import UserRole

WEEKDAY = at(9).weekday()  # the day the at() helper books on


def week_with(day_hours: dict[int, tuple[str, str]]) -> dict:
    return {
        "days": [
            {"weekday": d, "opens_at": o, "closes_at": c}
            for d, (o, c) in day_hours.items()
        ]
    }


def set_hours(session_factory: sessionmaker, client: TestClient, payload: dict) -> None:
    _, admin = make_user(
        session_factory, f"admin-{uuid.uuid4().hex[:6]}@example.com", UserRole.ADMIN
    )
    with session_factory() as session:
        venue_id = default_venue_id(session)
        session.commit()
    response = client.put(
        f"/venues/{venue_id}/opening-hours", json=payload, headers=bearer(admin)
    )
    assert response.status_code == 200, response.text


def test_ve_01_11_a_slot_outside_the_venues_own_hours_is_invalid_input(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    court_id = make_court(session_factory)
    set_hours(
        session_factory, client, week_with({d: ("09:00", "17:00") for d in range(7)})
    )

    early = create(client, token, court_id, at(8), at(9))
    late = create(client, token, court_id, at(16, 30), at(17, 30))
    inside = create(client, token, court_id, at(9), at(10))

    assert early.status_code == late.status_code == 422
    assert (
        early.json()["detail"]
        == "reservation must lie within opening hours 09:00-17:00"
    )
    assert inside.status_code == 201


def test_ve_01_12_a_closed_weekday_takes_no_bookings(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    court_id = make_court(session_factory)
    set_hours(
        session_factory,
        client,
        week_with({d: ("07:00", "22:00") for d in range(7) if d != WEEKDAY}),
    )

    response = create(client, token, court_id, at(10), at(11))

    assert response.status_code == 422
    assert response.json()["detail"] == "The venue is closed on that day"


def test_ve_02_8_check_availability_rejects_a_slot_outside_opening_hours(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = make_court(session_factory)
    set_hours(
        session_factory, client, week_with({d: ("09:00", "17:00") for d in range(7)})
    )

    assert check(client, court_id, at(8), at(9)).status_code == 422
    assert check(client, court_id, at(9), at(10)).json()["available"] is True


def test_the_day_view_reports_the_days_hours_or_that_it_is_closed(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    court_id = make_court(session_factory)
    other_day = (WEEKDAY + 1) % 7
    set_hours(session_factory, client, week_with({WEEKDAY: ("09:00", "24:00")}))
    day = at(9).date()
    closed_day = at(9, days=4).date()
    assert closed_day.weekday() == other_day

    open_view = client.get(
        f"/courts/{court_id}/availability", params={"date": day.isoformat()}
    ).json()
    closed_view = client.get(
        f"/courts/{court_id}/availability", params={"date": closed_day.isoformat()}
    ).json()

    assert open_view["closed"] is False
    assert open_view["opens_at"] == at(9).isoformat()
    assert open_view["closes_at"] == at(0, days=4).isoformat()  # 24:00 = next midnight
    assert closed_view["closed"] is True
    assert closed_view["opens_at"] == closed_view["closes_at"]


def test_existing_bookings_outside_new_hours_are_kept(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, token = make_user(session_factory, "player@example.com")
    court_id = make_court(session_factory)
    booked = create(client, token, court_id, at(20), at(21))
    assert booked.status_code == 201

    set_hours(
        session_factory, client, week_with({d: ("09:00", "17:00") for d in range(7)})
    )

    mine = client.get("/reservations", headers=bearer(token)).json()
    assert [r["status"] for r in mine] == ["PENDING"]


def test_hours_are_public_but_only_the_venues_managers_change_them(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, player = make_user(session_factory, "player@example.com")
    _, manager = make_user(
        session_factory, "manager@example.com", UserRole.VENUE_MANAGER
    )
    with session_factory() as session:
        venue_id = default_venue_id(session)
        session.commit()

    week = client.get(f"/venues/{venue_id}/opening-hours").json()
    assert len(week) == 7 and week[0] == {
        "weekday": 0,
        "opens_at": "07:00",
        "closes_at": "22:00",
    }

    payload = week_with({0: ("08:00", "20:00")})
    assert (
        client.put(
            f"/venues/{venue_id}/opening-hours", json=payload, headers=bearer(player)
        ).status_code
        == 403
    )
    response = client.put(
        f"/venues/{venue_id}/opening-hours", json=payload, headers=bearer(manager)
    )
    assert response.json() == [
        {"weekday": 0, "opens_at": "08:00", "closes_at": "20:00"}
    ]


def test_malformed_hours_are_rejected(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    _, admin = make_user(session_factory, "admin@example.com", UserRole.ADMIN)
    with session_factory() as session:
        venue_id = default_venue_id(session)
        session.commit()

    for payload in (
        week_with({0: ("10:00", "09:00")}),  # closes before it opens
        week_with({0: ("09:15", "17:00")}),  # not on the half hour
        {
            "days": [{"weekday": 0, "opens_at": "09:00", "closes_at": "17:00"}] * 2
        },  # same weekday twice
        week_with({7: ("09:00", "17:00")}),  # no such weekday
    ):
        response = client.put(
            f"/venues/{venue_id}/opening-hours", json=payload, headers=bearer(admin)
        )
        assert response.status_code == 422, payload


def test_a_new_venue_opens_seven_to_ten_every_day(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    _, admin = make_user(session_factory, "admin@example.com", UserRole.ADMIN)

    venue = client.post("/venues", json={"name": "Fresh"}, headers=bearer(admin)).json()
    week = client.get(f"/venues/{venue['id']}/opening-hours").json()

    assert week == [
        {"weekday": d, "opens_at": "07:00", "closes_at": "22:00"} for d in range(7)
    ]
