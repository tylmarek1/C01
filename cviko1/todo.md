# C01 — stav a co zbývá (checklist proti Definition of Done)

Tým: **VTG Courts** (Adam Vrána, Marek Tyl, Josef Glogar)
Repo: https://github.com/tylmarek1/C01 (branch `c01-spike`)
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

## Rozpracováno — čeká se na tým ⏳

- [ ] **Review smyčka (bod 6)** — připraveno, čeká se na review:
  - Issue **„C01 engineering spike"** založeno: https://github.com/tylmarek1/C01/issues/1
  - Změna (doplnění týmu v README) je na branchi `c01-spike-review`
  - PR otevřen proti `c01-spike`, review vyžádáno od `tylmarek1` (Marek): **https://github.com/tylmarek1/C01/pull/2**
  - **Co ještě zbývá udělat vy (lidsky):** Marek (nebo Josef) musí PR **reálně zkontrolovat a schválit/okomentovat na GitHubu** — to musí udělat člověk, ne AI. Až se to stane, PR se mergne do `c01-spike` a poslední bod Definition of Done je hotový.
- [ ] Ověřit, že Marek (`tylmarek1`) i Josef (`Pepanoss`) mají v repu odpovídající přístup — oba jsou aktuálně v seznamu collaborators, takže by mělo být OK, ale stojí za rychlou kontrolu v Settings → Collaborators.

## Poznámka
- Operace create/confirm/cancel/availability jsou zatím jen **navržené** v Project Frame, ne implementované jako API endpointy (aktuálně běží jen `/health`). To ale C01 nevyžaduje — plná implementace přijde s CP1 walking skeleton (C03/C04).
- V rootu repa je nesouvisející neverzovaný soubor `{status:ok}` (vypadá jako omylem uložený výstup curlu) — stálo by za to ho smazat nebo `.gitignore`nout.
