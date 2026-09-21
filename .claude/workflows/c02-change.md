# Workflow: C02-style change (impact analysis first, then baseline bump)

**Triggers:** "implementuj change z C02," "oprav/uprav specifikaci kvůli
X," a course-driven requirement change, or any future change to accepted
behavior that should go through impact analysis before code — not a bug
fix (behavior was wrong relative to its own spec — see `bug-fix.md`) and
not a new capability with no existing baseline conflict (see `feature.md`
via `.claude/workflows/feature.md`, which routes to the
`feature-development` skill).

This workflow is not one-shot — it already ran once for the "approval
process" change (`docs/change-c02-impact.md` + `docs/specification.md`
v0.2 are its output) and is written to run again for any future change of
the same shape (course-assigned or not). The C02 assignment's own
structure is: **v0.1 → change request → impact analysis → decision → v0.2
→ implementation → verification → evidence → consistency check → gate.**
Follow that order — impact analysis before any edit to the spec, spec
before any edit to code.

## Procedure

1. **State the change card precisely.** One or two sentences: what
   condition changes, in the same shape as `docs/course/C02.md` §12 ("Some
   Resources require approval by an authorised person before a Reservation
   can become CONFIRMED..."). If the change comes from the course
   assignment, quote it from `docs/course/C0N.md` rather than
   paraphrasing.
2. **Load `docs/project-state.md` and the current
   `docs/specification.md`** — impact analysis is meaningless without
   knowing the baseline you're changing.
3. **Impact analysis — nothing gets edited yet.** Answer explicitly for
   each area, the way `docs/change-c02-impact.md` §2 does (use it as the
   worked template):
   - **Create** — does it change, or still just produce the initial
     hold/draft state?
   - **Check Availability** — does the new condition change what counts
     as blocking? Why?
   - **Confirm** — still one immediate operation, or does it split?
   - **Approve** (or whatever new decision point the change introduces)
     — new actor goal / new operation? Who may perform it?
   - **Cancel** — does the new state introduced by the change interact
     with cancellation?
   - **State diagram** — new states needed, or does an existing state's
     meaning widen?
   - **Use-case diagram** — new actor, or new goal for an existing actor?
   - **Verification** — how will the new behavior (delay, rejection,
     expiry, or whatever the change introduces) actually be verified?
   - **Architecture** — does this need a new architectural driver
     (persistence, async process, timer, external boundary)? Record it,
     don't solve it now (C03's job — see root `CLAUDE.md`'s
     "Cross-cutting architectural rules" / C01–C03 boundary).
   If an area is **genuinely unaffected**, say so explicitly and why —
   `docs/change-c02-impact.md` §4's "Unaffected requirements" block is the
   template; an area silently skipped is indistinguishable from one nobody
   checked.
4. **Trace every path to the changed outcome**, not just the obvious
   entry point. The approval-process change found three extra paths to
   `CONFIRMED` (waitlist accept, reschedule, manager-on-behalf confirm) by
   grepping every place that could set the target state —
   `docs/change-c02-impact.md` §3 is the worked example. Do the equivalent
   grep for whatever state/outcome this change targets before assuming the
   obvious operation is the only door.
5. **Decide, and write the decisions down** — one row per real decision
   with the rejected alternative and why (`docs/specification.md` §8's
   `D-xx` table is the pattern). A decision without a rejected alternative
   recorded is probably an unexamined default, not a considered choice.
6. **Write the impact analysis to its own file** (following
   `docs/change-c02-impact.md`'s shape: change card → area-by-area impact
   → what else it touches → architectural drivers → the consolidated
   "Dopad změny" summary block) **before** touching the specification —
   the point of this order is that the analysis can be reviewed
   independently of the edit it justifies.
7. **Update the specification to the next baseline version** — edit only
   the requirements/rules/diagrams the impact analysis identified as
   affected; mark each changed part `*Changed*`/`*New*` and explicitly
   confirm unchanged parts stay `*Unchanged*`, the way `docs/
   specification.md` marks every section relative to v0.1. If the change
   introduces a new operation, give it the full `OP-xx` template — same
   discipline as a baseline (see `c02-baseline.md` step 6).
8. **Re-run the consistency check** (`c02-baseline.md` step 10) against
   the *updated* spec — a change can introduce the same class of
   inconsistency a first-draft baseline can.
9. **Implement the change** — `feature-development`'s Step 4 discipline
   for the vertical slice; `schema-change-sweep` if the change adds/renames
   a model or schema field; `database-evolution` if it needs the manual
   schema-recreation cycle (a new state/enum value almost always does —
   see backend `CLAUDE.md`'s "No Alembic" trap). Update the exclusion
   constraint's blocking-state list if the change adds a state that should
   still hold the resource — this codebase has a regression test for
   exactly that drift (`test_the_exclusion_constraint_blocks_exactly_the_
   active_statuses`); don't add a new blocking state without it.
10. **Verify the changed behavior specifically** — new verification
    examples for the new/changed requirements, run for real (test or live
    transcript), plus a re-run of the *unaffected* operations' existing
    tests to confirm nothing regressed silently.
11. **Write evidence** — append to `docs/evidence-and-evolution.md` using
    the same "Evidence" template as a baseline (`c02-baseline.md` step 15),
    but scoped to what the change actually touched; don't re-litigate
    already-evidenced unaffected behavior.
12. **Update `docs/project-state.md`** — new baseline version, updated
    completed/pending gates, any new architectural drivers appended (don't
    overwrite the existing AD-1…AD-6 list, append to it).
13. **Gate check** — same discipline as `c02-baseline.md` step 17: walk
    whatever DoD applies (the course's, if this is a course-assigned
    change; the feature's own acceptance criteria otherwise) and record
    DONE/NOT-DONE with evidence, not a summary judgment.
