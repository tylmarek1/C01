import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from reservations.main import app


def test_unhandled_exception_is_logged_and_returns_a_generic_500(
    session_factory: sessionmaker,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A genuine bug (not an intentional HTTPException) used to produce no
    application-level log line anywhere — see docs/capability-map.md.

    `raise_server_exceptions=False`: Starlette's ServerErrorMiddleware sends
    our handler's response to the client *and* re-raises the original
    exception up the ASGI stack (so a real deployment's server-level
    logging still sees it too) — TestClient re-raises that into the test
    process by default, precisely so a 500 can't pass silently. Here we
    want to inspect the response our handler actually built, so we opt out.
    """
    client = TestClient(app, raise_server_exceptions=False)
    client.post(
        "/auth/register",
        json={"name": "Quinn", "email": "quinn@example.com", "password": "supersecret"},
    )

    def _boom(password: str, password_hash: str) -> bool:
        raise RuntimeError("simulated bug, not an HTTPException")

    # Patch where it's used (auth.py imported the name directly), not where
    # it's defined.
    monkeypatch.setattr("reservations.api.auth.verify_password", _boom)

    with caplog.at_level(logging.ERROR, logger="reservations.api"):
        response = client.post(
            "/auth/login",
            json={"email": "quinn@example.com", "password": "supersecret"},
        )

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert any("Unhandled exception" in record.message for record in caplog.records)


def test_an_intentional_http_exception_is_untouched_by_the_handler(
    session_factory: sessionmaker,
) -> None:
    """The catch-all handler must not swallow deliberate HTTPExceptions —
    their normal status code and message still have to come through."""
    response = TestClient(app).post(
        "/auth/login", json={"email": "nobody@example.com", "password": "wrong"}
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}
