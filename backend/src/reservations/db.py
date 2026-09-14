from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from reservations.config import settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str | None = None) -> Engine:
    return create_engine(url or settings.database_url)


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, expire_on_commit=False)


def create_schema(engine: Engine) -> None:
    # btree_gist lets a GiST exclusion constraint compare court_id with "=".
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
    from reservations import models  # noqa: F401  (registers tables on Base.metadata)

    Base.metadata.create_all(engine)


def drop_schema(engine: Engine) -> None:
    from reservations import models  # noqa: F401

    Base.metadata.drop_all(engine)
