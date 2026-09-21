# Workflow: improve the app

**Triggers:** "vylepši aplikaci," "improve the app," "make this more
professional," "find weaknesses," "clean up the backend/frontend."

This is a thin router — the actual competency is the `improve-app`
**skill**, which already has both an audit mode and an "act on it" mode.
This file exists so the routing itself is explicit: a whole-app
improvement request is not the same shape as `feature.md` (one capability)
or `bug-fix.md` (one known defect), and it must not end in a list nobody
acts on.

## Procedure

1. **Run `improve-app` Mode A** — the full inspection across product,
   backend, frontend, engineering. Ground every finding in a real
   file/location; no generic advice.
2. **Determine which kind of request this was**, per the skill's own
   distinction:
   - "what should we add" / "find weaknesses" → the audit *is* the
     deliverable. Report it, categorized by impact/effort/risk, and stop.
   - "improve the app" / "make this more professional" (action-oriented)
     → continue to step 3. **Don't stop at a list of 30 problems for an
     action-oriented request** — that's the one failure mode this
     workflow exists to prevent.
3. **Select a bounded, coherent scope** from the findings —
   `improve-app`'s own selection rule (impact/frequency/severity/
   correctness/security first, then architecture/performance/
   maintainability, weighed against effort and risk). State which findings
   are in scope and which are being left as reported-only, and why.
4. **Implement the selected scope** through the workflow that actually
   fits each finding — `feature.md` for a missing capability,
   `bug-fix.md` for an actual defect, `refactoring`/`polish` (skills) for
   restructuring or UX elevation. Don't hand-implement outside those.
5. **VERIFY and REVIEW** — `finish-task` and `self-review` on the
   implemented scope before reporting done.
6. **Report** using `improve-app`'s own format for anything not
   implemented, plus what was actually changed and verified for what was.
