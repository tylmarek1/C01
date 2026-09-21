# Workflow: feature (add/change capability)

**Triggers:** "přidej notifikace," "add X," "improve reservations," any
request to add or meaningfully change functionality that isn't a bug fix,
a pure refactor, or a course-phase request (`c01.md`/`c02-baseline.md`/
`c02-change.md` own those instead — check `docs/project-state.md`'s
current phase first if it's unclear which this is).

This is the entry point; the actual competency lives in the
`feature-development` **skill** — this file is the routing decision plus
the generic engineering loop it's an instance of, not a duplicate of its
steps.

## The general loop, scoped to what the change needs

```
UNDERSTAND → INSPECT → PLAN → CHANGE → VERIFY → REVIEW → DOCUMENT → UPDATE STATE
```

Every change runs through *some* of this; almost nothing runs through all
of it mechanically. `feature-development`'s Step 0 classification table
**is** the scoping decision for this loop — read it first. As a rule of
thumb mapped onto the loop above:

| Scope | Loop stages that actually apply |
|---|---|
| One-line/UI-only tweak | INSPECT → CHANGE → VERIFY |
| API-only, same data shape | INSPECT → CHANGE → VERIFY → REVIEW |
| Full-stack feature | the whole loop |
| Database change | UNDERSTAND (`database-evolution` first) → PLAN → CHANGE → VERIFY → REVIEW → DOCUMENT → UPDATE STATE |

## Procedure

1. **Classify** using `feature-development`'s Step 0 table. This decides
   which skills activate — don't run every skill regardless of fit.
2. **UNDERSTAND / INSPECT** — `feature-development` Step 1: grep for an
   existing analog, check `docs/intent-and-change.md` and
   `docs/specification.md` for whether the concept already exists, decide
   what's inferable from the codebase vs. what's a genuine product
   decision (Step 1's two worked examples show the line).
3. **PLAN** — `feature-development` Step 2 (impact map across
   database/backend/frontend/i18n/auth/tests/docs) and Step 3
   (`architecture-review` — does this belong in an existing module?).
   Branch off `main` before touching files (root `CLAUDE.md`'s Git
   workflow).
4. **CHANGE** — `feature-development` Step 4: implement the full vertical
   slice, product quality first-class (loading/empty/error states,
   confirm-dialog for destructive actions, i18n from the start, reused
   design tokens) — not the happy path with polish deferred.
5. **VERIFY** — `finish-task`, which picks the checks matching what you
   actually touched.
6. **REVIEW** — `self-review`, `feature-completeness`, `consistency` (all
   three, per `feature-development` Step 6) — fix anything found within
   scope before reporting done, per root `CLAUDE.md`'s "fix within scope"
   rule.
7. **DOCUMENT** — `update-docs` if a README/doc claim is now wrong;
   `versioning` for the `CHANGELOG.md` entry, if the change is
   user/developer-visible.
8. **UPDATE STATE** — if the change closes or opens a gate tracked in
   `docs/project-state.md` (rare for an ordinary feature — mostly relevant
   when a feature happens to close an item from a course DoD, or
   introduces a new architectural driver worth recording), update it. Most
   features don't touch `docs/project-state.md` at all — don't force an
   update that has nothing real to say.
9. **Flag, don't chase, further improvement** — `feature-development`
   Step 7's classification (required now / valuable-but-separate / future
   idea / overengineering).
10. **Git lifecycle** — `finish-task` Steps 6–10 (branch check → commit →
    push → PR → merge → cleanup), per root `CLAUDE.md`'s default Git
    workflow.
