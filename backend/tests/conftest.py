import os
from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from reservations.config import settings
from reservations.db import (
    drop_schema,
    make_engine,
    make_session_factory,
    upgrade_schema,
)
from reservations.rate_limit import reset_all as reset_rate_limits


def _test_database_url(dev_url: str) -> str:
    """TEST_DATABASE_URL if set, else the dev database's name + "_test".
    The suite drops and recreates the schema, so it must never run against
    the database the dev server and the demo seed use."""
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit
    url = make_url(dev_url)
    if not url.database.endswith("_test"):
        url = url.set(database=f"{url.database}_test")
    return url.render_as_string(hide_password=False)


# Repoint the shared settings before anything builds an engine from them:
# conftest is imported before any test module, so `deps.py` (imported via the
# app) creates the request-path engine against the test database too.
settings.database_url = _test_database_url(settings.database_url)


@pytest.fixture(autouse=True)
def _clean_rate_limits() -> None:
    """The rate limiter is in-process, module-level state — not reset by
    the DB truncation below. Without this, an earlier test's login/register
    attempts against a reused email/IP could spuriously 429 a later test."""
    reset_rate_limits()


def _ensure_database_exists(url_string: str) -> None:
    url = make_url(url_string)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": url.database},
            )
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    finally:
        admin.dispose()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Real PostgreSQL from `docker compose up -d db`, in its own test
    database (see `_test_database_url`), created on first run."""
    test_db = make_url(settings.database_url).database
    assert test_db.endswith("_test") or os.environ.get("TEST_DATABASE_URL"), (
        f"refusing to drop the schema of {test_db!r} — not a test database"
    )
    _ensure_database_exists(settings.database_url)
    engine = make_engine()
    drop_schema(engine)
    upgrade_schema(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> Iterator[sessionmaker]:
    yield make_session_factory(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE reservation_events, notifications, waitlist_entries, facility_blocks, "
                "reviews, review_votes, favorites, reservation_guests, join_requests, user_achievements, "
                "reservations, reservation_series, courts, venues, users CASCADE"
            )
        )
