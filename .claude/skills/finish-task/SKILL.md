---
name: finish-task
description: Owns the end of the engineering lifecycle on Courtly (C01) — verification, self-review, docs/changelog, commit, push, PR, merge, cleanup. Picks the right test/build/lint commands for what actually changed, confirms they pass, then drives the change to a merged PR unless something blocks it. Use before telling the user a change is done. Pairs with self-review (the qualitative pass) and improve-app (the follow-up-classification pass).
---

# Finish a task on Courtly

This repo has no CI and no automated frontend tests, and (beyond the
main-branch guard hook) no pre-commit hooks — Steps 1-3 below are the
closest thing it has to a quality gate. This skill is also where the
engineering lifecycle from root `CLAUDE.md`'s "Git workflow" actually gets
driven: verify → review → docs/changelog → commit → push → PR → merge →
cleanup. Do Steps 1-4 (verification) regardless; do Steps 5-9 (the Git
lifecycle) for any change that isn't purely exploratory/read-only — the
user shouldn't have to ask for a branch, a commit, or a PR separately.

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

## Step 4 — Docs and changelog

If the change makes a README or `docs/*.md` claim wrong, either fix it or
flag it explicitly — see `update-docs`. Don't leave a doc more wrong than
you found it. For anything a user or developer would notice (not an
internal refactor with zero behavior change), add an entry under
`## [Unreleased]` in root `CHANGELOG.md` — see `versioning` for the
category (Added/Changed/Fixed/etc.) and what's exempt (typo fixes, pure
formatting, non-behavioral refactors don't need an entry).

## Step 5 — Self-review

Run `self-review` (the qualitative pass) if you haven't already as part of
the calling skill's own flow — don't skip straight to committing on a
change that's only been mechanically verified, not read.

## Step 6 — Branch check

If you're still on `main`, this should already have been caught before
implementation (root `CLAUDE.md`'s "Git workflow") — but if it wasn't,
create the branch now (`git checkout -b <type>/<short-desc>`) and move the
work onto it before committing; don't let the guard hook be the only thing
that stops a commit on `main`.

## Step 7 — Commit

Commit once Steps 1-6 are clean, in one or a few coherent commits (not one
commit per file, not one giant commit mixing unrelated concerns).
Conventional Commits style (`feat: …`, `fix: …`, `refactor: …`, `test: …`,
`docs: …`, `chore: …`, `perf: …`), message explains *why*. Review what's
staged (`git status`/`git diff --staged`) before committing — don't sweep
in unrelated files.

## Step 8 — Push and open a PR

`git push -u origin <branch>`, then `gh pr create`. PR body:

```
## Summary
- what changed (bullet form)

## Why
- the motivation/decision

## Testing
- exact commands run in Step 2, and their result

## Risks / notes
- anything a reviewer should specifically look at (skip if none)
```

Keep it grounded in what actually changed — don't pad it with boilerplate
sections that have nothing to say.

## Step 9 — Merge and clean up

If nothing blocks it — verification passed, self-review found nothing
left unfixed in scope, and (when practical) `/code-review` or another
reviewer has looked at it — merge with `gh pr merge --delete-branch`
and sync local `main` (`git checkout main && git pull`). If something
does block it (a finding you can't safely fix now, a decision only the
user can make), stop and say so instead of merging past it — don't merge
knowingly broken or unreviewed-and-risky code.

## Step 10 — Report

Report exactly what changed, which checks you ran (and why those and not
others), the PR (link, merged or open-and-why-not), and anything you
noticed but didn't fix.
