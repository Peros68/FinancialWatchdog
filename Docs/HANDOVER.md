# HANDOVER — FinancialWatchdog

> Documento di ripresa sessione. Leggere PRIMA di riprendere, insieme a
> `PROJECT_STATUS.md`, `CHANGELOG_DECISIONS.md`, `WORK_LOG.md`, `memory/MEMORY.md`.

**Ultimo aggiornamento:** 2026-07-10
**Stato qualità (ultima verifica nota, 2026-07-06):** `npm run check` 0 · `npm run lint` 0 ·
`npm test` **89/89** · `npm run build` OK.
**GATE CHIUSO (2026-07-06):** `npm run db:push` eseguito su conferma utente (Docker Desktop e
container `finwatch-postgres` avviati prima del push; DATABASE_URL passato inline). Output
drizzle-kit: "Changes applied" → tabella `drawings` creata secondo l'output drizzle (nessuna
verifica diretta ulteriore, su indicazione utente).

**DEPLOY CLOUD LIVE (2026-07-10, fatto manualmente dall'utente):** app live su Render
(`https://financialwatchdog.onrender.com`), DB effettivo = **Supabase Free PostgreSQL** via
`DATABASE_URL`, keepalive GitHub Actions. **D4 non è più una decisione aperta.** Dettaglio in §8.

## 1. Stato in una riga
App "FinAlert" (React+Vite / Express+TS / Drizzle) stabilizzata e ampliata: **storage
persistente su PostgreSQL** (locale via Docker in sviluppo, **Supabase in produzione su
Render**) quando `DATABASE_URL` è presente, altrimenti MemStorage; dati di mercato
**provider-agnostic** (Yahoo default, Finnhub opzionale), schermate principali funzionanti,
monitoraggio alert v1+v2 (scheduler server-side), dati fondamentali, grafico avanzato
(candele/area, strumenti di disegno + alert persistenti). **Funziona anche senza chiavi**; con
`FINNHUB_API_KEY` arricchisce i fondamentali. **Deployata e live su Render** (§8).

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
- ~~**Deploy cloud (D4)**: non fatto~~ — **FATTO 2026-07-10** (Render + Supabase, vedi §8).
- **`.env.example`**: aggiungere a mano il blocco Docker `DATABASE_URL` (i tool file sono
  bloccati dal guard sui pattern `.env`).
- **Commit/versionamento** del lavoro non committato (blocco PostgreSQL incluso).
- **Render Postgres di prova non usato** (`financialwatchdog-db`): tenere o dismettere?
- **Schema su Supabase**: non verificato che sia allineato allo schema Drizzle (incl. `drawings`
  del Modello C) — nessun `db:push` puntato a Supabase eseguito finora.

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

## 8. Deploy cloud (D4) — FATTO 2026-07-10 (Render + Supabase)
Attività **manuale dell'utente**, fuori da una sessione Claude Code; documentata qui il
2026-07-10 su richiesta esplicita per allineare `Docs/`/`memory/` allo stato reale.

- **GitHub:** repo creato e pushato — `https://github.com/Peros68/FinancialWatchdog`
  (`origin` già impostato nel working tree locale, verificato).
- **Render Web Service:** live — `https://financialwatchdog.onrender.com`.
  Health: `https://financialwatchdog.onrender.com/api/health`.
- **Database:** **Supabase Free PostgreSQL** è il DB effettivo, collegato via `DATABASE_URL`
  nelle env var di Render. Un **Render Postgres** (`financialwatchdog-db`) creato per prova
  **non è in uso** — resta da decidere se dismetterlo (vedi §5).
- **Env var Render:** `NODE_ENV`, `DATABASE_URL`, `FINNHUB_API_KEY` configurate (valori mai
  stampati).
- **Keepalive:** `.github/workflows/keepalive.yml` (già in `main`, commit `e3b23b9`) — ping
  `/api/health` ogni 10 min, Lun-Ven 07:00-21:50 UTC (copre mercato Italia+USA in entrambi i
  regimi DST). Repository variable `RENDER_HEALTH_URL` configurata su GitHub; run manuale del
  workflow "Keep Render awake (market hours)": **Success**.
- **Non verificato in questa sessione:** se lo schema Drizzle (incl. tabella `drawings` del
  Modello C, §6 di questo documento) è stato applicato su Supabase — nessun `db:push` puntato
  a Supabase è stato eseguito qui (fuori scope di questa sessione di allineamento doc).
