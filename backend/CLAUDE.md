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
uv run pytest -v                        # 300+ tests, real Postgres, own `<db>_test` database — see "Tests" below
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
service-module map. Three rules that aren't just "where" but genuinely
change behavior if missed, so they stay here rather than in the map:

- `lifecycle.py` is the *only* place a reservation's status should change.
  A new reservation is created as `PENDING` and moved on with
  `transition()`, never built directly in a later state: the
  waitlist-accept path once did, and that bypassed the approval and
  court-active guards. `tests/test_architecture.py` fails on a
  non-`PENDING` `Reservation(status=…)` or a `.status = ReservationStatus.…`
  assignment outside `lifecycle.py` (`seed.py` is exempt).
- `worker.py` is the *only* place a time-based side effect belongs
  (hold-expiry, reminders, auto-complete, waitlist cascade, push dispatch),
  following its existing tick pattern — not an ad hoc call from a route handler.
- Never call an external service inside a business transaction (it would
  run under the reservation's row lock and could announce a change that
  rolls back). Notifications go through `notify()`, which only queues; Web
  Push is sent by `push_delivery.py` alone — `tests/test_architecture.py`
  fails if anything else imports `pywebpush` (ADR-005).

## Logging and the audit log (ADR-007)

- Log through `logging.getLogger("reservations.<area>")`. The request id
  and user id are attached automatically (`observability.py`); pass
  anything else as `extra={...}`, not baked into the message string. Never
  log a token, password, hash, or full URL with its query string.
- The audit log is written by `audit.py`'s flush listener, not by routes.
  A new model or field that matters for "who changed what" gets added to
  `AUDITED_FIELDS` (an allowlist — secrets stay out). A Core-level bulk
  `update()`/`delete()` bypasses the listener; use ORM changes for audited
  models.

## Business rule values — read the code, don't trust a restated number

`rules.py` and `schemas/reservation.py` are the two canonical, single-source
modules for every tunable booking limit (`rules.py`: max active
reservations per role, min lead time, max advance booking window, hold
duration, no-show penalty threshold/window, max guests per reservation;
`schemas/reservation.py`: allowed slot durations, venue timezone).
Opening hours and court rates are **data**, not constants: per venue and
weekday in `venue_opening_hours`, per court in `court_price_rules`
(ADR-009, `opening_hours.py`/`pricing.py`); a new venue starts with
`opening_hours.DEFAULT_*`. Both are already written with a comment explaining *why*
each constant is what it is — read them directly rather than trusting a
number restated in a doc, a skill, or a comment elsewhere, including this
file. If you find yourself typing one of these numbers into a new location,
stop and import/reference the constant instead — a second hardcoded copy is
exactly how these drift apart. (`schemas/reservation.py` and `seed.py`
already independently define `VENUE_TZ` instead of one importing it from
the other — a small, real instance of this drift; see the `consistency`
skill.)

## Schema changes go through Alembic migrations (ADR-006)

The schema's source of truth is `src/reservations/migrations/versions/`,
not `create_all`. `db.upgrade_schema()` (used by `seed.py` and the test
suite) runs `alembic upgrade head`; a database still built by the old
`create_all` is stamped at the `0001` baseline first, never rebuilt. (Bare
`uv run alembic upgrade head` doesn't do that adoption step — on a
pre-Alembic database run the seed once instead.)

Any change in `models/` needs a migration in the same commit:

```bash
cd backend
uv run alembic revision --autogenerate -m "add venue_id to courts"   # draft
# review the draft by hand — see what autogenerate misses below
uv run alembic upgrade head                                         # apply to the dev DB
```

Autogenerate does **not** see, so you write these by hand:
- a new value on an existing Postgres enum (`ALTER TYPE … ADD VALUE`) —
  `test_every_postgres_enum_has_exactly_the_model_values` fails if you forget;
- changes to an `ExcludeConstraint` (its `WHERE` status list included) or a
  `CHECK` constraint;
- extensions (`btree_gist`) and data backfills.

Every migration has a working `downgrade()`. `tests/test_migrations.py`
checks that the migrated schema matches the models and that the whole chain
downgrades to `base` and back up. Don't edit a migration that has been
merged to `main` — add a new one.

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
against the venue's opening hours (then a fixed 07:00–22:00 **Europe/Prague**
local time, now per venue in the database) rejected valid bookings from browsers in other offsets. The fix —
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
- Tests run in **their own database**. `conftest.py` repoints
  `settings.database_url` to `TEST_DATABASE_URL`, or else to the dev
  database's name plus `_test` (`reservations_test` by default), and
  creates that database on first run. The session-scoped `engine` fixture
  then runs `drop_schema` + `upgrade_schema` there, and it refuses to run
  against a database whose name doesn't end in `_test`. As a result,
  `uv run pytest` leaves the seeded dev database alone and can run while
  `fastapi dev` is up. Keep both properties: never point the suite back at
  `DATABASE_URL` itself.
- When you add or change a model/schema, run the `schema-change-sweep`
  skill — the migration tests catch schema drift, but nothing (no generated
  types) catches a missed call site in the code for you.

## Backend-specific skills

These live in `backend/.claude/skills/` and apply automatically when you're
working here; see root `CLAUDE.md` for the project-wide ones (
`feature-development`, `finish-task`, `self-review`, `security-review`,
`performance-review`, etc.).

| Skill | Use it when |
|---|---|
| `api-design` | Adding a new endpoint, or changing a request/response shape |
| `database-evolution` | Before and after changing anything in `models/` — writing and checking the Alembic migration |
| `backend-testing` | Adding backend functionality that needs coverage, or fixing a backend bug |
