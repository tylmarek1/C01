---
name: component-design
description: Where new UI belongs on Courtly's frontend (shared vs page-local), how to follow the existing shadcn-style component pattern, and the design-token discipline for the "navy ink on cool marble" palette. Use before creating any new component or styling a new piece of UI.
---

# Component design (frontend)

## Where does this UI belong?

- Check `frontend/src/components/shared/index.ts` first — a
  button/card/badge/dialog/tabs/select/avatar/skeleton primitive very likely
  already exists. Don't create a second version because it was faster than
  finding the existing one.
- **Genuinely reusable** UI (usable by more than one page, or a natural
  primitive like the existing `star-rating.tsx`/`stat-tile.tsx`) goes in
  `components/shared/`, added to `index.ts`'s exports alongside the others.
- **Page-specific composition** goes in `pages/<area>/` — don't promote
  something to `shared/` speculatively "in case it's reused later"; wait
  until a second real call site exists (see `architecture-review`,
  project-wide, on abstractions without evidence).
- Follow the existing composite-component precedent
  (`week-calendar.tsx`, `reservation-detail-dialog.tsx`) for anything
  non-trivial: a real, self-contained component with its own file, not
  logic inlined into a page.

## Follow the existing pattern for a new primitive

Look at an existing `components/shared/*.tsx` file matching the kind of
thing you're building (e.g. `badge.tsx` for a new small stateless display
primitive, `dialog.tsx` for a new modal) and match its shape: Radix
primitive underneath where one exists, `class-variance-authority` (`cva`)
for variants, `clsx`/`tailwind-merge` for combining classes — this is the
shadcn-style pattern already used throughout, don't introduce a different
component-authoring style.

## Design tokens — extend, don't redesign

`frontend/src/index.css` defines the "navy ink on cool marble" palette
(`--ink-navy`, `--signal-blue`, `--slate-gray`, `--mist-gray`, `--cloud`,
...) mapped onto shadcn semantic tokens (`--primary`, `--background`, etc.).
This is a finished, deliberate design decision:

- **Never hardcode a hex/rgb color** in a component — use the Tailwind
  classes derived from the existing tokens (`bg-primary`,
  `text-muted-foreground`, etc.), or the CSS variables directly if no
  Tailwind class covers it.
- If a genuinely new token is needed, add it to `index.css` next to the
  existing ones and derive a semantic variable from it — don't invent an
  inline one-off color, even a "close enough" existing brand color typed by
  hand.
- Check a rendered page (or at least the token file) before assuming a
  color doesn't already exist as a token — this palette is more complete
  than a first guess might assume.

## Two primitives that don't exist yet — decide deliberately, don't assume

- **No shared confirm-dialog/destructive-action primitive.** Cancel/confirm
  actions (e.g. in `AdminPage.tsx`) currently fire their mutation directly,
  with no "are you sure?" step. If you're adding a new destructive action,
  build a small confirm step on top of the existing `dialog.tsx` rather
  than skipping confirmation or writing a third one-off version if this has
  already been done once elsewhere by the time you're reading this — check
  first.
- **No shared table primitive.** Tabular/grid data (e.g. `AdminPage.tsx`'s
  listings) is laid out with ad hoc CSS grid, not a reusable component. A
  new feature with list/table data can follow that same ad hoc grid
  approach for consistency, or — if this is the second or third time it's
  needed — that's the signal to extract a real `components/shared/` table
  primitive instead of a fourth ad hoc grid (see `architecture-review`'s
  "evidence before abstraction" rule).

## Before finishing

Any new user-facing text in the component goes through `t()` — see
`i18n-check`. Any data the component displays that comes from the backend
goes through `api-integration`'s pattern, not a raw `fetch()`.
