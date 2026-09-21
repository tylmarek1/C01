---
name: accessibility-responsive
description: Manual verification checklist for accessibility, responsiveness, and loading/empty/error states on Courtly's frontend — there is no automated frontend test suite, so this is how UI changes actually get checked. Use before finishing any change that adds or meaningfully changes UI, especially anything touching layout, forms, or role-gated views.
---

# Accessibility, responsiveness, and UI states — manual verification

No vitest/jest/testing-library exists in this codebase (confirmed: zero
`*.test.*` files, no test dependency in `package.json`). This is the actual
verification step for UI work until that changes — not a placeholder for
"tests should cover this." **Source that looks correct on read-through but
renders poorly is not finished** — reading the JSX is not a substitute for
looking at the rendered page for any change non-trivial enough to have a
visual or interactive effect.

## Run it for real

```bash
cd frontend && npm run dev
```
Then actually exercise the changed page in a browser. `claude-in-chrome` may
not be available in background/subagent sessions — if it isn't connected,
installing Playwright into a throwaway scratch directory and driving the
dev server's URL with a short script is an acceptable fallback (see
`frontend/CLAUDE.md`'s testing section).

## Checklist

**Accessibility**
- Interactive elements have an accessible name (`aria-label` where the
  visible text doesn't already say it — check existing usages in
  `components/shared/` like `navbar.tsx`'s icon buttons for the pattern).
- Form inputs have an associated `label.tsx` component, not a bare
  placeholder standing in for a label.
- Touch targets are reasonably sized (roughly 44px) on interactive elements,
  especially in `navbar.tsx`/mobile nav and any new mobile-specific UI.
- Focus states aren't removed — don't add `outline-none` without a visible
  replacement focus style.

**Responsiveness**
- Check at least a narrow (mobile) and a wide (desktop) viewport — this
  app has a mobile hamburger nav and card/grid layouts that reflow; a new
  page/component should be checked at both, not just the width you happened
  to develop at.
- No horizontal overflow/clipping at narrow widths.

**Loading / empty / error states**
- Loading: does the UI show a `skeleton.tsx`-style placeholder or spinner
  rather than a blank flash while a query is pending?
- Empty: does a list/collection show a real empty state (not just nothing)
  when there's no data yet — check an existing page's empty-state copy for
  the tone to match?
- Error: does a failed query/mutation show something visible (see
  `api-integration`'s error-handling section), not a silent no-op?

**Role-gated UI**
- If the change touches anything gated by role (player vs. venue manager),
  check it as both — a manager-only control that's supposed to be hidden
  for a player, and vice versa.

**i18n**
- Toggle the language switcher and glance at the page in both EN and CS —
  see `i18n-check` for the full check.

**Console**
- Check the browser console for errors/warnings introduced by the change.

## What this checklist is not

It's not a reason to build a full automated visual-regression or a11y-audit
pipeline for a course project at this scale — if a genuinely recurring pain
point emerges (e.g. this manual pass keeps missing the same class of bug),
flag introducing `vitest`/`@testing-library/react` via `improve-app` as a
concrete, justified proposal rather than adding test infrastructure
speculatively.
