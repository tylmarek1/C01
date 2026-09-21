---
name: finish-task
description: Verification checklist to run before declaring any non-trivial backend or frontend change on Courtly (C01) complete — picks the right test/build/lint commands for what actually changed and confirms they pass. Use before telling the user a change is done, especially when there's no CI to catch mistakes. Pairs with self-review (the qualitative pass) and improve-app (the follow-up-classification pass).
---

# Finish a task on Courtly

This repo has no CI, no pre-commit hooks, and no automated frontend tests —
this checklist is the closest thing it has to a quality gate. It's the
mechanical "does it run" pass; `self-review` is the qualitative "is it good"
pass — do both, in either order, before calling non-trivial work done.

## Step 1 — Restate the goal

In one or two sentences, restate what was actually asked, and check what you
built actually does that.

## Step 2 — Pick the checks that match what changed

Don't run every command regardless of relevance, and don't skip one because
it's slow if it's actually relevant:

| You touched | Run |
|---|---|
| Any `backend/src/**/*.py` | `cd backend && uv run pytest -v` |
| A model/schema/type shape | `schema-change-sweep` first, then the tests above |
| Any `frontend/src/**` | `cd frontend && npm run build && npm run lint` |
| New/edited user-facing frontend text | `i18n-check`, in addition to the build/lint above |
| Only docs/README/`CLAUDE.md`/comments, no code | No test/build run needed — but see `update-docs` |
| A reservation-state, booking-rule, timezone, or auth change | Run the backend tests **and** re-read `backend/CLAUDE.md`'s relevant section before considering it done — these are this codebase's known-sharp edges |

```bash
cd backend && uv run pytest -v
```
This **wipes the dev database** (`conftest.py` drops+recreates the schema).
Reseed afterward if you want to browse/demo the app:
```bash
uv run python -m reservations.seed
```
Don't run this while `fastapi dev` is also up against the same DB (deadlock
risk) — stop the dev server first.

## Step 3 — Fix failures

Never report a change as done with a red test or a broken build. If a
failure is pre-existing and unrelated to your change, say so explicitly
rather than silently leaving it.

## Step 4 — Docs

If the change makes a README or `docs/*.md` claim wrong, either fix it or
flag it explicitly — see `update-docs`. Don't leave a doc more wrong than
you found it.

## Step 5 — Report

Never `git commit` or `git push` unless explicitly asked in the current
request. Report exactly what changed, which checks you ran (and why those
and not others), and anything you noticed but didn't fix.
