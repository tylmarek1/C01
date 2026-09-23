---
name: component-design
description: Where new UI belongs on Courtly's frontend (shared vs page-local), how to follow the existing shadcn-style component pattern, and the design-token discipline for the "navy ink on cool marble" palette. Use before creating any new component or styling a new piece of UI.
---

# Component design (frontend)

## Where does this UI belong?

- Check `frontend/src/components/ui/` (shadcn/ui primitives: button, card,
  badge, dialog, tabs, select, avatar, skeleton, ...) and
  `frontend/src/components/shared/index.ts` (composite, app-specific pieces)
  first — the thing you need very likely already exists in one of the two.
  Don't create a second version because it was faster than finding the
  existing one.
- **A base primitive that shadcn/ui's registry provides** (see
  `ui.shadcn.com/docs/components` for the catalog) belongs in
  `components/ui/`, added via `npx shadcn add <name>` from `frontend/` —
  don't hand-roll a Radix wrapper the registry already has. After adding,
  re-apply this app's variant/token deltas the same way the existing files
  in `components/ui/` do (see "Follow the existing pattern" below) —
  the raw CLI output uses shadcn's generic neutral-gray theme, not this
  app's navy palette or its custom variants (e.g. `Button`'s `dark`
  variant), so it always needs that adaptation pass, never a raw drop-in.
- **Genuinely reusable, app-specific** UI (usable by more than one page, not
  a shadcn/ui catalog primitive, or a natural composite like the existing
  `star-rating.tsx`/`stat-tile.tsx`) goes in `components/shared/`, added to
  `index.ts`'s exports alongside the others.
- **Page-specific composition** goes in `pages/<area>/` — don't promote
  something to `shared/` speculatively "in case it's reused later"; wait
  until a second real call site exists (see `architecture-review`,
  project-wide, on abstractions without evidence).
- Follow the existing composite-component precedent
  (`week-calendar.tsx`, `reservation-detail-dialog.tsx`) for anything
  non-trivial: a real, self-contained component with its own file, not
  logic inlined into a page.

## Follow the existing pattern for a new primitive

For a `components/ui/` primitive: run `npx shadcn add <name>` (from
`frontend/`), then diff the result against a sibling file already in
`components/ui/` (e.g. `button.tsx`, `select.tsx`) and port forward the same
kind of deltas they already carry — this app's Tailwind classes/tokens in
place of the registry's default neutral-gray ones, any app-specific variant
the old design added (e.g. `Button`'s `dark` variant), and any
previously-fixed bug that lives in a comment (e.g. `tabs.tsx`'s
`overflow-x-auto` fix) — while keeping the registry version's structure,
new sub-components, and accessibility improvements. Never commit the raw
CLI output unmodified. The app also uses the unified `radix-ui` package
(not per-primitive `@radix-ui/react-*` packages) and imports `cn` from
`@/lib/utils` (not the `cn` npm package) — rewrite both on every fresh
`add`, the registry defaults to the opposite of each.

For a `components/shared/` composite: look at an existing file matching the
kind of thing you're building and match its shape — built from
`components/ui/` primitives, `class-variance-authority` (`cva`) for
variants, `clsx`/`tailwind-merge` for combining classes.

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

## One primitive that exists, one that doesn't — decide deliberately, don't assume

- **`components/shared/confirm-dialog.tsx` is the shared confirm-dialog
  primitive** — a thin wrapper over `dialog.tsx` taking `title`,
  `description`, `confirmLabel`, `destructive`, `isLoading`, `onConfirm`.
  It's wired into cancel-reservation (player + admin), remove-guest,
  delete-review, and delete-facility-block. Use it for any new destructive
  or hard-to-undo action instead of firing the mutation straight from the
  triggering button's `onClick` — don't write a second one-off version.
  Give the confirm button a label distinct from the dismiss button's
  "Cancel" (e.g. "Yes, cancel it", not a second "Cancel") so the two aren't
  visually identical.
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
