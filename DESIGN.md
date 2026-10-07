# Courtly design system — "court-side precision"

The rules every UI change on `frontend/` follows. Tokens live in
`frontend/src/index.css`; primitives in `frontend/src/components/ui/`;
app composites in `frontend/src/components/shared/`. This file explains
*why* they look the way they do and *how* to use them — it is not a second
copy of the token values (read `index.css` for those).

## 1. Direction

Courtly should feel like a **precise instrument for booking time on a
court** — calm, fast, legible, with one confident sporty accent. Not a
generic "AI dashboard", not a marketing template.

The direction was synthesised from the [Refero Styles](https://styles.refero.design/)
library (Refero's Screens/Flows are login-gated, so Styles was the usable
source) — taking a principle from each, copying none:

| Source | What we took |
|---|---|
| **Linear** | Precision typography: tight negative tracking on headings, no 700+ weights in the app UI, one primary action per view, 12–14px card radii, compact 4px grid. |
| **Ramp** | Border-first elevation (hairlines separate, shadows are rare), one chromatic accent reserved for the primary action and live/active state, uppercase micro-labels. |
| **Wise** | Soft tinted "wash" surfaces for highlights and status, pill-segmented controls, ink instead of pure black. |
| **Vercel** | Monospace for data that is *read like data* — times, counters, IDs, eyebrows — and ring-style depth instead of drop shadows. |

The accent is **optic** — the yellow-green of a tennis ball — on a chalk
canvas with ink type. It is the brand: it appears on the primary booking
action, active navigation, "live" indicators and unread counts. Everything
else is neutral.

## 2. Principles

1. **Hierarchy through type and space, not colour.** Size, weight and
   tracking carry hierarchy; colour is reserved for meaning (brand action,
   status).
2. **One brand action per view.** `Button variant="brand"` is the one thing
   we want you to do here (book, confirm, reserve). Everything else is ink
   (`default`), `outline`, or `ghost`. On desktop the sidebar's "Book a
   court" is that action, so pages don't repeat it in their header (`lg:hidden`).
3. **Borders separate, shadows lift.** Cards sit on the canvas with a
   hairline and at most `shadow-xs`. Only things that genuinely float
   (popovers, dialogs, sheets, toasts, the booking summary) get `shadow-md`/`lg`.
4. **Data looks like data.** Times, durations, prices, counts and dates in
   lists use `font-mono` + `tabular`; they never jitter as values change.
5. **Every state is designed.** No view ships without loading (skeleton in
   the content's shape), empty (says why + what to do next), and error
   (says it failed + retry) states.
6. **Tell people what happens next.** Holds show a live countdown, approvals
   show their deadline, taken slots offer the waitlist, destructive actions
   name what they destroy.
7. **Motion explains, never decorates.** Short (120–320ms), ease-out,
   opacity/translate/scale only, and disabled under `prefers-reduced-motion`.

## 3. Tokens

Use the **semantic** Tailwind classes. Never a hex value, never a raw
Tailwind palette colour (`bg-amber-50`, `text-red-600`…) — those don't
follow dark mode. Only the base palette (`--c-*`) is redefined under
`.dark`; every semantic token re-themes automatically.

### Colour roles

| Role | Classes | Use for |
|---|---|---|
| Canvas | `bg-background` | Page background. |
| Surface | `bg-card`, `bg-popover` | Cards, menus, dialogs. |
| Wash | `bg-muted`, `bg-wash-strong` | Inset areas, hover fills, tracks, chips. |
| Ink | `text-foreground` | Primary text. |
| Muted / subtle text | `text-muted-foreground`, `text-subtle-foreground` | Secondary copy / placeholders, metadata. |
| Lines | `border-border`, `border-border-strong`, `border-input` | Hairlines; stronger for inputs and hover. |
| Primary (ink) | `bg-primary text-primary-foreground` | Default strong button, selected chips, active segments. Inverts in dark mode. |
| Brand (optic) | `bg-brand text-brand-foreground`, `bg-brand-soft`, `text-brand-ink` | THE action, active nav marker, live dots, unread badges. `brand-ink` is the text-safe green for brand-coloured text on light surfaces. |
| Status | `text-success` + `bg-success-soft`, same for `warning`, `danger`, `info` | Always as a pair, always with an icon or label too. |
| Panel | `bg-panel text-panel-foreground` | The always-dark ink panel (auth art, CTA band, profile cover). |
| Data viz | `bg-chart-1`, `bg-chart-track`, `bg-heat` | Charts only (§7). |
| Star | `fill-star text-star` | Rating stars only. |

Reservation statuses map to tones in `lib/reservation-status.ts`
(`STATUS_VARIANT`) — render them with `<StatusBadge>` so the mapping lives
in one place.

**Exceptions** (deliberately raw): the photo scrim `from-black/25` on top of
court photos, and the lightbox/hero product mock, which is decorative.

### Typography

- **Geist** (UI) and **Geist Mono** (data), loaded in `index.html`.
- Body 15px/1.5. App UI text is 13–14px; labels 13px medium.
- Headings: `font-semibold` with negative tracking — page title 24–28px
  (`tracking-[-0.025em]`), section 15–17px (`tracking-[-0.01em]`), marketing
  display 44–72px (`tracking-[-0.035em…-0.045em]`).
- `.eyebrow` utility: 11px mono uppercase, 0.06em tracking — kickers, table
  heads, group labels.
- `.tabular` for every number that can change.

### Spacing, radius, elevation, motion

- 4px grid. Page gutters 16/24/32px (`PageContainer`). Card padding 20–24px.
  Section gap 32–40px inside the app, 64–96px on marketing pages.
- Radius: `rounded-xs` 6 (badges) · `rounded-sm` 8 (small buttons, menu
  items) · `rounded-md` 10 (buttons, inputs) · `rounded-lg` 12 · `rounded-xl`
  14 (cards) · `rounded-2xl` 20 (heroes, dialogs, sheets). Pills only for
  chips, filters and avatars.
- Shadows: `shadow-xs` (resting cards/buttons) → `shadow-sm` → `shadow-md`
  (hover lift, floating cards) → `shadow-lg` (dialogs, popovers, toasts).
- Motion utilities in `index.css`: `animate-fade-up`, `animate-fade-in`,
  `animate-scale-in`, `animate-shimmer` (skeletons), `.stagger` (list entrance,
  set `--i` per child), `.surface-interactive` (hover lift for clickable cards),
  `grow-x`/`grow-y` keyframes for chart bars.

## 4. Components

Always reach for these before writing markup. Primitives (`components/ui/`):

| Primitive | Notes |
|---|---|
| `Button` | Variants `default` (ink) · `brand` · `secondary` · `outline` · `ghost` · `subtle` · `link` · `destructive` · `destructive-ghost`; sizes `xs/sm/default/lg/xl/icon*`. `isLoading` shows a spinner and disables. Icon-only buttons need `aria-label` (and usually a `Tooltip`). |
| `Badge` | Tones `default/secondary/outline/brand/solid/success/warning/destructive/info`, optional `dot`. |
| `Card` | Hairline surface; `interactive` for clickable cards. |
| `Input`, `Textarea`, `Select`, `Switch`, `Label` | Share `field-styles.ts`; focus is a soft ring, invalid is `aria-invalid`. |
| `Tabs` | `variant="segmented"` for switching views of the same data; `variant="line"` for page-level sections. Drive the value from the URL (`?tab=`, `?view=`) so it is linkable. |
| `Dialog` / `SheetContent` | Dialog for focused tasks (becomes a bottom sheet on mobile); Sheet (side panel) for a detail view that keeps its list in context. |
| `DropdownMenu`, `Popover`, `Tooltip` | Overflow actions, light panels, label for icon-only controls. |
| `Skeleton`, `Progress`, `Kbd`, `Avatar`, `Separator` | — |

App composites (`components/shared/`, exported from `index.ts`):

- **Shell**: `AppShellLayout`/`AdaptiveLayout` (sidebar app shell; court
  browsing adapts to signed-in state), `AppSidebar`, `UserMenu`,
  `CommandMenu` (⌘K), `NotificationsBell`, marketing `Navbar`/`Footer`.
- **Page anatomy**: `PageContainer` + `PageHeader` (eyebrow, title,
  description, actions, back link) for every app page; `SubsectionHeading`
  for blocks inside a page; `SectionHeader` + `MarketingSection`,
  `FaqList`, `CtaBand` for marketing pages.
- **States**: `EmptyState` (icon, title, why, next action; `size="compact"`
  inside cards), `ErrorState` (with retry), `Skeleton` shaped like content.
- **Data**: `StatTile` (KPI), `StatusBadge`, `Countdown` (live, calls
  `onExpire`), `UserAvatar` (the only avatar — never hand-roll initials),
  `FilterChip`, `SearchInput`, `SportPicker`, charts (`ColumnChart`,
  `BarList`, `Heatmap`).
- **Domain**: `CourtCard` (showcase / compact link / selectable row),
  `CourtArt`, `ReservationCard` (+ `DateBlock`), `ReservationDetailDialog`
  (sheet) + `ReservationTimeline`, `DayStrip` + `SlotGrid` (booking picker),
  `OccupancyTimeline`, `WeekCalendar`, `PlayerSearch`, `ActivityFeedItem`,
  `StarRating(Input)`, `ConfirmDialog` (the only destructive confirmation).

## 5. Patterns

- **Page anatomy (app)**: `PageContainer` → `PageHeader` → content. Main
  content left, a 320–340px context column right on `lg+`.
- **Lists of things that happen at a time** are grouped by day with a sticky
  `.eyebrow` day header (`groupByDay`, `fmt.dayLabel`), and lead with a
  `DateBlock`.
- **One primary action per row**; secondary actions go in a `⋯`
  `DropdownMenu`, destructive ones last, separated, `variant="destructive"`,
  always through `ConfirmDialog` with copy that names the object.
- **Tables** (admin): real `<table>` on `md+`, stacked cards on mobile, a
  search + `FilterChip` toolbar with live counts above, "Showing X of Y"
  + "Load more" below.
- **Forms**: label above field, inline validation under it (`text-danger`),
  submit disabled until valid, server errors shown inline (auth) or as a
  toast with the backend's message (`ApiError`).
- **Toasts** (bottom-right) confirm an action and name the object
  ("Tennis Court 1 saved to favorites"). Never the only place an error
  that blocks a form is shown.
- **Time and locale**: every date/time/number goes through
  `useFormatters()` (`lib/format.ts`), which follows the UI language. Never
  `toLocaleString()` or a hardcoded `"en-GB"` formatter. "Now" in render
  comes from `useNow()` (`lib/use-now.ts`), not `Date.now()`.
- **Business rules in the UI are hints only.** `lib/slots.ts` mirrors
  lead time / advance window to disable slots early; the backend is the
  enforcement (root `CLAUDE.md` pitfall #3).

## 6. Responsive

Designed mobile-first at 390px and checked at 768 / 1024 / 1440.
Below `lg` the sidebar becomes a left sheet behind a top bar; dialogs become
bottom sheets; the booking summary becomes a fixed bottom bar; tables become
cards; tab bars scroll horizontally instead of widening the page.

## 7. Data visualisation

Single-series charts only (`components/shared/charts.tsx`): thin marks, 4px
rounded data-ends on the baseline, 2px gaps, dashed recessive gridlines,
a hover/focus tooltip on every mark, no legend (the card title names the
series), text in text tokens — never the series colour. The peak bar may use
the brand accent as the headline. Sequential data (utilisation heatmap)
uses one hue (`--heat`) from track to full. Status colours are never reused
as series colours.

## 8. Accessibility

- Visible focus on every interactive element (`focus-visible:ring-2 ring-ring/40`).
- Icon-only controls carry `aria-label`; toggles use `aria-pressed`;
  segmented choices use `role="radiogroup"`/`radio`; live values use
  `role="timer"` / `aria-live`.
- Status is never colour alone (dot + label, icon + text).
- A "Skip to content" link leads the app shell; dialogs/sheets have titles.
- `prefers-reduced-motion` collapses all animation.

## 9. i18n

Every visible string — including `aria-label`, toasts, placeholders and
admin screens — goes through `t()` with keys in both `locales/en.ts` and
`locales/cs.ts` (see `frontend/CLAUDE.md` and the `i18n-check` skill).
Prefer phrasing that avoids Czech plural agreement ("Hry: {count}") over
English-shaped "{count} games".

## 10. Extending the system

1. Look for an existing primitive/composite (§4) first.
2. A new colour → a base `--c-*` token in `:root` **and** `.dark`, then a
   semantic token mapped in `@theme inline`. Never inline.
3. A new shared component needs a second real call site first; until then it
   stays page-local.
4. Update this file when a rule changes — not with history, with the rule.
