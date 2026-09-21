---
name: update-docs
description: Map a Courtly (C01) code change to the README/docs it may have invalidated, and know what's durable enough to belong in CLAUDE.md versus what belongs in a commit message instead. Use after a change that could make root README.md, backend/README.md, frontend/README.md, or docs/*.md wrong, or when picking up stale context in this repo.
---

# Keep docs honest

## Context: docs drift behind code, some docs are frozen by design

See root `CLAUDE.md` §0 for which docs are living (should track current
code) versus frozen by design (graded/point-in-time, never rewritten to
match newer code) — don't restate that list or its numbers here; it will
just go stale a second time, the way this section itself once did. Don't
make a living doc's drift worse. Fix it opportunistically when you touch
its subject matter, even if the specific number/claim you're fixing isn't
why you're in that file.

## Step 1 — Read the current code for the area you're documenting

Don't propagate the existing staleness by copying nearby stale prose as a
template. Confirm the actual current behavior first (see root `CLAUDE.md`
§0 — code is ground truth, docs are decisions).

## Step 2 — Diff signal → doc to check

| What changed | Check |
|---|---|
| A reservation state or transition | `README.md` domain table, `docs/intent-and-change.md` |
| A backend endpoint/router added or changed | `backend/README.md`'s API reference, root `README.md`'s endpoint list |
| A frontend page/feature added or changed | `frontend/README.md`, root `README.md`'s feature bullets |
| A new architectural decision (new dependency, new cross-cutting pattern) | Add a new ADR to `docs/architecture-and-decisions.md`, matching the existing ADR-000..003 format (status/context/decision/consequences) |
| A doc states a specific number (test count, endpoint count) that's now wrong | Fix it, even if unrelated to your change — but don't go on an unrelated doc-fixing spree in the same PR unless asked |
| A course phase/gate completes, opens, or changes | `docs/project-state.md` — see `docs/definition-of-done.md` for what counts as evidence |
| Any user/developer-visible change, once verified | `CHANGELOG.md`'s `[Unreleased]` section — see `versioning` for category and what's exempt; this is normally done inside `finish-task` Step 4, not a separate pass |

## Step 3 — What belongs in CLAUDE.md (root, backend, or frontend)

A durable constraint that would silently break something if violated — a
trap, an invariant, a "the tool won't warn you" gap. **Not** feature
history, not "we added X," not session narration — those belong in a commit
message or the README instead. If you're tempted to add a sentence
describing what a feature *does* rather than a rule about how to safely
*change* something near it, it's README material, not CLAUDE.md material.

## Step 4 — Edit in place

Match the doc's existing voice/format rather than rewriting its structure.
If a section is too stale to patch incrementally and genuinely needs a
fuller rewrite, say so explicitly rather than leaving it half-fixed.
