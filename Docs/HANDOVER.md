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
- ~~**Schema su Supabase**: non verificato~~ — **FATTO 2026-07-11**: `db:push` + `db:seed`
  eseguiti su Supabase (conferma utente), persistenza live verificata end-to-end (§9).
- ~~**Stella titolo → stato watchlist**~~ — **FATTO 2026-07-11**: nuovo hook
  `client/src/hooks/use-watchlist-membership.ts` (riusa `GET /api/watchlists` +
  `GET /api/watchlists/:id/items`, nessuna nuova API/dipendenza) espone, per simbolo,
  l'elenco watchlist con eventuale item già presente. `stock-detail.tsx`: stella gialla
  (`fill-yellow-400`) se il titolo è in almeno una watchlist. `watchlist-modal.tsx`: mostra
  **tutte** le watchlist con stato selezionato (stella gialla)/non selezionato (cerchio vuoto)
  per quel simbolo; click su una riga aggiunge (`POST .../items`) o rimuove
  (`DELETE /api/watchlists/items/:id`) direttamente, senza chiudere la modale (per poter
  toggleare più watchlist in sequenza).
- ~~**Intervalli grafico 3M e 6M**~~ — **FATTO 2026-07-11**: aggiunti alla barra timeframe di
  `stock-chart.tsx` (`quickTimeframes`/`allTimeframes`, valori `3Mo`/`6Mo`, range Yahoo
  `3mo`/`6mo`) e a `client/src/lib/chart-axis.ts` (`GRANULARITY["3Mo"|"6Mo"] = "day"`, stessa
  resa di `1Mo`). Ordine finale: `15m, 1H, 1G, 1S, 1M, 3M, 6M, 1A, 5A`. Test aggiunto in
  `tests/chart-axis.test.ts`.
- **Filtro Alert per simbolo/nome — CORRETTO 2026-07-11**: il filtro (aggiunto lo stesso
  giorno) ora cerca anche per **nome società**, non solo simbolo, riusando l'endpoint già
  esistente `GET /api/stocks/profile/:symbol` (stesso dato usato da Search Stocks/stock-detail,
  nessuna nuova dipendenza). `alertsApi.ts`: `UiAlert.name`, `fetchCompanyName`,
  `mapDbAlertToUi` esteso, predicato puro esportato `matchesAlertQuery` (testato in
  `tests/alerts-mapping.test.ts`) usato sia dal filtro sia (potenzialmente) altrove. La card
  alert ora mostra il nome reale della società al posto del placeholder `"{symbol} Stock"`.
- **Bug alert duplicati/orfani — FIX 2026-07-11** (dettaglio in `memory/MEMORY.md`): causa
  doppia — (1) `toggleArm` in `stock-chart.tsx` aggiornava lo stato armato in modo ottimistico
  prima della conferma server e ingoiava errori in silenzio, potendo lasciare alert orfani nel
  backend dopo un disarmo fallito seguito da un riarmo; (2) `key={alert.symbol}` in
  `alerts.tsx` non univoca quando più alert condividono simbolo, causando nodi DOM fantasma
  durante il filtro. Entrambi corretti (`key={alert.id}`; `toggleArm` aggiorna lo stato solo a
  conferma avvenuta, con toast d'errore sul fallimento del disarmo). I 2 record IBM
  duplicati/orfani già presenti nella MemStorage locale di test sono stati **cancellati
  2026-07-11** via `DELETE /api/alerts/:id` (id 1 e 2), solo storage locale, nessuna chiamata
  verso Render/Supabase.
- **Watchlist: bidone → stella — FATTO 2026-07-11**: in `client/src/pages/watchlist.tsx`,
  `WatchlistItemCard` mostra ora una stella gialla piena (coerente con lo stato "presente" già
  usato in `WatchlistModal`/Search Stocks) al posto dell'icona `Trash2`; click rimuove il
  titolo (stessa azione di prima). Il bidone resta solo sul pulsante "Elimina watchlist"
  (azione distinta, cancella l'intera watchlist).
- **Requisito mobile registrato 2026-07-11 (NON implementato — richiesta esplicita utente:
  prima proporre il miglioramento responsive minimo, NO app nativa/PWA per ora):** vista
  smartphone deve avere layout dedicato: header e testi più compatti, meno spazio verticale,
  grafico più grande. Riferimento visivo: `Docs/img/v1.jpeg` (stock-detail su schermo IBM) —
  problemi osservabili nello screenshot: (a) navbar "FinAlert" + card header (Back/stella/nome
  azienda troncato/prezzo) occupano gran parte della viewport prima del grafico; (b) barra
  timeframe **overflow orizzontale** (l'ultima voce "5A" è tagliata fuori schermo, non c'è
  wrap/scroll visibile); (c) il grafico vero e proprio resta compresso in poco spazio residuo.
  Nessuna implementazione fatta: da proporre un intervento responsive minimo (breakpoint
  mobile, non nuova app) prima di procedere.

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
- **Schema Supabase allineato: FATTO 2026-07-11** (§9) — `db:push` applicato, tutte e 5 le
  tabelle presenti incl. `drawings`.

## 9. Schema Supabase + persistenza live — VERIFICATO 2026-07-11
- **Verifica read-only pre-push**: script `_tmp_check_schema.mjs` (introspezione
  `information_schema`, nessuna scrittura) contro la `DATABASE_URL` Supabase di Render →
  **tutte e 5 le tabelle mancanti** (schema mai applicato a Supabase).
- **`db:push` + `db:seed` eseguiti dall'utente** (conferma esplicita, comando lanciato nel suo
  terminale per non far transitare `DATABASE_URL` in chat): `"Changes applied"`; seed → utente
  `default` (id=1) + watchlist "Tech Stocks"/"Blue Chips"/"Growth".
- **Verifica end-to-end live** (curl pubblici su `financialwatchdog.onrender.com`, script unico
  `_tmp_live_test.sh`): `GET /api/watchlists` → le 3 watchlist seed con `createdAt` = istante del
  seed mentre `uptime` risultava di soli 13s (riavvio a freddo del processo Render) → prova che i
  dati sopravvivono al riavvio, quindi storage reale = Supabase, non `MemStorage`. Round-trip
  scrittura/lettura: `POST /api/watchlists/1/items` (AAPL) e `POST /api/alerts` (AAPL above
  999.99) → rilette identiche su GET successive. Lasciati live come prova visiva per test manuale
  da browser (voce AAPL in "Tech Stocks" + alert AAPL).
- **Nota tecnica**: `POST /api/alerts` richiede `targetPrice` **numerico** (non stringa) nel body,
  altrimenti 400 Zod `invalid_type`.
