---
name: component-design
description: Where new UI belongs on Courtly's frontend (shared vs page-local), how to follow the existing shadcn-style component pattern, and the design-token discipline from the repo-root DESIGN.md ("Clubhouse programme"). Use before creating any new component or styling a new piece of UI.
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
  app's tokens or its custom variants (e.g. `Button`'s `brand`/`subtle`/
  `destructive-ghost` variants), so it always needs that adaptation pass, never a raw drop-in.
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
the design added (e.g. `Button`'s `brand` variant, its `isLoading` prop), and any
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

## Design tokens — DESIGN.md is the source

`DESIGN.md` (repo root) defines the system and `frontend/src/index.css` the
tokens: a base `--c-*` palette (redefined under `.dark`) mapped onto
semantic tokens (`--background`, `--card`, `--primary`, `--brand`,
`--success`/`--success-soft`, …) exposed as Tailwind classes via
`@theme inline`.

- **Never hardcode a hex/rgb colour or a raw Tailwind palette colour** in a
  component — use the semantic classes. Raw colours don't follow dark mode.
- A genuinely new token goes in `index.css` as a `--c-*` base value in both
  `:root` and `.dark`, mapped to a semantic name — then documented in
  `DESIGN.md` §3. Don't invent a one-off "close enough" colour.
- Respect the system's rules while composing: one `brand` action per view,
  borders separate / shadows lift, mono + `tabular` for times and numbers,
  every query state (loading/empty/error) designed with the shared
  `Skeleton`/`EmptyState`/`ErrorState`.

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
- **No shared table primitive yet.** The admin Reservations tab
  (`pages/app/admin/ReservationsTab.tsx`) uses a semantic `<table>` on
  `md+` with stacked cards on mobile; the Users tab uses a CSS-grid list
  with the same look. Follow that shape (DESIGN.md §5 "Tables"); if a third
  table appears, that's the signal to extract a `components/shared/` table
  primitive (see `architecture-review`'s "evidence before abstraction").
- **`components/shared/player-search.tsx` is the pattern for "type a query,
  pick a person from a list."** It renders results in normal document flow
  directly under the input — never a floating `position: absolute`/
  portaled overlay. That's deliberate, not an oversight: a floating overlay
  breaks two different ways as soon as it's opened from inside a `Dialog`
  (and this component is used from two) — `DialogContent`'s
  `overflow-y-auto` treats an absolutely-positioned child as extra
  *scrollable* height instead of showing it as a layer over the content,
  and escaping that via a portal to `document.body` runs into Radix
  `Dialog`'s own modality guard, which marks everything outside its own
  portal `inert` (unclickable) while open — including a separate portal.
  Follow this component's in-flow-list shape for a new "search and pick"
  UI rather than reaching for a floating-dropdown/combobox pattern,
  especially one that might ever render inside a `Dialog`.

## Before finishing

Any new user-facing text in the component goes through `t()` — see
`i18n-check`. Any data the component displays that comes from the backend
goes through `api-integration`'s pattern, not a raw `fetch()`.
