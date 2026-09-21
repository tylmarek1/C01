---
name: refactoring
description: Rules for controlled refactoring on Courtly (C01) — when "refactor X" or incidental cleanup during a feature is warranted versus scope creep. Use whenever a request asks to refactor/clean up/restructure existing code, or when feature work tempts you into touching unrelated code.
---

# Controlled refactoring

The shape: **understand → isolate → refactor → verify → extend.** Understand
why the current structure is a problem (not just that it looks inelegant),
isolate the piece being restructured so the change is reviewable on its
own, refactor with behavior held constant, verify against a test that
covers the old behavior, then extend with the new capability that motivated
the refactor in the first place — don't skip straight from "understand" to
"rewrite everything."

## Rules

- **Don't refactor unrelated code during feature work without a reason.** A
  request to add a feature is not an invitation to restyle a file you
  happened to open. If something genuinely needs fixing while you're there,
  flag it via `improve-app`'s classification, don't fold it into the diff
  silently.
- **Prefer incremental refactors** over a single sweeping rewrite — a
  refactor that's hard to review in one pass is a refactor that's hard to
  verify preserved behavior.
- **Preserve behavior.** A refactor changes structure, not outcomes. If a
  "refactor" request also wants behavior to change, that's a
  `feature-development` task wearing a refactor's name — treat it as one
  (impact-map it, don't just restructure).
- **Verify before, not just after.** Before a risky refactor (touching
  `lifecycle.py`, `rules.py`, the exclusion constraint, or auth), confirm
  there's a test covering the current behavior. If there isn't, add one
  first so the refactor has something to prove it didn't change behavior.
- **Keep diffs understandable.** A rename-plus-restructure-plus-behavior-
  tweak in one diff is unreviewable. Separate mechanical changes (renames,
  moves) from logic changes where practical.
- **Don't introduce an abstraction without evidence it's needed.** Two
  similar-looking pieces of code are not automatically a duplication
  problem — three genuinely identical, independently-changing call sites
  are a much stronger signal than two. `architecture-review` has the fuller
  version of this judgment call.

## When a refactor touches shared/renamed identifiers

Use `schema-change-sweep` for any refactor that renames or reshapes a
model/schema/type — the grep-based impact sweep is exactly for this, since
nothing in this stack (no Alembic, no generated types) will catch a missed
call site for you.

## After a structural refactor of a module with many consumers

`lifecycle.py`, `rules.py`, and anything `api/reservations.py` depends on
have many call sites across both stacks. After restructuring one of these,
run `feature-completeness` on the affected feature area — it traces
consumers a diff-only review can miss, which is exactly the risk a
behavior-preserving refactor is supposed to avoid introducing.

## Reporting

State what was restructured and why, and explicitly confirm what you
checked to verify behavior didn't change (which tests, or what manual
verification, per `finish-task`).
