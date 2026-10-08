from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from reservations.config import settings

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
# The revision that reproduces the schema `create_all` used to build (ADR-006).
BASELINE_REVISION = "0001"


class Base(DeclarativeBase):
    pass


def make_engine(url: str | None = None) -> Engine:
    return create_engine(url or settings.database_url)


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, expire_on_commit=False)


def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    return config


def upgrade_schema(engine: Engine, revision: str = "head") -> None:
    """Bring the database up to `revision` through the Alembic migrations.

    A database built by the old `create_all` (tables, but no
    `alembic_version`) is stamped at the baseline first rather than
    migrated through it — the baseline is exactly what it already has, so
    nothing in it is altered or recreated."""
    config = alembic_config()
    with engine.begin() as conn:
        config.attributes["connection"] = conn
        tables = set(inspect(conn).get_table_names())
        if "alembic_version" not in tables and "users" in tables:
            command.stamp(config, BASELINE_REVISION)
        command.upgrade(config, revision)


def downgrade_schema(engine: Engine, revision: str) -> None:
    config = alembic_config()
    with engine.begin() as conn:
        config.attributes["connection"] = conn
        command.downgrade(config, revision)


def drop_schema(engine: Engine) -> None:
    """Drop every table and type the models define, plus Alembic's own
    bookkeeping table — leaves an empty database for `upgrade_schema`."""
    from reservations import models  # noqa: F401

    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
