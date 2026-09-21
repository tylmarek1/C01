from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.orm import sessionmaker

from reservations.db import (
    create_schema,
    drop_schema,
    make_engine,
    make_session_factory,
)
from reservations.rate_limit import reset_all as reset_rate_limits


@pytest.fixture(autouse=True)
def _clean_rate_limits() -> None:
    """The rate limiter is in-process, module-level state — not reset by
    the DB truncation below. Without this, an earlier test's login/register
    attempts against a reused email/IP could spuriously 429 a later test."""
    reset_rate_limits()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Real PostgreSQL from `docker compose up -d db` (or DATABASE_URL)."""
    engine = make_engine()
    drop_schema(engine)
    create_schema(engine)
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
                "reservations, reservation_series, courts, users CASCADE"
            )
        )
