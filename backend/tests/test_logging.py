"""ADR-007: request ids and structured application logs."""

import json
import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app
from reservations.observability import JsonFormatter, KeyValueFormatter


def test_every_response_carries_a_request_id(session_factory: sessionmaker) -> None:
    client = TestClient(app)

    generated = client.get("/health").headers["X-Request-ID"]
    echoed = client.get("/health", headers={"X-Request-ID": "trace-123"}).headers[
        "X-Request-ID"
    ]
    replaced = client.get(
        "/health", headers={"X-Request-ID": "bad id\nwith newline"}
    ).headers["X-Request-ID"]

    assert len(generated) == 32
    assert echoed == "trace-123"
    assert replaced != "bad id\nwith newline" and len(replaced) == 32


def test_the_access_log_names_the_route_status_user_and_duration(
    session_factory: sessionmaker, caplog: pytest.LogCaptureFixture
) -> None:
    client = TestClient(app)
    client.post(
        "/auth/register",
        json={"name": "Quinn", "email": "quinn@example.com", "password": "supersecret"},
    )
    token = client.post(
        "/auth/login", json={"email": "quinn@example.com", "password": "supersecret"}
    ).json()["access_token"]

    with caplog.at_level(logging.INFO, logger="reservations.access"):
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}", "X-Request-ID": "req-1"},
        )

    (record,) = [r for r in caplog.records if r.name == "reservations.access"]
    assert (record.method, record.path, record.status) == ("GET", "/auth/me", 200)
    assert record.duration_ms >= 0
    assert record.request_id == "req-1"
    assert record.user_id == response.json()["id"]


def test_the_access_log_uses_the_route_template_not_the_raw_url(
    session_factory: sessionmaker, caplog: pytest.LogCaptureFixture
) -> None:
    """The calendar feed's secret token is in the query string; ids in a
    path would make every line unique."""
    client = TestClient(app)
    with caplog.at_level(logging.INFO, logger="reservations.access"):
        client.get("/reservations/calendar.ics", params={"token": "s3cret-token"})
        client.get("/courts/00000000-0000-0000-0000-000000000000")

    paths = [r.path for r in caplog.records if r.name == "reservations.access"]
    assert paths == ["/reservations/calendar.ics", "/courts/{court_id}"]
    assert "s3cret-token" not in caplog.text


def _record(**extra: object) -> logging.LogRecord:
    record = logging.LogRecord(
        "reservations.worker", logging.WARNING, __file__, 1, "tick %s", ("done",), None
    )
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_the_json_formatter_writes_one_object_with_the_extra_fields() -> None:
    line = JsonFormatter().format(_record(request_id="abc", user_id=None, expired=3))

    payload = json.loads(line)
    assert payload["level"] == "WARNING"
    assert payload["logger"] == "reservations.worker"
    assert payload["message"] == "tick done"
    assert payload["request_id"] == "abc"
    assert payload["expired"] == 3
    assert "user_id" not in payload  # None fields are left out


def test_the_text_formatter_appends_key_value_pairs() -> None:
    line = KeyValueFormatter().format(_record(request_id="abc", expired=3))

    assert line.endswith(
        "WARNING reservations.worker tick done request_id=abc expired=3"
    )
