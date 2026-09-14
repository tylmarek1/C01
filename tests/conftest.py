from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.orm import sessionmaker

from reservations.db import create_schema, drop_schema, make_engine, make_session_factory


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
        conn.execute(text("TRUNCATE reservations, courts, users"))
