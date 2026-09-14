# C01 — stav a co zbývá (checklist proti Definition of Done)

Tým: **VTG Courts** (Adam Vrána, Marek Tyl, Josef Glogar)
Repo: https://github.com/tylmarek1/C01 (branch `main`; `c01-spike` po merge PR #5 smazána)
Kontrolováno: 2026-09-14

## Hotovo ✅

- [x] Repo existuje, sdílené, lze do něj commitovat
- [x] Jasně vymezená doména: sportovní kurty (tenis/volejbal/badminton), `docs/intent-and-change.md`
- [x] Resource (Court) + Reservation + User namodelováno (`backend/src/reservations/models/`)
- [x] Smysluplné stavy rezervace: DRAFT / CONFIRMED / CANCELLED
- [x] Common rule (žádné překryvy CONFIRMED rezervací) — vynuceno PostgreSQL exclusion constraintem, otestováno i pod souběhem
- [x] Vlastní domain-specific business rule (délka slotu 60/90/120 min, start na :00/:30, v rámci 07:00–22:00)
- [x] External boundary definován (Notification Service, zatím jako stub)
- [x] Kompletní Project Frame v `docs/intent-and-change.md` (všechny sekce vyplněné)
- [x] Vybraná future pressure: **Q** (10× nárůst souběžných potvrzení oblíbeného slotu) + zdůvodnění
- [x] Proveden engineering spike **A — Persistence**: uložení do reálné PostgreSQL, načtení zpět, ověření (`backend/tests/test_persistence_spike.py`), včetně testu souběhu (10 vláken, 1 projde, 9 zamítnuto)
- [x] Evidence + decision kompletně zapsané v `docs/evidence-and-evolution.md` (question / what we did / observed result / decision)
- [x] CP1 walking skeleton konkrétně definován v `README.md` (POST /reservations → validate → persist → return id → automated check)
- [x] **Tým a repo (bod 1)** — `README.md` doplněno: team name **VTG Courts**, členové Adam Vrána / Marek Tyl / Josef Glogar, URL repa

- [x] **Review smyčka (bod 6)** — splněno:
  - PR #2 a #3 (Adam) byly mergnuty do `c01-spike` bez review druhého člena → nepočítají se.
  - Issue https://github.com/tylmarek1/C01/issues/4 — zavřeno
  - PR `c01-spike → main` https://github.com/tylmarek1/C01/pull/5 — **Approve od Josefa (`Pepanoss`)** 10:18, merge 10:19
  - Default branch repa přepnut na `main`.
- [x] Přístup do repa: `adam-vrana`, `tylmarek1`, `Pepanoss` jsou collaborators (ověřeno 2026-09-14).

**Všech 15 bodů Definition of Done je splněno.**

## Poznámka
- ~~Operace create/confirm/cancel/availability jsou zatím jen navržené...~~ — **od 2026-09-14 už implementované** (viz níže), nad rámec toho, co C01 vyžaduje.
- ~~V rootu repa je nesouvisející neverzovaný soubor `{status:ok}`...~~ — smazáno.

## Rozšíření nad rámec C01 (2026-09-14) — API, auth, frontend

Repo bylo rozděleno na `backend/` (beze změny chování, jen přesunuto) a nový `frontend/`
(React + Vite + TS + Tailwind, shadcn-styl komponenty ve `frontend/src/components/shared`,
vizuální styl podle zadaného Calendly reference — navy text, signal-blue akcent, žádné
generické "AI SaaS" gradienty). Detaily v `docs/architecture-and-decisions.md` (ADR-002, ADR-003)
a v `backend/README.md` / `frontend/README.md`.

- [x] `POST /auth/register`, `POST /auth/login`, `GET /auth/me` — JWT (bcrypt + HS256)
- [x] `GET /courts`, `POST /reservations` (validuje slot rule), `GET /reservations`,
      `POST /reservations/{id}/confirm`, `POST /reservations/{id}/cancel`
- [x] React frontend: landing page, register/login, dashboard s rezervacemi, booking flow
- [x] 17 backend testů (pytest, proti reálné Postgres) + ověřeno ručně přes prohlížeč (Playwright)
- [x] Cestou opravena reálná chyba: opening-hours pravidlo se porovnávalo v UTC místo
      v `Europe/Prague` — časy poslané s `Z` offsetem (např. z prohlížeče v UTC) byly
      mylně odmítnuty. Opraveno v `backend/src/reservations/schemas/reservation.py`
      (`astimezone(VENUE_TZ)` před kontrolou hodin/minut) + regresní test.

### Co by stálo za to příště
- **Alembic migrace** místo `create_all` — první skutečná schema change (`password_hash`)
  proběhla ručně přes drop/create, viz otevřený bod v `docs/evidence-and-evolution.md`.
- **Venue manager** rozhraní (správa kurtů, zrušení cizí rezervace) — role v modelu už je,
  ale nemá UI ani zvláštní endpointy.
- **Notification Service** — pořád jen stub v Project Frame, žádná reálná integrace.
- **Frontend testy** (aktuálně jen ruční ověření přes Playwright screenshoty) — Vitest +
  Testing Library by pokryly komponenty a auth flow automatizovaně.
- Testová sada maže a znovu vytváří celé schéma proti `DATABASE_URL` (viz `backend/README.md`) —
  časem by se hodila oddělená test DB, ať `uv run pytest` nemaže naseedovaná data pro frontend.
