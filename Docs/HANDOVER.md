# HANDOVER — FinancialWatchdog

> Documento di ripresa sessione. Leggere PRIMA di riprendere, insieme a
> `PROJECT_STATUS.md`, `CHANGELOG_DECISIONS.md`, `WORK_LOG.md`, `memory/MEMORY.md`.

**Chiusura sessione:** 2026-06-21
**Stato qualità:** `npm run check` 0 · `npm run lint` 0 · `npm test` **31/31** · `npm run build` OK.

## 1. Stato in una riga
App "FinAlert" (React+Vite / Express+TS / Drizzle) stabilizzata e ampliata: storage in
memoria (MemStorage), dati di mercato **provider-agnostic** (Yahoo default, Finnhub
opzionale), schermate principali funzionanti, monitoraggio alert v1, dati fondamentali.
**Funziona anche senza chiavi**; con `FINNHUB_API_KEY` arricchisce i fondamentali.

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
  `DATABASE_URL`, `DatabaseStorage` (Postgres, **non attiva**) se presente. Dati volatili.
- **Market data**: `server/marketData/` (`types`, `yahooProvider`, `finnhubProvider`, `index`
  facade) + `server/settings.ts`. Route `/api/stocks/{search,quote,profile,chart,fundamentals}`
  delegano al facade; preferenza provider da `GET/PUT /api/settings` (pagina `/settings`).
  Chiavi solo server-side. `toTradingViewSymbol` = utility pura non cablata.
- **Alert**: backend locale `/api/alerts` (MemStorage); pagina Alerts con monitoraggio v1
  client-side (polling 30s, evidenza visiva + beep). Nessuno scheduler/notifica server-side.
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
- **PostgreSQL (D1/D4)** — prossimo grande incremento (vedi §6).
- **Statements fondamentali** (conto economico/stato patrimoniale/cash flow): fuori scope
  (crumb Yahoo fragile o tier Finnhub a pagamento) — decisione separata.
- **Monitoraggio alert fase 2** (server-side: scheduler + `triggered_at` + notifica): richiede schema.
- **Rename watchlist**: richiede nuova API.
- **Widget TradingView**: non integrato (solo util di conversione simboli).
- **Commit/versionamento** del lavoro non committato.

## 6. Prossimo incremento consigliato — PostgreSQL locale (D1/D4)
Passi (da concordare; comportano stop-condition: nuova dep driver + modifica schema):
1. Provisioning Postgres locale + `DATABASE_URL` in `.env` (la factory passa a `DatabaseStorage`).
2. Driver: valutare `pg` + `drizzle-orm/node-postgres` (l'attuale `@neondatabase/serverless` è cloud)
   → **nuova dipendenza** da approvare.
3. `npm run db:push` + eventuale adeguamento schema (mancano `currency`/`created_at` su items,
   `triggered_at` su alerts, unique `(watchlist_id, symbol)`) → **modifica schema** da approvare.
4. Script di seed idempotente (utente demo + watchlist) — `DatabaseStorage` non semina come MemStorage.
5. Verifica percorso `DatabaseStorage` (incluso cascade in `deleteWatchlist`).

## 7. Vincoli/preferenze operative (da rispettare)
- Lavorare solo nel workspace `C:\AI-LAB\FinancialWatchdog`. **Non** accedere a `~/.claude`
  salvo richiesta esplicita (policy Authorization Judge già configurata).
- Non inserire chiavi reali (le mette l'utente in `.env`); non stamparle/loggarle/committarle.
- `.env.example`/`.template`/`.sample`, `Docs/`, `memory/` = aggiornabili in autonomia.
- Stato/decisioni: documenti di autorità in `Docs/` + `memory/MEMORY.md` (prevalgono sulla chat).
