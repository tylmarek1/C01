---
name: backend-testing
description: Conventions for writing and running backend tests on Courtly — real Postgres, one file per feature area, when a regression test is required. Use when adding backend functionality that needs test coverage, or fixing a backend bug.
---

# Backend testing conventions

## The pattern

- `httpx.TestClient` against a **real** PostgreSQL — never mock or swap in
  SQLite. The exclusion constraint and other Postgres-specific behavior are
  exactly what needs exercising; a mocked DB would test nothing about the
  guarantee that actually matters.
- One file per feature area: `test_<feature>_api.py`, matching the `api/`
  router split (`test_reservations_api.py`, `test_waitlist_api.py`, ...). A
  new router or a substantial new feature module gets its own test file
  rather than being appended to an unrelated one.
- `conftest.py`'s session-scoped `engine` fixture drops and recreates the
  whole schema once per test session; a per-test fixture truncates tables
  between tests. This means tests don't need to clean up after themselves,
  but it also means **there is no separate test database** — running the
  suite wipes the dev database (see root `CLAUDE.md`/`finish-task`).

## What needs a test

- Any new endpoint: at least the happy path and the most likely rejection
  (a validation failure, a conflict, an ownership/role failure).
- Any bug fix: a regression test reproducing the original failure, not just
  a manual confirmation it's fixed. This project has a real precedent for
  why — the timezone bug (comparing UTC hours against venue-local opening
  hours) is now permanently regression-tested precisely because it was easy
  to reintroduce silently.
- Any change to `lifecycle.py`'s transitions or `rules.py`/
  `booking_validation.py`'s constraints: a test proving the constraint is
  still enforced, not just that the happy path still works.
- Any change to the exclusion constraint's covered statuses: a concurrency-
  style test if practical (see `test_persistence_spike.py` for the existing
  pattern — concurrent confirmations of the same slot, expect exactly one
  success).

## What doesn't need a new test file

A small, additive change to an already-well-covered area (e.g. a new field
on an existing, already-tested endpoint) can extend that endpoint's
existing test file rather than spawning a new one.

## Running

```bash
cd backend && uv run pytest -v
```
Wipes the dev DB — reseed after if you want to browse the app
(`uv run python -m reservations.seed`). Don't run this while `fastapi dev`
is also up against the same DB (deadlock risk from the worker's tick
colliding with the test fixture's `TRUNCATE`).

## What this project doesn't have (don't pretend otherwise)

No test coverage tooling, no mutation testing, no contract tests against the
frontend. If a task would genuinely benefit from one of these, say so
explicitly rather than assuming it exists or silently adding it.
