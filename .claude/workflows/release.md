# Workflow: release

**Triggers:** "cut a release," "tag a version," "prepare C0N for
submission/grading."

This repository has **no tagged release process today** — that's a
deliberate, documented state (`versioning` skill: no tags, no release
branches, no automated bump tooling), not a gap this workflow exists to
close preemptively. This file exists for the moment the team actually
needs one, so that moment has a procedure instead of an improvised one.

## What "release" means for a course phase (the common case today)

Grading happens against a commit, not a tag. When preparing a course
phase for hand-in (C01, C02, and whatever C0N comes next):

1. **Run the phase's own gate check** — `c01.md` step 11 or
   `c02-baseline.md`/`c02-change.md` step 17 — and confirm
   `docs/project-state.md` reflects DONE/NOT-DONE with evidence for every
   item, not a summary "looks done."
2. **Confirm the one gate a session can't close on its own** — team
   approval (`docs/definition-of-done.md`) — is either genuinely given
   (checkboxes ticked, date filled, by the team) or explicitly reported as
   still open. Don't submit as "ready" with an open approval gate without
   saying so.
3. **`finish-task`'s full verification** — backend tests, frontend
   build/lint — actually run, not assumed green from a previous session.
4. **Record the commit** that represents the phase's state in
   `docs/project-state.md` and, if the phase's evidence template asks for
   a commit/tag (`docs/course/C02.md` §15 does), fill it there too.
5. **`versioning`'s CHANGELOG check** — `## [Unreleased]` should read as a
   true summary of what changed since the last phase; that's the closest
   thing this project has to release notes today.

## If the team ever does cut a real tagged release

Follow `versioning`'s existing rule: bump `backend/pyproject.toml`'s
`project.version` and `frontend/package.json`'s `version` independently,
only on a genuine breaking change to that side; rename `[Unreleased]` to a
dated version heading in `CHANGELOG.md` and start a fresh `[Unreleased]`.
Don't invent tagging, a release branch, or automated version bumping
before that's actually needed — that's exactly the overengineering root
`CLAUDE.md` and this workflow system both warn against.
