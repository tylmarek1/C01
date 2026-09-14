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
