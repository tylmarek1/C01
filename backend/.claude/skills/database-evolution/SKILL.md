---
name: database-evolution
description: Decide whether a SQLAlchemy model change on Courtly's backend is safe as-is, or needs the manual schema-recreation cycle — this project has no Alembic, so nothing else tells you this. Use before and after changing anything in backend/src/reservations/models/, before deciding a schema change is "done."
---

# Database evolution without a migration tool

`backend/src/reservations/db.py` only has `create_schema`/`drop_schema`
(`Base.metadata.create_all`/`drop_all`). There is no Alembic, and none
should be added incidentally — this is a known, deliberate, already-flagged
gap (`cviko1/todo.md` names it), not an oversight to silently fix mid-task.

## Is this change safe with just a reseed, or does it need the recreation cycle?

| Change | Safe with just a reseed? |
|---|---|
| New table (new model file) | Yes — `create_all` creates what doesn't exist |
| New column on an existing table | **No** — `create_all` never alters an existing table |
| New value on an existing enum type (e.g. a new `ReservationStatus`) | **No** — same reason |
| Changing a column's type/nullability on an existing table | **No** |
| Removing a column (model side only, column stays in DB) | Technically "safe" in that nothing breaks, but leaves an orphaned column — do the recreation cycle to actually clean it up |
| Adding/changing an index or constraint on an existing table | **No** |

For anything in the "No" column, after editing the model:

```bash
cd backend
uv run python -c "from reservations.db import make_engine, drop_schema; drop_schema(make_engine())"
uv run python -c "from reservations.db import make_engine, create_schema; create_schema(make_engine())"
uv run python -m reservations.seed
```

This is destructive to whatever is currently in the dev database — it's the
same operation `conftest.py` already does per test session, which is why
running the test suite doesn't need this separately, but it means **passing
tests does not mean the dev database has caught up**. Don't tell the user a
schema change is done without either running this cycle or telling them it's
still needed.

## Protecting the exclusion constraint

`Reservation.__table_args__`'s `ExcludeConstraint` (`no_overlapping_active_
reservations`) is the mechanism the entire "no double booking" guarantee
rests on. If a change adds a new `ReservationStatus` value that should still
hold a court (i.e. it's not a terminal/released state), it **must** be added
to the constraint's `where=text("status IN (...)")` clause, or double-
booking protection silently stops covering it. Never move this check into
application code (a `SELECT` then `INSERT`) — that reintroduces the exact
race condition the constraint exists to prevent.

## Data safety on rename/retype

There's no migration to preserve data through a rename — editing a model's
column name and running the recreation cycle above **drops and recreates
the whole schema**, losing all current data (fine for a dev/demo database
seeded from `seed.py`, catastrophic if ever pointed at anything with real
data). If a rename ever needs to preserve existing data, that's a sign this
project has outgrown "no migrations" and Alembic should be proposed as a
deliberate decision — not worked around with a manual `ALTER TABLE`, which
would leave `create_all`'s assumptions and the model definition out of sync.

## Before finishing

Run `schema-change-sweep` (project-wide) for the code-reference side of the
change (models/schemas/frontend types), and the backend tests via
`finish-task`.
