"""ADR-007: important changes leave an audit_log row, written in the same
transaction as the change, with the acting user and request id."""

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from support import default_venue_id, make_venue_manager

from reservations.lifecycle import transition
from reservations.main import app
from reservations.models import (
    AuditLog,
    Court,
    Reservation,
    ReservationStatus,
    SportType,
    User,
    UserRole,
)


def register(
    client: TestClient, email: str, role: UserRole, session_factory: sessionmaker
) -> str:
    client.post(
        "/auth/register",
        json={"name": email.split("@")[0], "email": email, "password": "supersecret"},
    )
    with session_factory() as session:
        user = session.query(User).filter_by(email=email).one()
        if role == UserRole.VENUE_MANAGER:
            make_venue_manager(session, user)
        else:
            user.role = role
        session.commit()
    return client.post(
        "/auth/login", json={"email": email, "password": "supersecret"}
    ).json()["access_token"]


def audit_rows(session_factory: sessionmaker, entity_id: str) -> list[AuditLog]:
    with session_factory() as session:
        stmt = (
            select(AuditLog)
            .where(AuditLog.entity_id == entity_id)
            .order_by(AuditLog.created_at, AuditLog.id)
        )
        return list(session.scalars(stmt))


def test_a_court_change_is_audited_with_its_actor_request_id_and_old_and_new_values(
    session_factory: sessionmaker,
) -> None:
    client = TestClient(app)
    token = register(client, "mgr@example.com", UserRole.VENUE_MANAGER, session_factory)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/courts", json={"name": "Centre", "sport_type": "TENNIS"}, headers=headers
    )
    court_id = created.json()["id"]
    updated = client.patch(
        f"/courts/{court_id}",
        json={"active": False, "price_per_hour": 400},
        headers=headers,
    )
    assert updated.status_code == 200

    create_row, update_row = audit_rows(session_factory, court_id)
    with session_factory() as session:
        manager_id = session.query(User).filter_by(email="mgr@example.com").one().id

    assert create_row.action == "CREATE"
    assert create_row.entity_type == "courts"
    assert create_row.actor_id == manager_id
    assert create_row.request_id == created.headers["X-Request-ID"]
    assert create_row.changes["name"] == [None, "Centre"]

    assert update_row.action == "UPDATE"
    assert update_row.request_id == updated.headers["X-Request-ID"]
    assert update_row.changes == {
        "active": [True, False],
        "price_per_hour": [None, 400.0],
    }


def test_an_unchanged_save_writes_no_audit_row(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register(client, "mgr@example.com", UserRole.VENUE_MANAGER, session_factory)
    headers = {"Authorization": f"Bearer {token}"}
    court_id = client.post(
        "/courts", json={"name": "Centre", "sport_type": "TENNIS"}, headers=headers
    ).json()["id"]

    client.patch(f"/courts/{court_id}", json={"name": "Centre"}, headers=headers)

    assert [row.action for row in audit_rows(session_factory, court_id)] == ["CREATE"]


def test_secrets_never_reach_the_audit_log(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    token = register(client, "quinn@example.com", UserRole.PLAYER, session_factory)
    headers = {"Authorization": f"Bearer {token}"}
    client.post(
        "/auth/me/calendar-token", headers=headers
    )  # only a secret changes: no row
    client.patch("/auth/me", json={"name": "Quinn R."}, headers=headers)

    with session_factory() as session:
        user_id = session.query(User).filter_by(email="quinn@example.com").one().id
    rows = audit_rows(session_factory, str(user_id))

    assert [row.action for row in rows] == ["CREATE", "UPDATE"]
    assert rows[1].changes == {"name": ["quinn", "Quinn R."]}
    for row in rows:
        assert "password_hash" not in row.changes
        assert "calendar_token" not in row.changes


def test_a_rolled_back_change_leaves_no_audit_row(
    session_factory: sessionmaker,
) -> None:
    with session_factory() as session:
        court = Court(
            venue_id=default_venue_id(session),
            name="Ghost",
            sport_type=SportType.TENNIS,
        )
        session.add(court)
        session.flush()
        court_id = court.id
        session.rollback()

    assert audit_rows(session_factory, str(court_id)) == []


def test_a_status_change_outside_a_request_is_audited_without_an_actor(
    session_factory: sessionmaker,
) -> None:
    """The background worker (expiry, auto-complete) has no request and no user."""
    with session_factory() as session:
        user = User(name="P", email="p@example.com", password_hash="x")
        court = Court(
            venue_id=default_venue_id(session), name="C", sport_type=SportType.TENNIS
        )
        session.add_all([user, court])
        session.flush()
        start = datetime.now(timezone.utc) + timedelta(days=1)
        reservation = Reservation(
            court_id=court.id,
            user_id=user.id,
            start_time=start,
            end_time=start + timedelta(hours=1),
        )
        session.add(reservation)
        session.commit()
        transition(session, reservation, ReservationStatus.EXPIRED, actor_id=None)
        session.commit()
        reservation_id = reservation.id

    create_row, update_row = audit_rows(session_factory, str(reservation_id))
    assert update_row.changes == {"status": ["PENDING", "EXPIRED"]}
    assert update_row.actor_id is None
    assert update_row.request_id is None


def test_only_an_admin_can_read_the_audit_log(session_factory: sessionmaker) -> None:
    client = TestClient(app)
    manager = register(
        client, "mgr@example.com", UserRole.VENUE_MANAGER, session_factory
    )
    admin = register(client, "admin@example.com", UserRole.ADMIN, session_factory)
    court_id = client.post(
        "/courts",
        json={"name": "Centre", "sport_type": "TENNIS"},
        headers={"Authorization": f"Bearer {manager}"},
    ).json()["id"]

    forbidden = client.get(
        "/admin/audit-log", headers={"Authorization": f"Bearer {manager}"}
    )
    assert forbidden.status_code == 403

    response = client.get(
        "/admin/audit-log",
        params={"entity_type": "courts", "entity_id": court_id},
        headers={"Authorization": f"Bearer {admin}"},
    )
    assert response.status_code == 200
    (entry,) = response.json()
    assert entry["action"] == "CREATE"
    assert entry["actor"]["email"] == "mgr@example.com"


def test_saving_unchanged_hours_and_rates_logs_nothing(
    session_factory: sessionmaker,
) -> None:
    """Replace endpoints update in place, so an unchanged save leaves no noise."""
    client = TestClient(app)
    token = register(client, "admin@example.com", UserRole.ADMIN, session_factory)
    headers = {"Authorization": f"Bearer {token}"}
    with session_factory() as session:
        venue_id = default_venue_id(session)
        court = Court(venue_id=venue_id, name="Centre", sport_type=SportType.TENNIS)
        session.add(court)
        session.commit()
        court_id = court.id
    week = client.get(f"/venues/{venue_id}/opening-hours").json()
    rules = [
        {"weekday": 0, "starts_at": "17:00", "ends_at": "22:00", "price_per_hour": 450}
    ]
    client.put(
        f"/courts/{court_id}/price-rules", json={"rules": rules}, headers=headers
    )
    with session_factory() as session:
        before = session.query(AuditLog).count()

    client.put(
        f"/venues/{venue_id}/opening-hours", json={"days": week}, headers=headers
    )
    client.put(
        f"/courts/{court_id}/price-rules", json={"rules": rules}, headers=headers
    )
    changed = client.put(
        f"/venues/{venue_id}/opening-hours",
        json={"days": [{**week[0], "closes_at": "20:00"}, *week[1:]]},
        headers=headers,
    )

    assert changed.status_code == 200
    with session_factory() as session:
        new_rows = session.query(AuditLog).order_by(AuditLog.created_at).all()[before:]
    assert [(r.entity_type, r.action, r.changes) for r in new_rows] == [
        ("venue_opening_hours", "UPDATE", {"closes_minute": [1320, 1200]})
    ]
