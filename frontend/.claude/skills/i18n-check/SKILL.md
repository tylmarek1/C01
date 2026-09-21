---
name: i18n-check
description: Check for hardcoded, untranslated user-facing text in Courtly's (C01) React frontend before finishing a change. Use after adding or editing any visible UI text — labels, toasts, aria-labels, dialog copy, admin screens included — since a hardcoded string is the one i18n bug TypeScript won't catch here.
---

# i18n completeness check

`frontend/src/locales/en.ts` defines `TranslationKey`; `cs.ts` is typed
`Record<TranslationKey, string>`. That means a key present in one file but
missing in the other is **already a TypeScript compile error** — you do not
need to manually diff the two catalogs for missing keys, `npm run build`
does it for you.

The actual risk this project has shipped before is different: a string
written directly into JSX (or a toast call, or an `aria-label`) that never
became a key in either dictionary in the first place. The compiler has
nothing to catch there, because nothing declares it should have been a key.

## Step 1 — Scope

The files you added or edited in this change.

## Step 2 — Grep for likely hardcoded text

In the changed `.tsx`/`.ts` files, look for:
- JSX text content that reads like a real sentence/label, not a variable.
- `toast(...)`, `toast.success(...)`, `toast.error(...)` string arguments.
- `aria-label=`, `placeholder=`, `title=`, `alt=` string literals.
- Button/dialog/menu copy passed as a literal instead of `t("...")`.

## Step 3 — Add real keys, not placeholders

For every genuine hit, add a key to **both** `en.ts` and `cs.ts` — write
real Czech text, not a copy of the English string as a placeholder — then
replace the literal with `t("that.key")`.

## Step 4 — Treat the page as complete-or-nothing

A page that's mostly translated with a few raw English strings left over
reads as broken, not as acceptable partial coverage — this is a bug this
project has actually shipped and gotten user complaints about. Translate
every string you touch in this pass, including "minor" ones (toasts,
aria-labels, admin-only screens).

## Step 5 — Verify

Run `npm run build` (catches key-parity issues, not hardcoded strings — that
was Step 2). If practical, toggle the language switcher and glance at the
page in both languages.
