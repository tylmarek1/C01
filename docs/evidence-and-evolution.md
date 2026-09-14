# C01 Engineering Spike

**Variant:** A — Persistence · **Date:** 2026-09-14 · **Branch:** `c01-spike`

Question / unknown:
Can we save a Reservation to a real PostgreSQL database and load it back unchanged, including time-zone-aware slot times, the state enum and references to Court and User?
And can the database itself enforce the common rule, "CONFIRMED reservations of the same court must not overlap", even when many players confirm the same slot at the same time (our Q future pressure)? Or do we need application-level locking?

What we did:
- Modelled `Court`, `User` and `Reservation` in SQLAlchemy 2 (`src/reservations/models.py`), with states `DRAFT / CONFIRMED / CANCELLED` stored as a PostgreSQL enum and `start_time`/`end_time` as `timestamptz`.
- Added a PostgreSQL exclusion constraint (needs the `btree_gist` extension). It rejects two CONFIRMED rows for the same court whose half-open ranges `[start, end)` overlap.
- Started a real PostgreSQL 16 with `docker compose up -d --wait db` and ran `uv run pytest -v -s`. The tests are in `tests/test_persistence_spike.py`:
  1. `test_reservation_roundtrip`: saves a CONFIRMED reservation for 18:00–19:30 Europe/Prague and reads it back in a new session. It checks id, court/user FK, status, and that the times are tz-aware and the same instant.
  2. `test_db_rejects_overlapping_confirmed`: 18:00–19:30 CONFIRMED, then 19:00–20:00 CONFIRMED on the same court must fail. An overlapping DRAFT and a back-to-back CONFIRMED (19:30–21:00) must be accepted.
  3. `test_concurrent_confirmations_only_one_wins`: 10 threads, each with its own DB connection, commit a CONFIRMED 18:00–19:00 on the same court at the same moment (synchronised with a `threading.Barrier`).

Observed result:
```
tests/test_health.py::test_health PASSED
tests/test_persistence_spike.py::test_reservation_roundtrip PASSED
tests/test_persistence_spike.py::test_db_rejects_overlapping_confirmed PASSED
tests/test_persistence_spike.py::test_concurrent_confirmations_only_one_wins
concurrent outcomes: ['ExclusionViolation' x9, 'ok' x1]
PASSED
======================== 4 passed, 2 warnings in 2.54s =========================
```
Constraint as created in the database (`pg_get_constraintdef`, PostgreSQL 16.15):
```
no_overlapping_confirmed_reservations | EXCLUDE USING gist (court_id WITH =, tstzrange(start_time, end_time, '[)'::text) WITH &&) WHERE ((status = 'CONFIRMED'::reservation_status))
reservation_time_order                | CHECK ((end_time > start_time))
```
- The round trip works. Times come back tz-aware (as UTC from PostgreSQL) and equal to the stored instant, so we must compare instants and not wall-clock strings.
- The overlapping CONFIRMED insert fails with `psycopg.errors.ExclusionViolation` (wrapped in SQLAlchemy `IntegrityError`). Overlapping DRAFT and back-to-back slots are accepted.
- Under 10 concurrent confirmations exactly **1 succeeded and 9 were rejected** by the database. No overlap got through, without any application-level locking.
- The 2 warnings are third-party deprecation notices (starlette/anyio in `TestClient`), unrelated to the spike.

Decision / what changes because of the result:
- **The common overlap rule is enforced in PostgreSQL by the exclusion constraint** (ADR-001). Application code may still pre-check availability for nicer error messages, but that check is never the only guard.
- The confirm endpoint (C02+) will catch `IntegrityError` with `ExclusionViolation` and map it to **HTTP 409 Conflict** ("slot already taken").
- We stay on **PostgreSQL for tests** (docker compose) and do not use SQLite, because SQLite has no exclusion constraints or `tstzrange`.
- Times are stored as `timestamptz` and handled as tz-aware `datetime` everywhere. The domain slot rule (07:00–22:00, :00/:30) will be evaluated in venue local time `Europe/Prague`.
- Next open point: the schema is created with `create_all`, so we need migrations (Alembic) before the first schema change. That ties into Release/Operation.
