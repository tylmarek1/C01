# Backend — CLAUDE.md

FastAPI + SQLAlchemy 2 + PostgreSQL 16, managed with `uv`. Read the root
`CLAUDE.md` first — this file only covers backend-specific rules. For where
modules live and what each one owns (architecture diagram, `api/`/`models/`/
service-module map), see `docs/codebase-map.md` — don't duplicate that
here, extend it if something there goes stale.

## Commands

```bash
docker compose up -d --wait db          # from repo root — Postgres 16 on :5432
cd backend
uv sync                                 # install deps into backend/.venv
uv run pytest -v                        # 170+ tests, real Postgres — see "Tests wipe the dev DB" below
uv run python -m reservations.seed      # idempotent demo data
uv run fastapi dev src/reservations/main.py   # dev server w/ reload, :8000, Swagger at /docs
curl localhost:8000/health
```

No lint/type-check command is wired into any script today. `ruff` is not a
project dependency, but `uvx ruff check src` / `uvx ruff format src` work
ad hoc (uvx fetches ruff on demand) if you want a second opinion on style —
don't commit a `pyproject.toml` ruff config or otherwise "turn on" enforced
linting as a side effect of an unrelated change; that's a deliberate
project-wide decision to propose, not slip in.

A `.claude/settings.json` hook runs `uvx ruff format` (default settings) on
any backend `.py` file after Claude edits or writes it — best-effort and
fail-open, it never blocks a tool call. Default `ruff format` also wraps
overlong lines, not just whitespace, so an edited file may come back
reformatted beyond the lines you touched; that's expected, not a bug.

## Module layout

See `docs/codebase-map.md` for the full `models/`/`schemas/`/`api/`/
service-module map. Two rules that aren't just "where" but genuinely
change behavior if missed, so they stay here rather than in the map:

- `lifecycle.py` is the *only* place a reservation's status should change.
  Never construct a `Reservation` with `status=CONFIRMED` around
  `transition()`: the waitlist-accept path did, and it would have
  bypassed the approval rule.
- `worker.py` is the *only* place a time-based side effect belongs
  (hold-expiry, reminders, auto-complete, waitlist cascade), following its
  existing tick pattern — not an ad hoc call from a route handler.

## Business rule values — read the code, don't trust a restated number

`rules.py` and `schemas/reservation.py` are the two canonical, single-source
modules for every tunable booking limit (`rules.py`: max active
reservations per role, min lead time, max advance booking window, hold
duration, no-show penalty threshold/window, max guests per reservation;
`schemas/reservation.py`: allowed slot durations, opening/closing hours,
venue timezone). Both are already written with a comment explaining *why*
each constant is what it is — read them directly rather than trusting a
number restated in a doc, a skill, or a comment elsewhere, including this
file. If you find yourself typing one of these numbers into a new location,
stop and import/reference the constant instead — a second hardcoded copy is
exactly how these drift apart. (`schemas/reservation.py` and `seed.py`
already independently define `VENUE_TZ` instead of one importing it from
the other — a small, real instance of this drift; see the `consistency`
skill.)

## No Alembic — the sharpest trap in this codebase

`db.py` only has `create_schema`/`drop_schema`
(`Base.metadata.create_all`/`drop_all`). This means:

- Adding a **new table** (a new model file) is safe with just a reseed —
  `create_all` will create it.
- Adding a new **column to an existing table**, or a new **value to an
  existing Postgres enum type** (e.g. a new `ReservationStatus` member), is
  **not** picked up by `create_all` — it only creates what doesn't exist
  yet, it never alters what does. If you make this kind of change, the dev
  database needs a full manual cycle after you're done:

  ```bash
  cd backend
  uv run python -c "from reservations.db import make_engine, drop_schema; drop_schema(make_engine())"
  uv run python -c "from reservations.db import make_engine, create_schema; create_schema(make_engine())"
  uv run python -m reservations.seed
  ```

  (pytest's `conftest.py` already does this drop+create per test session,
  which is why the test suite doesn't need this — but it means running the
  tests does **not** validate that the *dev* database has caught up to a
  schema change; you still owe it the manual cycle above if you want to
  browse/demo afterward.)

This is a deliberate, known, already-flagged gap (root `CLAUDE.md`'s
"Known gaps") — don't introduce Alembic unprompted as a fix; if a task
would genuinely benefit from it, say so and let the user decide.

## Concurrency correctness — don't touch this without extra care

`Reservation.__table_args__` (in `models/reservation.py`) carries the rule
this whole project is built around:

```python
ExcludeConstraint(
    (literal_column("court_id"), "="),
    (literal_column("tstzrange(start_time, end_time, '[)')"), "&&"),
    name="no_overlapping_active_reservations",
    using="gist",
    where=text("status IN ('PENDING', 'PENDING_APPROVAL', 'CONFIRMED', 'CHECKED_IN')"),
)
```

PostgreSQL itself rejects an overlapping insert/update for any reservation
whose status is `PENDING`, `PENDING_APPROVAL`, `CONFIRMED`, or `CHECKED_IN` on
the same court — `COMPLETED`/`CANCELLED`/`EXPIRED`/`REJECTED`/`NO_SHOW` don't
block a slot. Half-open
ranges (`'[)'`) allow back-to-back bookings. The API must translate the
resulting `ExclusionViolation` into HTTP 409, not a 500 or a silent retry.

If a change adds a new "this reservation is still holding the court" status,
it must be added to the `WHERE` clause's status list too, or double-booking
protection silently stops covering it. If a change needs a different
overlap rule (e.g. per-sport buffer time), extend this constraint or add
another one — don't reimplement the check as a Python
`SELECT`-then-`INSERT`; that reintroduces the exact race condition ADR-001
exists to eliminate.

## Timezones

A real bug already happened here: comparing UTC wall-clock hours directly
against the venue's opening-hours rule (07:00–22:00 **Europe/Prague** local
time) rejected valid bookings from browsers in other offsets. The fix —
`astimezone(VENUE_TZ)` before any hour/minute comparison — is now the
pattern and is regression-tested. Any new time-of-day validation must
convert to venue-local time first; never compare naive UTC hours/minutes
against a local-time rule.

## Auth

Stateless JWT (`HS256`, via `pyjwt`), `sub` = user id; `bcrypt` for password
hashing. `get_current_user` (in `deps.py`) decodes the bearer token and
loads the `User` row — reuse this dependency rather than re-implementing
auth checks in a new router. `SECRET_KEY` falls back to an insecure default
for local dev on purpose (ADR-003) — see root `CLAUDE.md`'s security note.

## Error handling

Routes raise `fastapi.HTTPException(status_code, "message")` with a plain
string `detail` — there is no stable machine-readable error `code`
convention today, and the frontend's `extractErrorMessage` (in
`frontend/src/lib/api.ts`) only reads `detail` as either a string or a
Pydantic validation-error array. Match this shape for new endpoints; don't
introduce a different error envelope (e.g. an RFC 9457 problem-details body)
for just one new router without checking with the user first — the frontend
doesn't know how to parse it yet.

## Tests

- `httpx` `TestClient` against a **real** PostgreSQL — never mock or swap in
  SQLite; the exclusion constraint is Postgres-specific and is exactly what
  the tests need to exercise.
- One file per feature area (`test_<feature>_api.py`), matching the `api/`
  router split. Exception: `test_spec_baseline.py` and `test_approval_api.py`
  are the executable form of `docs/specification*.md` — each test name starts
  with the id of the verification example (`VE-xx.y`) it runs. Change
  behaviour those examples describe → change the specification and the VE
  together, not one of them.
- `conftest.py`'s session-scoped `engine` fixture runs `drop_schema` +
  `create_schema` against `DATABASE_URL` — **there is no separate test
  database**. Running `uv run pytest` wipes whatever is in the dev database.
  Reseed afterward (`uv run python -m reservations.seed`) if you want to
  browse or demo the app.
- Don't run `uv run pytest` while `fastapi dev` is also running against the
  same database — the worker's periodic tick and pytest's per-test
  `TRUNCATE ... CASCADE` can deadlock on Postgres table locks, failing
  unrelated tests non-deterministically. Stop the dev server first.
- When you add or change a model/schema, run the `schema-change-sweep`
  skill — nothing in this stack (no Alembic, no generated types) will catch
  a missed call site for you.

## Backend-specific skills

These live in `backend/.claude/skills/` and apply automatically when you're
working here; see root `CLAUDE.md` for the project-wide ones (
`feature-development`, `finish-task`, `self-review`, `security-review`,
`performance-review`, etc.).

| Skill | Use it when |
|---|---|
| `api-design` | Adding a new endpoint, or changing a request/response shape |
| `database-evolution` | Before and after changing anything in `models/` — is this safe with just a reseed, or does it need the manual recreation cycle? |
| `backend-testing` | Adding backend functionality that needs coverage, or fixing a backend bug |
