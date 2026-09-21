---
name: schema-change-sweep
description: Grep-based impact sweep for adding, renaming, retyping, or removing a SQLAlchemy model field/table, a Pydantic schema field, or a hand-maintained frontend type in Courtly (C01). Use whenever a backend model or schema changes shape — this project has no Alembic and no generated API-type client, so nothing else in the toolchain will catch a missed call site.
---

# Schema/model change impact sweep

Why this exists: C01 has no migration tool and no OpenAPI-generated frontend
client. A SQLAlchemy model, its mirrored Pydantic schema, and its
hand-maintained frontend TS type are three independently-written places that
must agree — the type checker only catches a mismatch where it can actually
see both sides of an assignment, which is often not the case for dict-like
Pydantic access, `.filter_by(**kwargs)`, or an untouched object literal.

## Step 1 — Classify the change

Additive (new field/table) / rename / retype / remove. This determines
whether a schema-recreation cycle is needed (see Step 4).

## Step 2 — Grep before you touch anything

Search for every reference to the old name/shape across:
- `backend/src/reservations/**/*.py` — the model attribute itself, the
  mirrored schema field, any `.filter_by()`/`.order_by()`/`sorted(...,
  key=...)` call using the field name as a string or lambda, `seed.py`,
  `worker.py`.
- `backend/tests/**/*.py` — fixtures and assertions referencing the field.
- `frontend/src/types/**` — the hand-maintained mirror type.
- `frontend/src/lib/api.ts` and any page/component destructuring the field.
- `frontend/src/locales/{en,cs}.ts` — if the field's label is user-facing
  text that needs to change too.

## Step 3 — Present the full hit list before editing

A rename can silently orphan a call site the compiler stayed quiet about
(Python attribute access on a loosely-typed object, or a frontend type on an
`any`-ish boundary). Look at the whole list before deciding the change is
as small as it first appeared.

## Step 4 — Handle the schema-recreation gap

For a change to a column/enum on an **already-existing** table: there's no
migration to write. You're editing the SQLAlchemy model, and then the dev
database needs the manual cycle from `backend/CLAUDE.md`
(`drop_schema` + `create_schema` + reseed) — `create_all` will not alter an
existing table or enum type. A pure code-side rename with no schema
recreation leaves the dev DB holding the old column name.

## Step 5 — Re-grep after editing

The old name should return zero hits outside comments, migrations-that-
don't-exist-here, or historical docs. If it still shows up, you missed a
call site.

## Step 6 — Verify

Run the affected backend tests and `npm run build` — this catches some of
what changed, but not everything (see the intro); don't treat a clean build
as proof the sweep was unnecessary next time.
