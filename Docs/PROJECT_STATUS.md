# PROJECT STATUS — FinancialWatchdog

**Ultimo aggiornamento:** 2026-06-21
**Fase:** Blocchi 1-8 completati. Stabilizzazione + baseline qualità + migrazione alert (D2/D2-bis)
+ screens + toolbar veritiera + monitoraggio alert v1 + architettura provider dati (Yahoo default,
Finnhub opzionale/fallback, Settings) + **dati fondamentali** (settore/industria/dividendi via Yahoo;
market cap/EPS/multipli via Finnhub se key) + **caricamento `.env`** (`process.loadEnvFile`).
**L'app funziona senza key; con key Finnhub arricchisce i fondamentali.**
**check 0 · lint 0 · test 31/31 · build OK.** Prossimo grande passo: PostgreSQL (D1/D4, non ora).

> **Sessione chiusa il 2026-06-21.** Per riprendere: leggere `Docs/HANDOVER.md`.
> Versionamento: branch `main`, ~33 voci **non committate** (nessun commit in sessione).

## Team di progetto (.claude/agents/)
`chief-architect` (coordinamento/decisioni), `developer` (fullstack), `test-engineer` (validazione).

## Stato sintetico

- ✅ Progetto importato da Replit ("FinAlert") in `C:\AI-LAB\FinancialWatchdog`.
- ✅ Configurazione AI-LAB applicata: `.claude/settings.local.json`, struttura `Docs/`,
  memoria operativa `memory/MEMORY.md`, documenti di autorità copiati.
- ✅ Analisi iniziale (sola lettura) → `Docs/Architecture/ANALISI_INIZIALE.md`.
- ✅ Decisioni D1-D4 consolidate dall'utente (vedi `CHANGELOG_DECISIONS.md`).
- ✅ **Blocco 1 — stabilizzazione locale** (dettaglio in `WORK_LOG.md`):
  - script `dev`/`start` resi cross-platform (rimosso `NODE_ENV=` inline);
  - rilevamento ambiente in `server/index.ts`; rimosso `reusePort` (incompatibile Windows);
  - `db.ts` reso lazy → l'app parte senza `DATABASE_URL` (storage in memoria);
  - rimossa API key Finnhub hardcoded (server + client morto); aggiunti `.env.example` e `.gitignore` per `.env`;
  - aggiunto `GET /api/health`;
  - fix bug: error handler che rilanciava, `watchlist.tsx` (setState in render + precedenza), cascade `DatabaseStorage.deleteWatchlist`;
  - risolti 6 errori `tsc` pre-esistenti → **type-check verde**.
- ✅ Verifiche: `npm run check` ✓ · `npm run build` ✓ · runtime `npm run dev` + `GET /api/health` → 200 ✓.

## Stack rilevato

React 18 + Vite + TS · Express + TS · Drizzle ORM (Postgres `pgTable`) · Neon driver ·
Finnhub + Yahoo proxy · porta 5000 (API + client).

## Storage attuale (reale)

- Selezione via factory (`createStorage()`): senza `DATABASE_URL` → **in memoria**
  (`MemStorage`), seed `Tech Stocks` / `Blue Chips` / `Growth`; con `DATABASE_URL` →
  `DatabaseStorage` (PostgreSQL). Default locale = MemStorage (invariato).
- Pagina Alerts → **migrata sul backend locale** (`/api/alerts`); rimosso il toggle watchlist
  esterno (D2-bis). **Nessun riferimento a `borsa-alert.onrender.com`**; i file legacy
  (`legacy.ts`, `legacyAlertApi.ts`) sono stati **eliminati**. D2 chiusa.

## Comandi di progetto (verificati in package.json)

```
npm run dev      # tsx server/index.ts (ambiente auto-rilevato, cross-platform)
npm run build    # vite build + esbuild server
npm start        # node dist/index.js (prod)
npm run check    # tsc (type-check) — verde
npm test         # vitest run — 11/11 verde
npm run lint     # eslint — 0 problemi
npm run build    # build client + bundle server — verde
npm run db:push  # drizzle-kit push (richiede DATABASE_URL — non usato ora)
```
Nota: i test Vitest esistono (`tests/`); **non esiste** `db:seed`. Per i dati di mercato serve
`FINNHUB_API_KEY` nell'ambiente (vedi `.env.example`); senza, `/api/stocks/*` falliscono
ma l'app parte, `/api/health` risponde e le schermate degradano in modo pulito.

## Prossimo step

Sviluppo applicativo congelato. Il prossimo grande incremento è **PostgreSQL** (D1/D4):
vedi la sezione "Cosa serve per PostgreSQL" nel riepilogo finale in fondo. Da decidere con
l'utente prima di procedere (provisioning DB locale + driver + seed + eventuale modifica schema).

## Decisioni consolidate (2026-06-21)

Dettaglio in `CHANGELOG_DECISIONS.md`.

- **D1 — Database:** PostgreSQL (schema già `pgTable`, no SQLite).
- **D2 — Alert:** migrare sul backend locale; `borsa-alert.onrender.com` = legacy da dismettere.
- **D3 — Controllo alert:** lato frontend in fase 1; scheduler backend in fase successiva.
- **D4 — Provisioning:** solo locale, **no cloud / no Render** ora; predisporre per `DATABASE_URL`.
  Nessun nuovo servizio esterno e nessun costo senza conferma utente.

### Direzione target (post-decisioni, non ancora implementata)

`MemStorage → DatabaseStorage` dietro `IStorage` con Postgres locale · script di seed
idempotente · client API centralizzato · (distacco pagina Alerts dal backend esterno: ✅ fatto).

---

## Riepilogo finale dello stato progetto (2026-06-21, consolidamento)

### Cosa funziona oggi (anche SENZA alcuna chiave — provider Yahoo di default)
- Avvio locale cross-platform (`npm run dev`), `GET /api/health`.
- **Ricerca titoli, quotazioni, profilo** via **Yahoo** (`/api/stocks/*`) — verificato live (AAPL).
- **Watchlist** (backend locale, MemStorage): crea, elimina (con conferma), aggiungi/rimuovi titoli.
- **Alert** (backend locale): crea/lista/elimina; pagina Alerts su `/api/alerts`.
- **Grafici** titolo via Yahoo (`/api/yahoo/chart`), Line/Candles, toggle Volume.
- **Monitoraggio alert v1** client-side: polling 30s, evidenza visiva + beep al target (ora i prezzi
  arrivano da Yahoo, quindi i trigger funzionano anche senza key).
- **Settings**: scelta provider dati (Yahoo / Auto / Finnhub).
- Qualità: `check` 0 · `lint` 0 · `test` 23/23 · `build` OK.

### Cosa richiede `FINNHUB_API_KEY` (opzionale, la inserisce l'utente in `.env`)
- **Nulla è più bloccato dalla key**: Yahoo (default) copre ricerca/quote/profilo/grafici.
- La key abilita **Finnhub come provider alternativo/fallback** (selezionabile da Settings) e fornisce
  campi extra di profilo (es. `country`, `marketCapitalization`) che Yahoo non espone.
- La key resta **solo server-side**; in Settings appare solo `finnhubAvailable: true/false`.

### Cosa resta su MemStorage (in memoria, non persistente)
- `users` (utente demo `default`, id=1), `watchlists` (seed Tech Stocks/Blue Chips/Growth),
  `watchlist_items`, `alerts`. **Tutto si azzera al riavvio del server.**
- Selezione storage via `createStorage()`: con `MemStorage` di default; passerebbe a
  `DatabaseStorage` automaticamente se presente `DATABASE_URL`.

### Cosa serve per PostgreSQL (quando si deciderà — D1/D4)
1. **Provisioning DB locale** (Postgres locale) e `DATABASE_URL` in `.env`.
2. **Driver**: l'attuale `@neondatabase/serverless` è per Neon cloud (WebSocket); per Postgres
   locale standard serve valutare `pg` + `drizzle-orm/node-postgres` (nuova dipendenza → conferma).
3. **`db:push`** per creare lo schema; eventuale **adeguamento schema** (mancano `currency`/`created_at`
   su items, `triggered_at` su alerts, unique `(watchlist_id, symbol)`) → modifica schema (da decidere).
4. **Script di seed idempotente** (utente demo + watchlist) — `DatabaseStorage` non semina come MemStorage.
5. **Verifica** del percorso `DatabaseStorage` (incluso il cascade già previsto in `deleteWatchlist`).

### Prossimi step consigliati (in ordine)
1. Inserire `FINNHUB_API_KEY` in `.env` e validare manualmente search/quote/alert-trigger.
2. (Opz.) Monitoraggio alert "fase 2" server-side: richiede schema (`triggered_at`) + scheduler → con PostgreSQL.
3. PostgreSQL locale secondo i 5 punti sopra (decisione utente).
4. (Opz.) Rename watchlist (nuova API), client API centralizzato, de-Replit prima di un eventuale deploy.
