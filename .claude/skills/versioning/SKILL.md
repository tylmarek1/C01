---
name: versioning
description: How to think about change classification (breaking/feature/fix) and keeping backend/frontend/docs in step on Courtly (C01), which has no release process, no version numbers, and no versioned API contract. Use when a change could be "breaking" for the dev DB or for the frontend's hand-maintained types, or when deciding how a change should be described in a commit/PR.
---

# Versioning, without inventing a release process

Courtly has no semantic version, no CHANGELOG, no tagged releases, and no
versioned API — `frontend/` and `backend/` are always meant to move together
against `main`. Don't introduce a version scheme, a CHANGELOG file, or a
release checklist; none of that is warranted at this project's current
scale, and it would be exactly the overengineering the root `CLAUDE.md`
warns against.

What *does* matter here, because there's no tooling to catch it for you:

## What counts as "breaking" in this codebase

- **A column/enum change on an existing table** is breaking for the dev
  database specifically — see `database-evolution` (backend). It's not
  breaking for git history, but it will break the running dev environment
  until the manual recreate cycle runs.
- **A backend schema (Pydantic) field rename/removal** is breaking for the
  frontend's hand-maintained `types/` — there's no generated client to fail
  loudly, so this is a silent break until someone notices at runtime. See
  `schema-change-sweep`.
- **A reservation lifecycle change** (`lifecycle.py`) is breaking for every
  endpoint and frontend component that branches on `ReservationStatus` —
  treat it like a breaking API change even though there's no version number
  to bump.
- **A new required field on an existing request schema** breaks any existing
  frontend call site that doesn't send it yet — check `frontend/src/lib/
  api.ts` and call sites before assuming "just add a field" is additive.

## What's safely additive

- A new table, a new optional field, a new endpoint, a new frontend page —
  these don't need special coordination beyond the normal
  `feature-development` flow.

## Backend and frontend must move together

Because there's no versioned contract between them, a backend change that
alters a response shape and a frontend change that consumes it belong in the
**same** PR — don't land a breaking backend change and leave the frontend
update for later, and don't hand-wave "the frontend will adapt" without
actually updating it.

## Keeping docs honest through a change

Use `update-docs` for the actual doc-sync mechanics. The versioning-relevant
part: a breaking change (as defined above) is exactly the kind of thing
`docs/architecture-and-decisions.md` should get a new ADR for if it reflects
a real architectural decision (not just a bug fix) — follow the existing
ADR-000..003 format.

## Git conventions

Feature branch → reviewed PR (author ≠ reviewer), per root `CLAUDE.md` and
the convention already used for the graded C01 spike (PR #5). A commit or PR
description is where "what changed and why" belongs — not CLAUDE.md (see
root `CLAUDE.md`'s "what belongs in CLAUDE.md" rule).
