# C01 — stav a co zbývá (checklist proti Definition of Done)

Tým: **VTG Courts** (Adam Vrána, Marek Tyl, Josef Glogar)
Repo: https://github.com/tylmarek1/C01 (branch `main`; `c01-spike` po merge PR #5 smazána)
Kontrolováno: 2026-09-14

## Hotovo ✅

- [x] Repo existuje, sdílené, lze do něj commitovat
- [x] Jasně vymezená doména: sportovní kurty (tenis/volejbal/badminton), `docs/intent-and-change.md`
- [x] Resource (Court) + Reservation + User namodelováno (`src/reservations/models.py`)
- [x] Smysluplné stavy rezervace: DRAFT / CONFIRMED / CANCELLED
- [x] Common rule (žádné překryvy CONFIRMED rezervací) — vynuceno PostgreSQL exclusion constraintem, otestováno i pod souběhem
- [x] Vlastní domain-specific business rule (délka slotu 60/90/120 min, start na :00/:30, v rámci 07:00–22:00)
- [x] External boundary definován (Notification Service, zatím jako stub)
- [x] Kompletní Project Frame v `docs/intent-and-change.md` (všechny sekce vyplněné)
- [x] Vybraná future pressure: **Q** (10× nárůst souběžných potvrzení oblíbeného slotu) + zdůvodnění
- [x] Proveden engineering spike **A — Persistence**: uložení do reálné PostgreSQL, načtení zpět, ověření (`tests/test_persistence_spike.py`), včetně testu souběhu (10 vláken, 1 projde, 9 zamítnuto)
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
- Operace create/confirm/cancel/availability jsou zatím jen **navržené** v Project Frame, ne implementované jako API endpointy (aktuálně běží jen `/health`). To ale C01 nevyžaduje — plná implementace přijde s CP1 walking skeleton (C03/C04).
- Omylem commitnutý prázdný soubor `{status:ok}` (výstup curlu) byl z repa odstraněn.
