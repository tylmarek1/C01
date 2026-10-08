---
name: database-evolution
description: Write and check the Alembic migration for a SQLAlchemy model change on Courtly's backend — what autogenerate misses, backfills, downgrades, and protecting the exclusion constraint. Use before and after changing anything in backend/src/reservations/models/, before deciding a schema change is "done."
---

# Database evolution with Alembic

The schema's source of truth is `backend/src/reservations/migrations/versions/`
(ADR-006). `db.upgrade_schema()` runs them for the seed and the test suite;
`uv run alembic upgrade head` does it from the CLI.

## Every model change → one migration, same commit

```bash
cd backend
uv run alembic revision --autogenerate -m "<what changed>"
# read the draft line by line, fix it (below), then:
uv run alembic upgrade head
uv run pytest tests/test_migrations.py
```

Name the file by the next number (`--rev-id 0007`), so the chain reads in order.

## What autogenerate gets wrong or misses

| Change | What to do by hand |
|---|---|
| New value on an existing enum (e.g. a `ReservationStatus`) | `op.execute("ALTER TYPE reservation_status ADD VALUE 'X'")`. `test_every_postgres_enum_has_exactly_the_model_values` fails if forgotten |
| New enum *type* used by a new column on an existing table | create it explicitly (`postgresql.ENUM(..., name=...).create(op.get_bind(), checkfirst=True)`) before `add_column`; drop it in `downgrade()` |
| Column rename | autogenerate drafts drop + add (data loss) — replace with `op.alter_column(..., new_column_name=...)` |
| `ExcludeConstraint` / `CHECK` added or changed | not compared at all — write `op.create_exclude_constraint`/`op.execute` yourself |
| New NOT NULL column on a table that has rows | add it nullable, backfill with `op.execute(...)`, then `alter_column(nullable=False)` |
| Extension (`btree_gist`) | `op.execute("CREATE EXTENSION IF NOT EXISTS ...")` |

`downgrade()` must actually reverse `upgrade()`, enum types included —
`test_every_migration_downgrades_and_upgrades_again` runs the whole chain
down to `base` and back.

Never edit a migration that's already merged to `main`; add a new one.

## Protecting the exclusion constraint

`Reservation.__table_args__`'s `ExcludeConstraint` (`no_overlapping_active_
reservations`) is the mechanism the entire "no double booking" guarantee
rests on. If a change adds a new `ReservationStatus` value that should still
hold a court, it **must** be added to the constraint's `where=` status list —
in the model *and* in a migration that drops and recreates the constraint
(autogenerate won't). `test_the_exclusion_constraint_blocks_exactly_the_
active_statuses` fails if the two drift. Never move this check into
application code (a `SELECT` then `INSERT`) — that reintroduces the exact
race condition the constraint exists to prevent.

## Before finishing

Run `schema-change-sweep` (project-wide) for the code-reference side of the
change (models/schemas/frontend types), and the backend tests via
`finish-task`. Tell the user if their dev DB needs `uv run alembic upgrade head`.
