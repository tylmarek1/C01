# Workflow: C02 baseline (specify → build → verify → evidence)

**Triggers:** "dokonči C02," "udělej C02 baseline," "specifikuj rezervační
systém," or picking up C02 work when `docs/project-state.md` shows it
incomplete. **Not this workflow** if a baseline already exists and the ask
is to change it — that's `.claude/workflows/c02-change.md`.

**Current status:** this workflow already ran once for Courtly — read
`docs/project-state.md` first; if it says baseline v0.1/v0.2 are complete
(they are, as of this writing), you almost certainly want `c02-change.md`
or a feature/bug workflow instead, not a re-run of this one. This file
exists so the same procedure applies cleanly if a gap is ever found in the
existing baseline, or if this repository's structure is reused as a
template for a future course iteration with a different reserved resource.

This is the **full workflow** — not scoped down — because a baseline is,
by definition, the whole minimal system. Don't skip steps because a
change looks small; a baseline's job is completeness.

## Procedure

1. **Load `docs/project-state.md`.** Confirms whether a baseline already
   exists, and if so which operations/rules are already accepted vs. still
   open.
2. **Load the course specification** — `docs/course/C02.md` (and
   `docs/course/C01.md` for the domain scope it assumes is already done).
   This is the actual grading requirement; don't work from memory of it or
   from `docs/project-state.md`'s summary.
3. **Read the current implementation** — `backend/src/reservations/`
   (models, `lifecycle.py`, `rules.py`/`booking_validation.py`, `api/`) and
   the existing frontend booking flow. Don't specify from a blank slate if
   behavior already exists; the spec must describe what's really there or
   what's being deliberately changed.
4. **Determine the current state of requirements** — is there an existing
   `docs/specification*.md` to extend, or is this genuinely the first
   pass? Diff what the course requires (step 2) against what's documented
   (this step) to find gaps.
5. **Identify missing artifacts** against `docs/course/C02.md`'s own DoD
   checklist (the "Definice hotového" list at its end) — which of the 16
   items has no corresponding file/section yet?
6. **Specify all four required operations** (Create, Check Availability,
   Confirm, Cancel — `Approve` only if a change has already introduced
   it) using the `## OP-xx` template from `docs/course/C02.md` §2. Use
   `docs/specification.md`'s OP-01…OP-04 as the worked reference for the
   level of precision expected — goal, trigger, observable requirement(s),
   preconditions, postcondition, state change, referenced rules, main
   scenario, alternative/failure outcomes, verification examples,
   rationale, and an explicit assumption/TBD only where something is
   genuinely undecided.
7. **Extract shared domain rules once** — a `BR-xx` register (interval
   semantics, the exclusive-resource invariant, cancellation policy, slot
   shape, booking window, hold, per-user limits, facility blocks,
   lifecycle transitions, authorization). Don't restate a rule inside an
   operation that's already stated in the register — reference it by ID.
8. **Check state/time/concurrency/consistency semantics per requirement**
   — run the nine-question acceptance review from `docs/course/C02.md` §3
   (meaning, need, observable result, feasibility, verifiability,
   state/time, concurrency, consistency, uncertainty) against every
   accepted requirement. `docs/specification.md` §6 is the worked example
   of what the output looks like (one row per REQ).
9. **Create or update the required diagrams**: a use-case diagram (actors
   + the four/six goals, no internals), a state diagram (full
   `Reservation` lifecycle), and activity diagrams per operation. Mermaid
   in the spec markdown is the existing convention (`docs/specification.md`
   §5) — follow it rather than introducing a separate diagramming tool.
10. **Run the consistency check** from `docs/course/C02.md` §10 — Create
    vs. Confirm, Availability vs. Confirm, Cancel vs. the state diagram,
    interval-semantics wording, diagram vs. text for both diagrams,
    requirement vs. design decision (reject anything that's really an
    implementation choice, like "use PostgreSQL," masquerading as a
    requirement), and uncertainty vs. invented precision (any number with
    no source must be an explicit assumption, not silent AI-invented
    precision).
11. **Resolve every conflict found** — don't silently pick a side. State
    which source was wrong (spec, diagram, or a wrong assumption about the
    domain) and fix that source, the way
    `docs/evidence-and-evolution.md`'s "Nalezený nesoulad" table records
    each one that was found.
12. **Mark the baseline "vX.Y — schválená týmem"** in the spec file's
    header — but only when the team has actually reviewed it (see
    `docs/definition-of-done.md`'s rule on gates only a human can close);
    until then the header says "prepared for team approval," matching how
    `docs/specification.md` §0 is written right now, and the `§11`
    checkbox table stays unticked.
13. **Implement the parts needed** to make the running app match the
    baseline — `feature-development`'s Step 4 (product quality as
    first-class) for the vertical slice, `api-design`/`backend-testing`
    for the backend shape, `component-design`/`api-integration` for any
    frontend surface. Architecture can stay simple here (C03's job, not
    this one) — don't over-design the implementation to anticipate C03.
14. **Run positive and negative/boundary verification for every
    operation** — at least one success case and one relevant
    rejection/boundary case per operation, executed for real (a passing
    test or a live run transcript), not asserted from reading the code.
15. **Write the evidence** into `docs/evidence-and-evolution.md`, using the
    "Evidence C02" template from `docs/course/C02.md` §15 (accepted
    baseline, operations demonstrated, verification examples actually run,
    mismatches found and how resolved, change-impact summary, remaining
    assumptions/unknowns, architectural drivers for C03, commit/tag).
16. **Update `docs/project-state.md`** — move newly-closed items from
    "pending" to "completed gates" with an evidence pointer each; if the
    approval gate is still open, say so explicitly rather than omitting
    it.
17. **Run the final gate check** — walk `docs/course/C02.md`'s own DoD
    checklist item by item and record each as DONE-with-evidence or
    NOT-DONE-with-reason in `docs/project-state.md`, per
    `docs/definition-of-done.md`. Then `finish-task` for the mechanical
    verification (tests/build) and `self-review` before reporting.
