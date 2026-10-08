# Courtly design system — "Clubhouse programme"

The rules every UI change on `frontend/` follows. Tokens live in
`frontend/src/index.css`; primitives in `frontend/src/components/ui/`;
app composites in `frontend/src/components/shared/`. This file explains
*why* they look the way they do and *how* to use them — it is not a second
copy of the token values (read `index.css` for those).

## 1. Direction

Courtly should feel like **a sports club's printed match-day programme and
the court schedule pinned up in its clubhouse** — warm paper, forest ink,
one clay-court accent, big condensed headlines, hairline rules, sharp
corners. It must not read as a generic AI-generated SaaS dashboard: no
sidebar + KPI-card grid, no soft rounded cards everywhere, no neon accent,
no glows, gradients or glassmorphism.

The direction is a combination of styles from the
[Refero Styles](https://styles.refero.design/) library (≈1,100 styles
crawled, ≈830 previewed, shortlisted to ~16, these six used):

| Source | What we took |
|---|---|
| **Kikin** (vintage park poster) | Forest ink on cream paper, a condensed display face, numbered sections ("01 / 02"), the rotated sticker badge. |
| **Monocle** (broadsheet) | Paper canvas, 1px rules doing the separating, 0–8px corners, no shadows, the masthead + heavy rule under page titles. |
| **Strava** | Warm paper with one hot sporty accent used sparingly; the sport itself as the imagery. |
| **Ballpark** | Accent kept to ~5% of the page, ink as the default strong action, mono uppercase eyebrows. |
| **Twitch "Stadium"** | Scoreboard chips (square, mono, uppercase), the LIVE marker, the ticker band. |
| **Champions4good** | Sports-poster type scale and pill toggles for sport/filter chips. |

The accent is **clay** — the colour of a clay tennis court. The
"programme cover" is **forest green**. Courts themselves are painted in
their real surface colours (tennis clay, volleyball blue, badminton
green) with chalk lines, so a sport reads the same everywhere.

## 2. Principles

1. **Type and rules carry hierarchy, colour carries meaning.** Condensed
   uppercase display for titles and figures, a heavy ink rule under a page
   title or above a section, hairlines between rows. Colour is for the
   brand action, status and sport identity — never decoration.
2. **One clay action per view.** `Button variant="brand"` is the one thing
   we want you to do here (book, confirm, reserve). Everything else is ink
   (`default`), `outline` or `ghost`. On desktop the masthead's "Book a
   court" is that action, so pages hide their own header CTA on `lg+`.
3. **Paper doesn't float.** Nothing at rest has a shadow; hover darkens a
   rule to ink instead of lifting. Only overlays (menus, dialogs, sheets,
   toasts) get `shadow-md`/`lg`.
4. **Data looks like data.** Times, prices, counts and dates are mono +
   `tabular`; headline figures are the condensed display face.
5. **Every state is designed** — loading (skeleton in the content's shape),
   empty (why + next action), error (failed + retry).
6. **Tell people what happens next.** Holds show a live countdown (and the
   "HELD" stamp), approvals show their deadline, taken slots offer the
   waitlist, destructive actions name what they destroy.
7. **Motion explains, never decorates.** 120–360ms, ease-out, a spring
   only for "it's yours" moments (picking a slot, the hold stamp).
   Everything collapses under `prefers-reduced-motion`; the ticker stops.

## 3. Tokens

Use the **semantic** Tailwind classes. Never a hex value, never a raw
Tailwind palette colour (`bg-amber-50`, `text-red-600`…) — those don't
follow dark mode. Only the base palette (`--c-*`) plus a few named tokens
are redefined under `.dark`; every semantic token re-themes automatically.

### Colour roles

| Role | Classes | Use for |
|---|---|---|
| Canvas | `bg-background` | Page background (warm paper; a faint paper-grain layer sits over it). |
| Surface | `bg-card`, `bg-popover` | Sheets of paper: cards, menus, dialogs, the slot board. |
| Wash | `bg-muted`, `bg-wash-strong` | Inset areas, hover fills, tracks. |
| Ink | `text-foreground`, `border-foreground` | Primary text **and** the heavy rules. |
| Muted / subtle text | `text-muted-foreground`, `text-subtle-foreground` | Secondary copy, metadata, placeholders. |
| Lines | `border-border`, `border-border-strong`, `border-input` | Hairlines between rows, inputs. |
| Primary (ink) | `bg-primary text-primary-foreground` | Default strong button, the active day/segment. Inverts in dark mode. |
| Brand (clay) | `bg-brand text-brand-foreground`, `bg-brand-soft`, `text-brand-ink` | THE action, the picked slot, live markers, unread counts, the eyebrow square. `brand-ink` is text-safe clay on paper. |
| Panel (forest) | `bg-panel text-panel-foreground`, `text-panel-muted` | The programme cover — venue strip, court pass, next-up card, footer, CTA band, auth art. Stays dark in both themes. |
| Court surfaces | `bg-court-tennis`, `bg-court-volleyball`, `bg-court-badminton`, `stroke-court-line` | Only for sport identity: `CourtArt`, `SportTile`, ticket stubs. |
| Status | `text-success` + `bg-success-soft`, same for `warning`, `danger`, `info` | Always as a pair, always with an icon or label too. |
| Data viz | `bg-chart-1`, `bg-chart-track`, `bg-heat` | Charts only (§7). |
| Star | `fill-star text-star` | Rating stars only. |

Reservation statuses map to tones in `lib/reservation-status.ts`
(`STATUS_VARIANT`) — render them with `<StatusBadge>`.

**Exception** (deliberately raw): the photo scrim `from-black/25` on court
photos.

### Typography

- **Big Shoulders Display** (`font-display`, the `.display` utility) — page
  titles, section heads, headline figures, court names on tickets. Always
  uppercase, 800–900 weight, line-height ≈0.92. Prices inside a `.display`
  block use `normal-case!` so "Kč" isn't shouted.
- **Schibsted Grotesk** (`font-sans`) — all UI and body text. Body 15px/1.5;
  UI text 13–15px, semibold/bold for emphasis.
- **IBM Plex Mono** (`font-mono`) — times, prices, counters, badges, and
  the `.eyebrow` utility (11px, uppercase, 0.08em tracking). An eyebrow in
  a page/section header is led by a small clay square.
- All three load from Google Fonts in `index.html` with the latin-ext subset
  (Czech diacritics: Ř, Č, Ů… are checked).

### Spacing, radius, elevation, motion

- 4px grid. Page gutters 16/24/32px (`PageContainer`). Sections inside the
  app are 32–40px apart; marketing sections 64–96px.
- Radius stays between 2 and 8px: `rounded-xs` 2 · `rounded-sm` 3 ·
  `rounded-md` 4 (buttons, inputs, cards) · `rounded-lg` 5 · `rounded-xl` 6
  · `rounded-2xl` 8. Fully round only for filter/sport chips, the sticker
  and status dots.
- Shadows: none at rest (`shadow-xs`/`sm` are intentionally empty);
  `shadow-md`/`lg` for overlays only.
- Utilities in `index.css`: `.display`, `.eyebrow`, `.tabular`, `.surface`,
  `.surface-interactive` (rule darkens on hover), `.stagger` (set `--i`),
  `.bg-hatch` (taken slots, closed hours), `.ticket` / `.ticket-h`
  (perforation notches at `--perf` / `--perf-y`), `.bg-court-grid`,
  `.scrollbar-none`.
- Animations: `animate-fade-up`, `fade-in`, `scale-in`, `shimmer`
  (skeletons), `pop` (a slot being picked), `stamp` (the HELD stamp and the
  landing sticker; rotation via `--stamp-rotate`), `blink` (live markers),
  `ticker` (the landing band), `grow-x`/`grow-y` (chart bars).

## 4. Components

Reach for these before writing markup. Primitives (`components/ui/`):

| Primitive | Notes |
|---|---|
| `Button` | Variants `default` (ink) · `brand` (clay) · `secondary` · `outline` · `ghost` · `subtle` · `link` · `destructive` · `destructive-ghost`; sizes `xs/sm/default/lg/xl/icon*`. Square-cut, semibold, presses down 1px. `isLoading` shows a spinner and disables. Icon-only buttons need `aria-label` (and usually a `Tooltip`). On the forest panel, override an outline button with `border-panel-foreground/30 text-panel-foreground`. |
| `Badge` | Scoreboard chip: mono, uppercase, square. Tones `default/secondary/outline/brand/solid/success/warning/destructive/info`, optional square `dot`. |
| `Card` | A sheet of paper: hairline, 4px corners, no shadow; `interactive` darkens the rule on hover. Prefer a ruled section (`border-t-2 border-foreground pt-3`) over a card when the content isn't a discrete object. |
| `Input`, `Textarea`, `Select`, `Switch`, `Label` | Share `field-styles.ts`; focus darkens the border to ink plus a faint ring. The switch is a square-cut toggle. |
| `Tabs` | `variant="segmented"` (ruled strip, active cell fills with ink) for views of the same data; `variant="line"` (3px ink underline) for page sections. Drive the value from the URL (`?tab=`, `?view=`). |
| `Dialog` / `SheetContent` | Title is set in the display face. Dialog for focused tasks (a bottom sheet on mobile); Sheet for a detail view that keeps its list in context. The overlay is a flat forest tint — no blur. |
| `DropdownMenu`, `Popover`, `Tooltip`, `Skeleton`, `Progress`, `Kbd`, `Avatar` (square, display initials), `Separator` | — |

App composites (`components/shared/`, exported from `index.ts`):

- **Shell** (`app-layout.tsx`, `app-nav.tsx`): signed-in pages use
  `AppShellLayout` — on `lg+` a forest **venue strip** (today's date, open /
  closed now in venue time, language, theme) above a sticky **masthead**
  (logo, section links with an ink underline, search ⌘K, notifications, the
  clay "Book a court", account); below `lg` a top bar plus a fixed **bottom
  tab bar** (Overview · Courts · Book · Games · More) whose "More" opens
  `MobileNavMenu`, a numbered contents-page menu. `AdaptiveLayout` puts court
  browsing inside the shell when signed in. Marketing pages use `Navbar` +
  the forest `Footer` with the giant wordmark.
- **Page anatomy**: `PageContainer` + `PageHeader` (back link, eyebrow,
  display title, heavy rule, standfirst, actions) on every app page;
  `SubsectionHeading` (display, optional `(04)` count) for blocks;
  `SectionHeader`, `MarketingSection`, `FaqList` (numbered ruled list),
  `CtaBand` (forest) on marketing pages.
- **States**: `EmptyState` (dashed frame, ink icon tile, display title),
  `ErrorState` (with retry), `Skeleton` shaped like content.
- **Data**: `StatTile` (a "by the numbers" figure: heavy top rule, mono
  label, big display numeral — no box), `StatusBadge`, `Countdown`,
  `UserAvatar` (the only avatar), `FilterChip`, `SearchInput`,
  `SportPicker`, `SportTile` (sport icon on its court colour), charts
  (`ColumnChart`, `BarList`, `Heatmap`).
- **Domain**: `CourtCard` (showcase with painted court art / compact link /
  selectable row with a clay marker), `CourtArt` (photo, or the painted
  court plan), `ReservationCard` (a **ticket**: sport-coloured date stub,
  perforation, booking, one primary action + `⋯`), `DateBlock`,
  `ReservationDetailDialog` + `ReservationTimeline`, `DayStrip` (fixture
  list of days) + `SlotGrid` (the **schedule board**: ruled cells grouped
  by part of day, picked slot in clay with its end time, taken slots
  hatched and labelled, legend + free count), `OccupancyTimeline`,
  `WeekCalendar`, `PlayerSearch`, `ActivityFeedItem`, `StarRating(Input)`,
  `ConfirmDialog` (the only destructive confirmation).

## 5. Patterns

- **Page anatomy (app)**: `PageContainer` → `PageHeader` → content; main
  column left, a 320–360px context column right on `lg+`, its blocks
  separated by heavy rules rather than boxed.
- **Booking** (`BookCourtPage`): numbered steps ("01 Court", "02 Day &
  time"), the numeral turns clay when the step is done; the summary is the
  forest **court pass** with a tear-off perforation above the price and the
  CTA, sticky on desktop and a pass stub above the tab bar on mobile. The
  hold dialog stamps "HELD" and shows the countdown as a display figure.
- **Things that happen at a time** are grouped by day under a sticky
  eyebrow header (`groupByDay`, `fmt.dayLabel`) and rendered as tickets.
- **One primary action per row**; secondary actions in a `⋯` menu,
  destructive last, always through `ConfirmDialog` naming the object.
- **Tables** (admin): real `<table>` on `md+`, stacked rows on mobile, a
  search + `FilterChip` toolbar with live counts, "Showing X of Y" +
  "Load more".
- **Forms**: label above field, inline validation under it, submit disabled
  until valid, server errors inline (auth) or as a toast with the backend's
  message (`ApiError`).
- **Toasts** (bottom-right; above the tab bar on mobile) confirm an action
  and name the object.
- **Time and locale**: every date/time/number goes through `useFormatters()`
  (`lib/format.ts`); "now" in render comes from `useNow()`; venue opening
  hours come from `lib/venue.ts` and are compared in venue time (root
  `CLAUDE.md` pitfall #1).
- **Business rules in the UI are hints only.** `lib/slots.ts` mirrors lead
  time / advance window to disable slots early; the backend enforces them
  (pitfall #3).

## 6. Responsive

Designed mobile-first at 390px and checked at 768 / 1024 / 1440. Below `lg`
the masthead becomes a top bar + bottom tab bar (the shell's `<main>` pads
for it, and anything else fixed to the bottom — the booking pass stub —
sits above it); dialogs become bottom sheets; tables become rows; tab bars
and the day strip scroll horizontally instead of widening the page. The
slot board uses container queries (`@container` / `@lg:`) so it fits both
the wide booking page and the narrow court-detail widget.

## 7. Data visualisation

Single-series charts only (`components/shared/charts.tsx`): thin ink marks,
2px gaps, recessive gridlines, a hover/focus tooltip on every mark, no
legend (the title names the series), text in text tokens. The peak bar may
use clay as the headline. Sequential data (utilisation heatmap) uses one
hue (`--heat`, clay) from track to full. Status colours are never series
colours.

## 8. Accessibility

- Visible focus on every interactive element (`focus-visible:ring-2`).
- Icon-only controls carry `aria-label`; toggles use `aria-pressed`; live
  values use `role="timer"` / `aria-live`. Decorative art (court plans,
  the hero board, the ticker, the sticker) is `aria-hidden`.
- Status is never colour alone (square dot + label; taken slots are hatched
  *and* labelled *and* struck through).
- Clay on paper and cream on clay/forest meet WCAG AA for their text sizes
  (checked when the palette was chosen; re-check if you change a `--c-*`).
- "Skip to content" leads the shell; dialogs/sheets have titles.
- `prefers-reduced-motion` collapses all animation.

## 9. i18n

Every visible string — including `aria-label`, toasts, placeholders and
admin screens — goes through `t()` with keys in both `locales/en.ts` and
`locales/cs.ts` (see `frontend/CLAUDE.md` and the `i18n-check` skill).
Prefer phrasing that avoids Czech plural agreement ("Volné: {count}").
Uppercase display text must be checked in Czech — long words
("ZAREZERVUJTE") set the minimum size of a headline on mobile.

## 10. Extending the system

1. Look for an existing primitive/composite (§4) first.
2. A new colour → a base `--c-*` token in `:root` **and** `.dark`, then a
   semantic token mapped in `@theme inline`. Never inline.
3. Before adding a card, ask whether a ruled section does the job.
4. A new shared component needs a second real call site first; until then
   it stays page-local.
5. Update this file when a rule changes — not with history, with the rule.
