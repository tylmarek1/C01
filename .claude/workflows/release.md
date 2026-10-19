# Workflow: release

**Triggers:** "cut a release," "tag a version," "prepare C0N for
submission/grading."

Releases are tagged: each dated `CHANGELOG.md` heading has a git tag of
the same name (`v4.0.0`…`v4.1.0`), and course milestones have their own
tags (`c03-architecture`, `c05-detailed-design`). There are no release
branches and no automated bump tooling — don't add them preemptively.

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

## Cutting a tagged release

1. Verify on the branch: backend `uv run pytest`, frontend `npm run build`
   and `npm run lint`, `.claude/scripts/check-project-state.sh`.
2. Rename `[Unreleased]` in `CHANGELOG.md` to `[X.Y.Z] - date` (one
   `Added`/`Changed`/`Fixed` section each) and start a fresh `[Unreleased]`.
3. Bump `backend/pyproject.toml` (then `uv lock`) and `frontend/package.json`
   (and `package-lock.json`) independently, per `versioning`.
4. Point `docs/project-state.md` § "Latest relevant commit" and
   § "Latest verification" at the release.
5. After the PR is merged: `git tag -a vX.Y.Z -m … <merge commit>` and
   `git push origin vX.Y.Z`.
