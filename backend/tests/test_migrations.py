"""ADR-006: the Alembic migrations are the schema's source of truth.

These run against a scratch database of their own, not the shared test
database, because they drop it to nothing and rebuild it."""

import os
from collections.abc import Iterator

import pytest
import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.engine import make_url

from reservations import models  # noqa: F401  (registers tables on Base.metadata)
from reservations.config import settings
from reservations.db import (
    Base,
    alembic_config,
    downgrade_schema,
    drop_schema,
    make_engine,
    upgrade_schema,
)


def _scratch_url() -> str:
    url = make_url(settings.database_url)
    name = url.database.removesuffix("_test") + "_migrations_test"
    return url.set(database=name).render_as_string(hide_password=False)


@pytest.fixture
def scratch_engine() -> Iterator[Engine]:
    url = make_url(_scratch_url())
    assert url.database.endswith("_test") or os.environ.get("TEST_DATABASE_URL")
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    engine = make_engine(url.render_as_string(hide_password=False))
    yield engine
    engine.dispose()
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
    admin.dispose()


def _current_revision(engine: Engine) -> str | None:
    with engine.connect() as conn:
        return MigrationContext.configure(conn).get_current_revision()


def _head_revision() -> str:
    return ScriptDirectory.from_config(alembic_config()).get_current_head()


def test_the_migrated_schema_matches_the_models(engine: Engine) -> None:
    """A model changed without a migration (or the other way round) shows up
    here as a non-empty autogenerate diff."""
    with engine.connect() as conn:
        context = MigrationContext.configure(
            conn, opts={"compare_type": True, "compare_server_default": True}
        )
        diff = compare_metadata(context, Base.metadata)
    assert diff == []


def test_every_postgres_enum_has_exactly_the_model_values(engine: Engine) -> None:
    """Autogenerate (and the diff above) doesn't compare enum *values*, so a
    new member like a `ReservationStatus` needs a hand-written
    `ALTER TYPE ... ADD VALUE` — this catches the one that was forgotten."""
    model_enums = {
        column.type.name: list(column.type.enums)
        for table in Base.metadata.tables.values()
        for column in table.columns
        if isinstance(column.type, sa.Enum)
    }
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) "
                "FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY t.typname"
            )
        )
        database_enums = {name: list(labels) for name, labels in rows}
    assert database_enums == model_enums


def test_every_migration_downgrades_and_upgrades_again(scratch_engine: Engine) -> None:
    upgrade_schema(scratch_engine)
    downgrade_schema(scratch_engine, "base")
    with scratch_engine.connect() as conn:
        assert set(inspect(conn).get_table_names()) == {"alembic_version"}
        leftover_types = conn.scalar(
            text("SELECT count(*) FROM pg_type WHERE typtype = 'e'")
        )
    assert leftover_types == 0
    upgrade_schema(scratch_engine)
    assert _current_revision(scratch_engine) == _head_revision()


def test_a_create_all_database_is_stamped_at_the_baseline_not_rebuilt(
    scratch_engine: Engine,
) -> None:
    """The pre-Alembic dev database: tables from `create_all`, no
    `alembic_version`. Adopting it must keep its rows untouched."""
    with scratch_engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
    Base.metadata.create_all(scratch_engine)
    with scratch_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO users (id, name, email, password_hash, role, muted_notification_types, profile_public) "
                "VALUES (gen_random_uuid(), 'Legacy', 'legacy@example.com', 'x', 'PLAYER', '{}', true)"
            )
        )

    upgrade_schema(scratch_engine)

    with scratch_engine.connect() as conn:
        assert conn.scalar(text("SELECT name FROM users")) == "Legacy"
    assert _current_revision(scratch_engine) == _head_revision()


def test_drop_schema_leaves_nothing_behind(scratch_engine: Engine) -> None:
    upgrade_schema(scratch_engine)
    drop_schema(scratch_engine)
    with scratch_engine.connect() as conn:
        assert inspect(conn).get_table_names() == []
