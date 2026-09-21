# Workflow: bug fix

**Triggers:** "oprav kolizi rezervací," "fix X," "X is broken" — behavior
disagrees with what it should be (the spec, a rule, or plain common
sense), as opposed to a missing capability (`feature.md`) or a spec/impact
question (`c02-change.md`).

This is the short loop on purpose — `INSPECT → CHANGE → VERIFY → REVIEW`,
not the full feature loop. Don't force UNDERSTAND/PLAN/DOCUMENT ceremony
onto a genuine small fix, but don't skip root-causing it either.

## Procedure

1. **Find the actual root cause before touching code.** Reproduce it if
   at all possible (a failing test is the strongest form of
   reproduction). Check whether `docs/specification.md` already defines
   the correct behavior — if the bug is a mismatch between code and an
   existing REQ/BR, the spec is very likely right and the code is wrong
   (per `docs/definition-of-done.md` and this repo's own precedent:
   `docs/evidence-and-evolution.md`'s "Nalezený nesoulad" table is full of
   exactly this pattern, item by item, including which source turned out
   to be at fault each time — a spec/doc mismatch is not automatically the
   code's fault, sometimes it's the doc's, per root `CLAUDE.md` §0).
2. **Check `docs/project-state.md`'s "Known pitfalls" style traps** (root
   `CLAUDE.md`'s "Known pitfalls" section) — venue-timezone comparisons,
   the exclusion constraint's status list, `create_all` not altering
   existing tables, frontend-only rule enforcement, incomplete i18n. A
   surprising number of real bugs in this codebase are instances of one of
   these five.
3. **Add a regression test that reproduces the bug** *before* fixing it,
   if practical — confirm it fails, then fix, then confirm it passes.
   `backend-testing`'s "what needs a test" section: a bug fix without a
   regression test is treated as unfinished, because this project has a
   real precedent for a silently-reintroduced bug (the timezone
   comparison).
4. **Fix the root cause, not the symptom** — if the fix is "add a special
   case," step back and check whether an existing rule
   (`lifecycle.py`/`rules.py`/`booking_validation.py`) should have caught
   this generally instead.
5. **VERIFY** — `finish-task`'s check-selection table for what you
   touched.
6. **REVIEW** — `self-review`, focused on: does this fix have the same
   problem anywhere else in the codebase (grep for the same pattern), and
   does the fix itself introduce anything `self-review`'s sections flag
   (security, a new race, a timezone regression)?
7. **CHANGELOG** — `versioning`'s rule: a real behavior fix gets a
   `### Fixed` entry; a formatting/typo/non-behavioral fix doesn't.
8. **Git lifecycle** — `finish-task` Steps 6–10, same as any other change.

If root-causing surfaces that the "bug" is actually a spec gap (the
behavior was never actually specified, or two parts of the spec disagree),
switch to `c02-change.md` or a direct spec edit instead of quietly
"fixing" code against an unstated rule — record the resolution in the spec
the way `docs/evidence-and-evolution.md`'s mismatch table does.
