# Architecture and Decisions

## Overview

```
HTTP client ──► FastAPI (src/reservations/main.py)
                  │  request/response schemas (Pydantic)
                  ▼
               domain logic (states, slot rule)
                  │
                  ▼
               SQLAlchemy ORM (models.py, db.py) ──► PostgreSQL 16
                  │
                  └──► Notification Service (boundary, stub for now)
```

- **Stack:** Python 3.12, FastAPI, SQLAlchemy 2, psycopg 3, PostgreSQL 16, pytest, uv, Docker Compose.
- **Configuration:** `DATABASE_URL` environment variable (default in `.env.example`).
- **Tests** run against a real PostgreSQL started by `docker compose`, not SQLite, because we rely on PostgreSQL-specific features.

## Decisions

### ADR-000: Python/FastAPI instead of the Java/Spring stack
- **Status:** accepted (C01)
- **Context:** the team is faster in Python. The course allows another stack if the team supports it itself.
- **Decision:** use FastAPI + SQLAlchemy + PostgreSQL, with uv for reproducible dependency management (`uv.lock`).
- **Consequence:** no course support for the stack. The README must be enough for a clean checkout to build and run.

### ADR-001: Enforce "no overlapping CONFIRMED reservations" with a PostgreSQL exclusion constraint
- **Status:** accepted (C01, based on the persistence spike, see `evidence-and-evolution.md`)
- **Context:** the common business rule must hold even under our Q pressure (10× concurrent confirmations of the same slot). An application-level check (SELECT, then INSERT/UPDATE) races between concurrent transactions.
- **Decision:** `reservations` has
  `EXCLUDE USING gist (court_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status = 'CONFIRMED')`
  (requires the `btree_gist` extension), plus `CHECK (end_time > start_time)`.
- **Consequences:**
  - The database is the source of truth for the rule. In the spike, 10 concurrent confirmations gave 1 success and 9 `ExclusionViolation`s.
  - Half-open ranges allow back-to-back slots. DRAFT and CANCELLED rows do not block a slot.
  - The API must translate `ExclusionViolation` into HTTP 409 Conflict.
  - The project is tied to PostgreSQL, and tests must run against PostgreSQL rather than SQLite.
