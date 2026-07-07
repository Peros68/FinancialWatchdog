# HANDOVER — FinancialWatchdog

> Documento di ripresa sessione. Leggere PRIMA di riprendere, insieme a
> `PROJECT_STATUS.md`, `CHANGELOG_DECISIONS.md`, `WORK_LOG.md`, `memory/MEMORY.md`.

**Ultimo aggiornamento:** 2026-07-06
**Stato qualità:** `npm run check` 0 · `npm run lint` 0 · `npm test` **89/89** · `npm run build` OK.
**GATE CHIUSO (2026-07-06):** `npm run db:push` eseguito su conferma utente (Docker Desktop e
container `finwatch-postgres` avviati prima del push; DATABASE_URL passato inline). Output
drizzle-kit: "Changes applied" → tabella `drawings` creata secondo l'output drizzle (nessuna
verifica diretta ulteriore, su indicazione utente).

## 1. Stato in una riga
App "FinAlert" (React+Vite / Express+TS / Drizzle) stabilizzata e ampliata: **storage
persistente su PostgreSQL locale** (Docker) quando `DATABASE_URL` è presente, altrimenti
MemStorage; dati di mercato **provider-agnostic** (Yahoo default, Finnhub opzionale),
schermate principali funzionanti, monitoraggio alert v1, dati fondamentali, grafico avanzato
(candele/area, strumenti di disegno + alert). **Funziona anche senza chiavi**; con
`FINNHUB_API_KEY` arricchisce i fondamentali.

## 2. Come avviare e verificare
```
npm install        # ripristina dipendenze (già installate)
npm run dev        # avvio locale, porta 5000 (ambiente auto-rilevato, cross-platform)
npm run check      # type-check (tsc)
npm test           # Vitest (31 test)
npm run lint       # ESLint (0 problemi)
npm run build      # build client + bundle server
```
- `.env` opzionale (vedi `.env.example`): `FINNHUB_API_KEY` lato server abilita Finnhub.
  Viene caricato automaticamente da `server/loadEnv.ts` (`process.loadEnvFile`).
- ⚠️ La porta 5000 può restare occupata da un dev server **orfano** di sessioni precedenti
  (EADDRINUSE all'avvio). Per le verifiche runtime preferire i test su porta effimera
  (pattern in `tests/`), evitando `Stop-Process` (chiede conferma).

## 3. Architettura attuale (sintesi)
- **Storage**: `server/storage.ts` factory `createStorage()` → `MemStorage` senza
  `DATABASE_URL`, `DatabaseStorage` (**PostgreSQL, ATTIVA e verificata** — 2026-07-05) se
  presente. Driver **node-postgres** (`pg`) in `server/db.ts`; DB locale via `docker-compose.yml`
  (`postgres:16-alpine`, porta 5432). Schema con `onDelete: cascade`, `alerts.triggeredAt`,
  `watchlist_items.currency/createdAt` + unique `(watchlist_id, symbol)`. Seed idempotente
  `server/seed.ts` (`npm run db:seed`). CRUD/cascade/persistenza verificati via API + `psql`.
- **Market data**: `server/marketData/` (`types`, `yahooProvider`, `finnhubProvider`, `index`
  facade) + `server/settings.ts`. Route `/api/stocks/{search,quote,profile,chart,fundamentals}`
  delegano al facade; preferenza provider da `GET/PUT /api/settings` (pagina `/settings`).
  Chiavi solo server-side. `toTradingViewSymbol` = utility pura non cablata.
- **Alert**: backend locale `/api/alerts`; pagina Alerts con monitoraggio v1 client-side
  (polling 30s, evidenza visiva + beep). **Fase 2 server-side (2026-07-06)**: scheduler
  `server/alertScheduler.ts` avviato da `index.ts` (default 60s, `ALERT_CHECK_INTERVAL_MS`
  per override/disable) — legge `getActiveAlerts()` (isActive ∧ triggeredAt NULL), 1 quote
  per simbolo via facade, salva `triggeredAt` (one-shot; riarmo = azzerare triggeredAt).
  Nessuna notifica push (fuori scope).
- **Frontend**: pagine Search, Stock Detail (+ Dati fondamentali), Watchlist (crea/elimina/
  rimuovi item), Alerts, Settings, NotFound.

## 4. Stato del codice / versionamento
- Branch: `main`. **Working tree committato** (2026-07-04): 5 commit logici `17acf6d..1901a60`
  sopra `b8f54e0` (tooling · server+market-data · client · test · docs/memory/agents).
  Vedi `WORK_LOG.md` per l'elenco.
- Screenshot orfano `attached_assets/image_1782028596346.png` **rimosso** (2026-07-05): non
  referenziato da codice/doc, tree ora pulito.
- Dead-code residuo `client/src/lib/finnhub.ts` **rimosso** (2026-07-04): non importato da nessuna
  parte (le occorrenze "finnhub" in `settings.tsx` sono `finnhubAvailable`). Verde dopo rimozione.

## 5. Decisioni aperte (richiedono l'utente)
- ~~**PostgreSQL (D1/D4)**~~ — **FATTO 2026-07-05** (attivato e verificato, vedi §6).
- **Monitoraggio alert fase 2** — scheduler + `triggeredAt` **FATTI (2026-07-06)**; resta la
  logica di notifica (fuori scope). **Modello C DECISO e IMPLEMENTATO (2026-07-06)**: tutti i
  drawings persistenti in tabella `drawings` (2 ancore tempo+prezzo; armato ⇔ `alertId`);
  ri-proiezione dinamica server-side giornaliera alle **08:00 Europe/Rome** + immediata su
  PUT del drawing + catch-up allo start (`server/alertReprojector.ts`).
  `db:push` **ESEGUITO** (2026-07-06): tabella `drawings` creata secondo l'output drizzle
  ("Changes applied").
- **Statements fondamentali** (conto economico/stato patrimoniale/cash flow): fuori scope
  (crumb Yahoo fragile o tier Finnhub a pagamento) — decisione separata.
- **Rename watchlist**: richiede nuova API.
- **Widget TradingView**: non integrato (solo util di conversione simboli).
- **Deploy cloud (D4)**: non fatto (solo locale). `@neondatabase/serverless` resta pronto per Neon.
- **`.env.example`**: aggiungere a mano il blocco Docker `DATABASE_URL` (i tool file sono
  bloccati dal guard sui pattern `.env`).
- **Commit/versionamento** del lavoro non committato (blocco PostgreSQL incluso).

## 6. PostgreSQL locale (D1/D4) — FATTO (2026-07-05)
Attivato e verificato. Per usarlo:
1. Avvia il DB: `docker compose up -d` (container `finwatch-postgres`, porta 5432).
2. Metti in `.env`: `DATABASE_URL=postgres://finwatch:finwatch@localhost:5432/finwatch`.
3. (Prima volta / DB nuovo) `npm run db:push` poi `npm run db:seed`.
4. `npm run dev` → l'app usa `DatabaseStorage`. URL: http://localhost:5000.
- **Gestione dati**: `docker compose down` ferma mantenendo il volume `finwatch-pgdata`;
  `down -v` **cancella** i dati.
- **Verificato**: selezione DatabaseStorage, lettura da Postgres, CRUD, cascade su
  `deleteWatchlist`, persistenza, idempotenza del seed.

## 7. Vincoli/preferenze operative (da rispettare)
- Lavorare solo nel workspace `C:\AI-LAB\FinancialWatchdog`. **Non** accedere a `~/.claude`
  salvo richiesta esplicita (policy Authorization Judge già configurata).
- Non inserire chiavi reali (le mette l'utente in `.env`); non stamparle/loggarle/committarle.
- `.env.example`/`.template`/`.sample`, `Docs/`, `memory/` = aggiornabili in autonomia.
- Stato/decisioni: documenti di autorità in `Docs/` + `memory/MEMORY.md` (prevalgono sulla chat).
