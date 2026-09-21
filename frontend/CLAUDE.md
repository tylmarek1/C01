# Frontend — CLAUDE.md

React 19 + TypeScript + Vite, managed with `npm`. Read the root `CLAUDE.md`
first — this file only covers frontend-specific rules.

## Commands

```bash
npm install
npm run dev        # Vite dev server, :5173 (auto-increments if occupied)
npm run build       # tsc -b && vite build — this IS the type-check step, there's no separate one
npm run lint        # oxlint, default rules
npm run preview
```

No Prettier is configured. Don't add one, and don't hand-reformat unrelated
code, as a side effect of an unrelated change.

## Directory layout

```
src/
├── components/shared/   the single reuse layer — shadcn-style primitives (button, card, dialog, ...)
│                        + composite components (week-calendar, reservation-detail-dialog, ...)
├── pages/{landing,auth,app,courts}/   page-level composition, built from components/shared
├── lib/                  api.ts (fetch wrapper), auth-context.tsx, i18n.tsx, query-client.ts,
│                        reservation-status.ts, amenities.ts, format.ts, image.ts, utils.ts
├── locales/              en.ts (source of truth for TranslationKey), cs.ts (typed against it)
└── types/                hand-maintained TS types mirroring backend Pydantic schemas — no codegen
```

Before adding a new primitive, check `components/shared/index.ts` — it's
very likely something close already exists (button/card/badge/dialog/
tabs/select/etc.). New page-specific composition goes under `pages/<area>/`;
new genuinely-reusable UI goes in `components/shared/`, not duplicated
inline in a page.

## Design system — extend it, don't redesign it

The "navy ink on cool marble" palette in `src/index.css`
(`--ink-navy`, `--signal-blue`, `--slate-gray`, `--mist-gray`, `--cloud`,
etc., mapped onto the shadcn semantic tokens like `--primary`/`--background`)
is a deliberate, already-finished design decision. **Never hardcode a hex or
rgb color in a component** — use the existing CSS variables / the Tailwind
classes derived from them. If a new token is genuinely needed, add it to
`index.css` alongside the others and derive a semantic token from it; don't
invent an inline one-off color.

## Data fetching

Always through TanStack Query + `lib/api.ts`'s typed fetch wrapper, which
throws `ApiError` (with `status` and a message read from the backend's
`detail` field). Never call raw `fetch()` from inside a component. Before
adding a new query/mutation, look at an existing hook using the same
resource for the query-key and invalidation pattern already in use rather
than inventing a new convention.

## Types are hand-maintained — this is a real drift risk

`src/types/` mirrors the backend's Pydantic schemas by hand; there is no
OpenAPI codegen. A backend schema change does **not** automatically surface
as a frontend compile error the way a generated client would — only fields
you actually touch will be caught, and only if the shapes disagree in a way
TypeScript can see (an added or renamed field on an object literal you
don't touch will happily still compile). When a backend model/schema
changes, run the `schema-change-sweep` skill rather than trusting `tsc` to
have caught everything.

## i18n — complete or nothing

`locales/en.ts` defines `TranslationKey`; `locales/cs.ts` is typed
`Record<TranslationKey, string>`, so a key present in one but missing in the
other is **already a TypeScript compile error** — you don't need to check
for that by hand. The actual risk (and a bug this project has shipped
before: pages landed with static English label maps and untranslated
toasts) is a **hardcoded string that never became a key in either
dictionary in the first place** — the compiler has nothing to catch there.

Treat i18n as complete-or-nothing per page/component: when you add or edit
any user-facing text — labels, toasts, `aria-label`s, dialog copy, admin-only
screens included — route it through `t()` and add the key to **both**
`en.ts` and `cs.ts` up front, not as a follow-up. Run the `i18n-check` skill
before finishing any change that touches visible text.

## Testing — there isn't an automated suite yet

No vitest/jest, no `@testing-library/*`, zero `*.test.*` files exist. This
is a known, real gap — don't silently scaffold a test framework as a side
effect of an unrelated task; propose it if it's genuinely warranted and let
the user decide. Until then, **verify UI changes manually**: run
`npm run dev` and actually exercise the feature in a browser before calling
it done (per the root `CLAUDE.md` "definition of done").

- `claude-in-chrome` may not be available in background/subagent sessions —
  if it isn't connected, installing Playwright into a throwaway scratch
  directory and driving the dev server's URL directly with a short script
  is an acceptable fallback.
- Check both languages (the language switcher toggles EN/CS) and the
  relevant role (player vs. venue manager) where the change touches
  role-gated UI.
- Check the browser console for errors/warnings the change introduced.

## Build/lint gate

`npm run build` (`tsc -b && vite build`) is the closest thing to a type
check this project has — `strict` mode is off, but `noUnusedLocals`,
`noUnusedParameters`, and `noFallthroughCasesInSwitch` are on, so unused
code or a missing switch case will fail the build. `npm run lint` runs
`oxlint` on default rules. Both must pass before a frontend change is done.

## Frontend-specific skills

These live in `frontend/.claude/skills/` and apply automatically when you're
working here; see root `CLAUDE.md` for the project-wide ones.

| Skill | Use it when |
|---|---|
| `component-design` | Before creating any new component or styling new UI — where it belongs, and the design-token discipline |
| `api-integration` | Adding a query/mutation, wiring a page to the API, or building a form |
| `accessibility-responsive` | Before finishing any UI change — the manual verification checklist, since there's no automated suite |
| `i18n-check` | Before finishing any change that adds or edits user-facing text |
