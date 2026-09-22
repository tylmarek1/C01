---
name: versioning
description: How to think about change classification (breaking/feature/fix), CHANGELOG.md entries, and keeping backend/frontend/docs in step on Courtly (C01). Use when a change could be "breaking" for the dev DB or for the frontend's hand-maintained types, when deciding how a change should be described in a commit/PR, or when a merge should get a CHANGELOG entry or version bump.
---

# Versioning, kept lightweight

`frontend/` and `backend/` are always meant to move together against
`main` — there's still no versioned API contract or generated client
between them (see below for what that implies). There *is* now a
`CHANGELOG.md` at the repo root and version fields in `backend/pyproject.toml`
(`project.version`) and `frontend/package.json` (`version`) — keep these in
step, but don't build more release machinery than that (no tags, no
release branches, no automated bump tooling) unless the project's scale
actually grows into needing it; that would be the overengineering root
`CLAUDE.md` warns against.

## CHANGELOG.md

[Keep a Changelog](https://keepachangelog.com/) format, already in the repo.

- Every merged PR that changes user-visible or developer-visible behavior
  gets one bullet under `## [Unreleased]`, in the right category (`Added`,
  `Changed`, `Fixed`, `Removed`, `Deprecated`, `Security`). Add it as part
  of `finish-task` Step 4, before committing — not as a separate pass.
  Written for a reader, not restating the diff: "Add court-availability
  waitlist notifications," not "Add `notify_waitlist()` to `worker.py`."
- **Exempt**: pure refactors with zero behavioral change, formatting,
  typo/comment fixes, and this-infra-only changes (skills, CLAUDE.md,
  hooks) — those belong in the commit message, not the changelog.
- There is no release process yet (no tags, no `git-cliff`/similar), so
  `[Unreleased]` just accumulates. If the team ever cuts an actual release,
  that's the point to rename `[Unreleased]` to a dated version heading and
  start a fresh `[Unreleased]` — don't invent that ceremony preemptively.

## Version numbers

`backend/pyproject.toml`'s `project.version` and `frontend/package.json`'s
`version` are independent (backend and frontend are different deployables,
per ADR-002's repo split) and currently both pre-1.0 (`0.1.0` / `0.0.0`).
Bump only on a genuine breaking change to that side (see below) — most
day-to-day feature/fix work doesn't need a bump, and bumping isn't a
substitute for a CHANGELOG entry.

## What counts as "breaking" in this codebase

Matters more here than in a typical project, because there's no tooling
(no Alembic, no generated client) to catch a breaking change for you.

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
ADR-000..004 format.

## Git conventions

See root `CLAUDE.md`'s "Git workflow" section and `finish-task` for the
actual branch/commit/PR/merge mechanics — not duplicated here. A commit or
PR description is where "what changed and why" belongs, in prose; a
CHANGELOG entry is the same fact, written for a reader instead of a
reviewer — not CLAUDE.md (see root `CLAUDE.md`'s "what belongs in
CLAUDE.md" rule).
