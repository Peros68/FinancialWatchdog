# WORK LOG — FinancialWatchdog

Registro cronologico degli incrementi. Voce più recente in alto.

## 2026-07-10 — Authorization Judge v2 implementato (F.2/F.3) + avvio canary (F.4)

**Tipo:** infrastruttura autorizzazioni (nessuna modifica al codice applicativo).

**Fatto:**
- Implementata la v2 del Judge secondo `Docs/PROPOSAL_AUTH_JUDGE_V2.md`: P1 quote-masking
  (le stringhe quotate sono dati, non azioni), P2 classificazione per segmento con
  max-severity, P3 cwd effettivo via `cd`, P4 credenziali per azione+target, P5 rete per
  host estratti (localhost=safe, remoto=ask), P6 scratchpad di sessione fidato, D-3
  deterministico (cancellazioni su zone di sistema → deny), G-1a giudice IA SPENTO
  (default-ask), G-3b `npm install` da solo lockfile / `npm ci` = safe, G-4a force-push →
  deny, G-5b `git add -A/.` chiede solo se esiste un `.env` reale non ignorato (fail-closed
  se cwd non verificabile).
- File modificati (SOLO questi 3): `~/.claude/hooks/auth_common.py`,
  `~/.claude/hooks/authorization_judge.py`, `~/.claude/authorization_policy.json`.
  Backup v1 integro in `~/.claude/hooks/backup/2026-07-07/` (rollback = ripristino dei 3 file).

**Verifiche:** baseline v1 50/50 (suite `authorization_cases.jsonl` certificata sul
comportamento reale PRIMA delle modifiche); sviluppo su copie in scratchpad con harness
50/50 + smoke-test 23 comandi del flusso quotidiano; selftest ufficiale
`_selftest_v2.py --target v2` → **50/50 PASS**. Log del selftest rediretto su
`authorization_log_selftest.jsonl` (P8): log di produzione pulito.

**Canary F.4 avviato (2026-07-10):** 2-3 giorni di lavoro normale; a fine giornata audit
del log (ask residue fondate, SAFE emesse dalle regole nuove, zero invocazioni ai-judge).
Procedura, metriche e criteri di rollback in `memory/policy-judge-v2.md`. Primo giro:
`npm run check` 0 errori · Vitest 89/89, auto-approvati dal v2 senza prompt.

## 2026-07-06 — Modello C: drawings persistenti + ri-proiezione alert 08:00 Italia

**Tipo:** lavoro applicativo su decisione utente ("C piena": tutti i disegni persistenti nel DB,
anche non armati; alert collegati via `alertId`; ricalcolo dinamico server-side alle 08:00
Europe/Rome). **Schema esteso ma `db:push` NON eseguito** (in attesa di conferma utente):
su Postgres la tabella `drawings` non esiste ancora; su MemStorage tutto già operativo.

**Schema (`shared/schema.ts`):**
- Nuova tabella `drawings`: `userId` (FK cascade), `symbol`, `kind` (`horizontal|trend|vertical`),
  ancore `aTime/aPrice/bTime/bPrice` (2 punti tempo+prezzo; orizzontale = prezzi uguali;
  verticale = solo `aTime`), `alertId` (FK su alerts, **on delete set null** = disarmo
  automatico), `createdAt`. NESSUNA modifica alle tabelle esistenti.
- `insertDrawingSchema` (kind enum, `z.coerce.date()` sulle ancore ISO, superRefine per-kind),
  `updateDrawingSchema` (ancore + `alertId` nullable). Tipi `ChartDrawing/InsertDrawing/UpdateDrawing`.

**Server:**
- `storage.ts`: `getDrawings(userId, symbol?)`, `getDrawing`, `createDrawing`, `updateDrawing`,
  `deleteDrawing`, `getArmedDrawings()` su Mem+Database. `MemStorage.deleteAlert` replica il
  set-null della FK (parità di comportamento).
- `alertReprojector.ts` (nuovo): `projectPriceAt(a,b,when)` pura (lineare NEL TEMPO, ancore
  coincidenti → prezzo di A); `reprojectOnce(deps, only?)` — per ogni drawing armato con alert
  attivo/non scattato ricalcola `targetPrice` a *adesso* e ri-deriva `alertType` da 1 quote per
  simbolo (quote fallita → target aggiornato, direzione mantenuta); `msUntilNextHourInTz` pura
  (Intl, DST-aware); `startDailyReprojector(deps, 8, "Europe/Rome")` con catch-up allo start e
  catena setTimeout unref'd.
- `routes.ts`: `GET /api/drawings/:symbol` · `POST /api/drawings` · `PUT /api/drawings/:id`
  (se armato → ri-proiezione immediata dell'alert, best-effort) · `DELETE /api/drawings/:id`
  (cancella anche l'alert collegato).
- `index.ts`: `startDailyReprojector` accanto allo scheduler 60s (stesso gate
  `ALERT_CHECK_INTERVAL_MS`).

**Client:**
- `chart-drawings.ts`: `timeToIndex`/`indexToTime` puri (interpolazione dentro la serie,
  estrapolazione col passo MEDIANO fuori — robusto ai weekend).
- `drawingsApi.ts` (nuovo): transport CRUD `/api/drawings` (`DrawingRow` wire type, tempi ISO).
- `stock-chart.tsx`: hydration dal DB per simbolo (una volta, quando serie+righe pronte);
  reset su cambio simbolo; re-indicizzazione su cambio timeframe (i disegni restano ancorati
  ai loro ISTANTI); `persistNew` su creazione, `persistAnchors` su drag-end/commit prezzo
  (il SERVER ri-proietta l'alert collegato = unica fonte di verità; `syncAlertFor` resta solo
  come fallback per linee non persistite); `removeDrawing` → DELETE drawing (cascata alert);
  campanella → POST alert + `PUT {alertId}` / DELETE alert (disarmo via FK). Tipi locali con
  `dbId` + tempi canonici (`times`/`time`).

**Test (`npm test` 63 → 89):** `alert-reprojector.test.ts` (13: proiezione, alertTypeFor,
msUntilNextHourInTz estate/inverno/limite, reprojectOnce trigger/no-op/skip/quote-failure/dedup+only),
`drawings-api.test.ts` (5: CRUD+validazioni per-kind, cascata delete, disarmo su delete alert),
`chart-drawings.test.ts` (6: mapping tempo⇄indice incl. gap e round-trip), storage +2 (drawings CRUD,
armed+set-null). Nei test API l'armamento avviene via storage per non colpire la rete.

**Verifiche:** `npm run check` 0 · `npm run lint` 0 · `npm test` **89/89** · `npm run build` OK.

**Prossimo passo (gate utente):** `npm run db:push` per creare la tabella `drawings` su Postgres.

## 2026-07-06 — Alert fase 2 (server-side): scheduler + `triggeredAt` persistente

**Tipo:** lavoro applicativo autonomo (D3 fase 2, richiesto dall'utente). Nessuna nuova
dipendenza, nessuna modifica schema (la colonna `alerts.triggeredAt` esisteva già), no deploy,
`.env` non toccato.

**Codice:**
- `server/storage.ts` — `IStorage.getActiveAlerts()`: alert con `isActive=true` e
  `triggeredAt IS NULL`, di TUTTI gli utenti. Implementata in MemStorage (filter) e
  DatabaseStorage (`and(eq(isActive,true), isNull(triggeredAt))`).
- `server/alertScheduler.ts` (nuovo) —
  - `shouldTrigger(alert, price)` pura, STESSA semantica del client v1
    (`above`: price ≥ target · `below`: price ≤ target · mai su prezzo null/≤0/NaN o tipo ignoto);
  - `checkAlertsOnce(deps)`: legge gli alert attivi, 1 quote per simbolo distinto (deduplicato),
    salva `triggeredAt = now` sugli alert colpiti. Errori quote per-simbolo NON fatali (gli alert
    restano eleggibili al giro dopo). `isActive` NON viene toccato (resta interruttore utente);
    il trigger è one-shot perché il filtro esclude `triggeredAt` valorizzato. Per riarmare:
    azzerare `triggeredAt` (PUT).
  - `createAlertScheduler(deps, intervalMs)`: start/stop + `runOnce`, passate MAI sovrapposte
    (tick saltato se una è in volo), timer `unref()` (non tiene vivo il processo), primo pass
    immediato allo start. Dipendenze iniettate (`storage`, `getQuote`, `now`, `log`) → testabile.
- `server/index.ts` — allo start del server: intervallo da `ALERT_CHECK_INTERVAL_MS`
  (default 60 000 ms; valori <1000 o non numerici = disabilitato), `getQuote` = facade
  `marketData.quote` (Yahoo default, funziona senza key).

**Test (`npm test` 52 → 63):**
- `tests/alert-scheduler.test.ts` (nuovo, 10): semantica `shouldTrigger` (4), `checkAlertsOnce`
  (trigger+preservazione isActive, skip inattivi/già scattati senza quote, dedup 1 quota/simbolo,
  quote fallita → alert riprovabile), scheduler (start/stop + primo pass, no-overlap).
- `tests/storage.test.ts` +1: `getActiveAlerts` filtra inattivi/già scattati, include tutti gli utenti.

**Verifiche:** `npm run check` 0 · `npm run lint` 0 · `npm test` **63/63** · `npm run build` OK.

**Nota modello (da chiarire con l'utente, sessione in corso):** gli alert da trendline sono
salvati come prezzo STATICO (proiezione sull'ultima colonna al momento dell'armamento/drag);
lo scheduler non conosce la geometria della retta. Vedi decisione aperta in HANDOVER §5.

## 2026-07-05 — PostgreSQL locale attivato (D1/D4): pg + Docker + schema arricchito + persistenza verificata

**Tipo:** infrastruttura + schema DB (piano B approvato dall'utente). Stop-condition gestite:
nuova dipendenza `pg`, avvio Postgres locale via Docker, `db:push` (creazione schema), seed.

**Dipendenza (approvata):**
- `+ pg ^8.13.1` (driver node-postgres) e `+ @types/pg ^8.11.10`. `@neondatabase/serverless`
  RESTA per un futuro deploy Neon (D4). `npm install` eseguito.

**Codice:**
- `server/db.ts` — da `@neondatabase/serverless`/`neon-serverless` a **node-postgres**
  (`pg.Pool` + `drizzle-orm/node-postgres`), inizializzazione lazy invariata. **Fix runtime**:
  `pg` è CommonJS → sotto ESM il named import `{ Pool }` non è risolvibile a runtime
  (tsc/vitest passavano perché non istanziano il DB); corretto in `import pg from "pg"; const { Pool } = pg;`.
- `shared/schema.ts` — **schema arricchito**: `alerts.triggeredAt` (timestamp nullable, per
  alert fase 2); `watchlist_items` + `currency` (nullable) + `createdAt` + unique
  `watchlist_symbol_unique(watchlist_id, symbol)`; FK `watchlists/items/alerts` con
  `onDelete: "cascade"`. `insertWatchlistItemSchema` include `currency` opzionale.
- `server/storage.ts` — `MemStorage` adeguato ai nuovi tipi `$inferSelect` (`currency`/
  `createdAt` su item, `triggeredAt: null` su alert): necessario per il type-check.
- `server/seed.ts` (**nuovo**) — seed **idempotente**: utente `default` (id=1, usato da
  `routes.ts` `defaultUserId`) + 3 watchlist demo; risolve il bug FK su DB vuoto. Script `db:seed`.
- `docker-compose.yml` (**nuovo**) — `postgres:16-alpine`, porta 5432, credenziali
  `finwatch/finwatch/finwatch`, volume `finwatch-pgdata`, healthcheck.

**Attivazione e verifica LIVE:**
- `docker compose up -d` → container `finwatch-postgres` healthy.
- `db:push` → "Changes applied" (tabelle create). `db:seed` → utente + 3 watchlist;
  **idempotenza** verificata (re-run → "already exists").
- Fermato il vecchio dev server orfano su :5000 (pre-`.env`, MemStorage) e riavviata l'app →
  boot log `[storage] DATABASE_URL detected — using DatabaseStorage (PostgreSQL)`; `/api/watchlists`
  restituisce i 3 record con `createdAt` = ora del seed (non l'uptime) → **lettura da Postgres**.
- **CRUD + cascade** (API live + `psql` diretto): create watchlist + 2 item + alert →
  righe in Postgres (`watchlists=1/items=2/alerts=1`); DELETE watchlist → item spariti
  (API `[]` e Postgres `0`) = **cascade OK**; cleanup alert; **zero residui**. Dati solo test.
- **Persistenza confermata**: watchlist, item e alert sono ora persistenti su PostgreSQL.

**DATABASE_URL (locale Docker):** `postgres://finwatch:finwatch@localhost:5432/finwatch`
(inserito dall'utente in `.env`; passato inline ai comandi durante la verifica, mai stampato).

**Esito:** `check` 0 · `test` **52/52** · `build` OK.

**Rimasto:** `.env.example` blocco Docker (guard `.env`, da aggiungere a mano); alert fase 2
(scheduler server-side + `triggered_at` già in schema); rename watchlist; deploy (D4).

## 2026-07-04 — Timeframe grafico: default 1 anno + scelte rapide 15min/1g/1s/1m/1a/5A

**Tipo:** tweak frontend (`stock-chart.tsx`, no deps/schema).

- **Default** della vista impostato a **1 anno** (`selectedTimeframe = "1Y"`).
- Aggiunto **5 anni** (`5Y` → interval `1wk`, range `5y`).
- **Scelte rapide** ridefinite: `15min · 1g · 1s · 1m · 1a · 5A`
  (valori `15m / 1D / 1W / 1Mo / 1Y / 5Y`).
- `getYahooParams` riscritto per i nuovi token (1g=intraday 5m/1d, 1s=60m/5d, 1m=1d/1mo,
  1a=1d/1y, 5A=1wk/5y); dropdown "altro" allineato con etichette italiane + Anno/5 Anni.
- Esito: `check` 0 · `lint` 0 · `test` 39/39 · `build` OK.

## 2026-07-04 — Correzione visualizzazione grafico (candele reali + area + toggle unico)

**Tipo:** feature/bugfix frontend (no deps, no schema). Riferimento visivo: `Docs/img/`
(`Candele.jpg`/`Candele sbagliato.jpg`, `Lineare.jpg`/`Lineare_sbagliato.jpg`).

Difetti corretti in `client/src/components/stock-chart.tsx`:
- **Candele finte → candele OHLC reali.** Prima: `<Bar dataKey="close">` (barre piene dal
  fondo, come il volume) + due `<Line>` continue high/low. Ora: `<Bar dataKey="highLow">`
  (range [low,high]) con **shape custom** `Candle` che disegna stoppino high→low e corpo
  open→close, **verde** se close≥open / **rosso** altrimenti.
- **Linea → area.** `LineChart`+`Line` sostituiti da `AreaChart`+`Area` con gradiente sotto
  la linea (come l'esempio corretto).
- **Toggle unico.** I due pulsanti separati Line/Candles sono ora **un solo tasto** che alterna
  le due viste (mostra icona+etichetta della vista verso cui si passa: "Candele"/"Linea").
- **Y domain condiviso** calcolato dai veri high/low (stoppini mai tagliati).
- Rimossa la finta "price line" fissa a `top:50%` (non legata al prezzo reale — stesso vizio
  dei mock già eliminati nel blocco 5).

**Geometria pura + test:** logica estratta in `client/src/lib/candles.ts`
(`computeCandleGeometry`, colori); `tests/candles.test.ts` (8 test: colore up/down, stoppino
full-range, corpo in scala, doji ≥1px, no divisione per zero, larghezza corpo).

**Esito:** `check` 0 · `lint` 0 · `test` **39/39** · `build` OK.

## 2026-07-04 — Versionamento del working tree (piano commit)

**Tipo:** solo versionamento (nessuna modifica al codice applicativo).

- Ripreso il punto in pausa ("piano commit"): il working tree (~33 voci, blocchi 1-8 +
  rimozione dead-code) era interamente non committato. Verificato verde prima di committare:
  `check` 0 · `lint` 0 · `test` **31/31** · `build` OK.
- Impostata identità git **inline** per-commit (`-c user.email/-c user.name`), senza scrivere
  la config globale (evita prompt del Judge).
- Creati **5 commit logici** su `main`:
  1. `17acf6d` Add quality tooling: Vitest, ESLint, env template
  2. `e8ac643` Stabilize server and add provider-agnostic market-data layer
  3. `5f91bc7` Migrate client to local backend and clean up screens
  4. `aec5566` Add Vitest test suite (31 tests)
  5. `1901a60` Add project docs, operating memory and agent team
- `.gitignore` esteso: ignora `.local/` (stato interno Claude Code) e `.claude/settings.local.json`
  (settings per-dev). Non committati: quei due, e lo screenshot orfano non referenziato
  `attached_assets/image_1782028596346.png` (lasciato non tracciato).

## 2026-06-21 — Chiusura sessione

**Tipo:** chiusura (solo documentazione, nessuna modifica al codice applicativo).

- Eseguita checklist fine incremento: `check` 0 · `lint` 0 · `test` 31/31 · `build` OK.
- Creato `Docs/HANDOVER.md` (ripresa sessione: avvio/verifica, architettura, decisioni aperte,
  prossimo incremento PostgreSQL, vincoli operativi).
- Allineati `PROJECT_STATUS.md`, `CHANGELOG_DECISIONS.md`, `memory/MEMORY.md`.
- **Versionamento:** branch `main`, ~33 voci non committate, nessun commit creato in sessione
  (ultimo `b8f54e0`). Commit da decidere con l'utente.
- Stato: sessione chiusa, progetto verde. Prossimo grande incremento: **PostgreSQL (D1/D4)**.

## 2026-06-21 — Blocco 8: fundamentals() (dati fondamentali semplici) + caricamento .env

**Tipo:** feature applicativa autonoma. No nuove dipendenze, no schema DB, no Postgres,
no statements completi, no crumb Yahoo, no provider a pagamento, no widget TradingView.

**Dati fondamentali (composizione, non fallback):**
- `shared/schema.ts`: nuove interfacce `Fundamentals` + `DividendEntry` (solo tipi, non tabelle).
- `MarketDataProvider.fundamentals(symbol)` (interfaccia) → ogni provider riempie ciò che può.
- **Yahoo** (`yahooProvider`): `sector`/`industry` da `/v1/finance/search`, **dividendi** da
  `/v8/finance/chart?events=div` (entrambi **senza crumb**). Helper puri:
  `extractYahooSectorIndustry`, `mapYahooDividends`.
- **Finnhub** (`finnhubProvider`, solo se key): `marketCap` (profile2), `EPS`/`P/E`/`P/B`/`P/S`/
  `dividendYield` (`/stock/metric`). Helper puro `mapFinnhubFundamentals` (+ `pickNumber`).
- **Facade**: `marketData.fundamentals()` compone Yahoo + Finnhub (merge "riempi se vuoto"),
  `sources[]` traccia chi ha contribuito. Helper puro `mergeFundamentals`. Statements esclusi.
- Route `GET /api/stocks/fundamentals/:symbol`.
- Client: sezione **"Dati fondamentali"** in `stock-detail.tsx` (settore/industria/market cap/
  P-E/P-B/P-S/EPS/div yield + dividendi recenti + fonti), con fallback "—" pulito.

**Caricamento `.env` (abilita la key Finnhub):**
- Scoperto che l'app non leggeva `.env` (nessun dotenv/--env-file) → la `FINNHUB_API_KEY` non
  veniva mai usata. Aggiunto `server/loadEnv.ts` (`process.loadEnvFile`, **built-in Node, no dep**),
  importato per primo in `server/index.ts` (prima dei provider). Best-effort se `.env` assente.

**Conversione TradingView:** lasciata come utility pura (`toTradingViewSymbol`), NON cablata
(nessun widget), documentata per uso futuro.

**Test:** `tests/fundamentals.test.ts` (extractYahooSectorIndustry, mapYahooDividends,
mapFinnhubFundamentals, mergeFundamentals).

**Verifica runtime LIVE (temp `_tmp_` poi rimossi):**
- Solo Yahoo (no key nel processo): sector/industry/dividendi, `sources:["yahoo"]`, marketcap/EPS null.
- Con key (via loadEnv): + marketCap ($4.38T), P/E 35.71, P/B 50.98, P/S 9.70, EPS 8.27,
  divYield 0.36%, `sources:["yahoo","finnhub"]`. La key non è mai stata stampata.

**Esito:** `check` 0 · `lint` 0 · `test` **31/31** · `build` OK.

## 2026-06-21 — Blocco 7: architettura provider dati di mercato (Yahoo default + Finnhub opzionale)

**Tipo:** feature applicativa autonoma. No nuove dipendenze (fetch nativo), no schema, no Postgres,
no servizi esterni nuovi (Yahoo/Finnhub già in uso), nessuna chiave nel frontend.

**Server (nuovo layer provider-agnostic):**
- `server/marketData/types.ts` — interfaccia `MarketDataProvider` + tipi preferenza.
- `server/marketData/yahooProvider.ts` — **default, senza key**: search (`/v1/finance/search`),
  quote (da `meta` di `/v8/finance/chart`), profile (search+meta), chart; mapper puri +
  `toTradingViewSymbol` (dalla logica di `Docs/Yahoo7.html`).
- `server/marketData/finnhubProvider.ts` — logica Finnhub spostata qui; `available = !!FINNHUB_API_KEY`.
- `server/marketData/index.ts` — facade `marketData` + `resolveChain()` (Yahoo default, Finnhub
  solo se key presente; **fallback automatico** su errore/empty). Log avvio espone solo `available:boolean`.
- `server/settings.ts` — preferenza provider in-memory (default `yahoo`), no schema.
- `server/routes.ts` — `/api/stocks/*` ora delegano al facade; `/api/stocks/chart` normalizzato e
  funzionante (non più solo Finnhub candle); nuovi `GET/PUT /api/settings`; `/api/yahoo/chart` invariato.

**Client:**
- `client/src/pages/settings.tsx` (nuova) — scelta provider (Yahoo/Auto/Finnhub), Finnhub disabilitato
  se key assente; nota "chiavi solo server-side". Rotta `/settings` + voce in navbar.

**Test:** `tests/marketData.test.ts` (resolveChain, mapper Yahoo, toTradingViewSymbol),
`tests/settings-api.test.ts` (GET default yahoo, PUT auto, invalid→400, finnhub gated).

**Verifica runtime LIVE (Yahoo, senza key, via test temporaneo `_tmp_` poi rimosso):**
- search `apple` → 200, 7 risultati (AAPL/Apple Inc./Equity/NASDAQ);
- quote AAPL → 200 (currentPrice/change/percent/high/low/open/previousClose valorizzati);
- profile AAPL → 200 (name/exchange/currency ok; country/marketCap degradati come da design Yahoo).

**Esito:** `check` 0 · `lint` 0 · `test` 23/23 · `build` OK. **L'app ora funziona senza Finnhub key**
(Yahoo default); Finnhub diventa opzione/fallback selezionabile da Settings quando la key è presente.

## 2026-06-21 — Consolidamento finale (sviluppo applicativo congelato)

**Tipo:** solo documentazione/memoria, nessuna modifica al codice.

- Allineati `PROJECT_STATUS.md` (stato reale: file legacy eliminati, test 11/11, fase congelata,
  riepilogo finale con sezioni: cosa funziona / cosa richiede la key / cosa resta su MemStorage /
  cosa serve per PostgreSQL / prossimi step), `CHANGELOG_DECISIONS.md`, `memory/MEMORY.md`.
- **Sviluppo applicativo congelato** su richiesta utente: prossimo grande incremento = PostgreSQL
  (D1/D4), da decidere. Nessun deploy, nessuna modifica schema, nessun PostgreSQL avviato.

**Stato verificato (ultimo run blocco 6):** `check` 0 · `lint` 0 · `test` 11/11 · `build` OK.

## 2026-06-21 — Blocco 6: monitoraggio attivo alert v1 (client-side)

**Tipo:** lavoro applicativo autonomo (D3 fase 1 estesa). No persistenza/scheduler/schema/Postgres/deps.

- `client/src/lib/alertsApi.ts`: aggiunta `isAlertTriggered()` pura — "above" → price ≥ target,
  "below" → price ≤ target, false se price null o tipo sconosciuto.
- `client/src/pages/alerts.tsx`:
  - **polling** quote ogni 30s (`refetchInterval: 30000`);
  - **evidenza visiva** quando il target è raggiunto (bordo/ring verde + badge "🎯 Target raggiunto");
  - **avviso sonoro** semplice via Web Audio API (nessuna dipendenza), emesso una sola volta
    quando un alert passa a "raggiunto" (tracking via `useRef` dei simboli già scattati);
  - best-effort sull'audio (le policy autoplay del browser possono richiedere interazione).
- `tests/alerts-mapping.test.ts`: +4 test per `isAlertTriggered` (above/below/null/tipo ignoto).

**Caratteristiche v1 (come richiesto):** nessun `triggered_at`, nessuno scheduler backend,
nessuna modifica schema, nessun PostgreSQL. Interamente **reversibile** (logica isolata in
`alertsApi.ts` + pagina Alerts).

**Verifiche:** `npm run check` 0 · `npm run lint` **0** · `npm test` **11/11** · `npm run build` OK.

## 2026-06-21 — Blocco 5: toolbar onesta + delete watchlist + rimozione file legacy

**Tipo:** lavoro applicativo autonomo (decisioni utente recepite; no PostgreSQL/schema/deps).

- **Toolbar grafico (`stock-chart.tsx`) semplificata e veritiera**: rimossi indicatori mock
  RSI/MA20/MA50, pulsanti Save e Fullscreen (senza handler) e strumenti di disegno
  decorativi. Restano: timeframe (rapidi + dropdown), tipo grafico Line/Candles, **toggle
  Volume reale**, pulsante Alert. Rimosso stato/icone non più usati.
- **Eliminazione watchlist (`watchlist.tsx`)**: pulsante "Elimina" con conferma `AlertDialog`,
  via `DELETE /api/watchlists/:id` (endpoint esistente, cascade item in MemStorage). Rename
  rinviato (richiede nuova API).
- **File legacy eliminati**: `client/src/lib/legacy.ts`, `client/src/lib/legacyAlertApi.ts`
  (dead-code, nessun riferimento residuo). D2 chiusa anche a livello sorgente.

**Verifiche:** `npm run check` 0 · `npm run lint` **0** · `npm test` **7/7** · `npm run build` OK.

## 2026-06-21 — Blocco 4: completamento legacy + screens + robustezza + lint 0

**Tipo:** lavoro applicativo autonomo (senza PostgreSQL/schema/nuove deps).

**Legacy / dead code:**
- D2-bis attuata: rimosso il toggle watchlist esterno dalla pagina Alerts; `legacy.ts` e
  `legacyAlertApi.ts` marcati dead-code orfani (nessun riferimento esterno a runtime).

**Qualità / lint:**
- `server/routes.ts`: 12 `catch (error)` inutilizzati → `catch`; commento sull'endpoint
  `/api/stocks/chart` (Finnhub premium, non usato dalla UI). Param non usati → `_req`.
- `use-toast.ts`: disable mirato. **ESLint: da 28 warning → 0.**

**Screens (pulsanti collegati + robustezza):**
- `client/src/pages/watchlist.tsx`: "New Watchlist" ora apre un dialog e crea via
  `POST /api/watchlists`; rimozione item via `DELETE /api/watchlists/items/:id` (icona Trash);
  rimossa la colonna prezzo fittizia "--" (dato fasullo).
- `client/src/pages/stock-detail.tsx`: Star collegata al `WatchlistModal` (riuso flusso
  canonico con name/exchange dal profilo); formattazione numerica robusta (`fmt`, niente
  throw su campi mancanti).

**Test:**
- `tests/watchlist-api.test.ts` (nuovo): lifecycle watchlist (create→add→list→dup→remove) +
  alerts create/list, su app a porta effimera (no dev server, no Finnhub, no porta 5000).
  **Suite: 7/7.**

**Verifiche:** `npm run check` 0 · `npm run lint` **0** · `npm test` **7/7** · `npm run build` OK.

## 2026-06-21 — Blocco 3: baseline qualità + migrazione alert + team agenti

**Tipo:** lavoro applicativo autonomo (decisioni utente D-test/D1-D4/D2/D-secret/D-naming recepite).

**A-B. Baseline qualità + test:**
- Aggiunte dev-deps approvate: `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`.
- Script: `test`, `test:watch`, `lint`, `lint:fix`. Config: `vitest.config.ts`, `eslint.config.js`.
- Test: `tests/health.test.ts` (integration `/api/health` su porta effimera via `registerRoutes`,
  niente dev server manuale), `tests/storage.test.ts` (MemStorage watchlist+items cascade, alerts CRUD),
  `tests/alerts-mapping.test.ts` (`mapDbAlertToUi`).

**C-D. Migrazione alert → backend locale (D2), MemStorage, no schema:**
- `client/src/lib/alertsApi.ts` (nuovo): `fetchLocalAlerts()` da `/api/alerts` + prezzo via
  `/api/stocks/quote/:symbol` (null se assente); `mapDbAlertToUi()` puro.
- `client/src/pages/alerts.tsx`: consuma `/api/alerts` (stessa queryKey di `AlertModal` →
  incoerenza risolta), guardie prezzo/distanza assenti, layout invariato.
- `client/src/components/alert-chart.tsx`: chart via proxy Yahoo locale + alert info da `/api/alerts`;
  rimosso ogni riferimento esterno.
- `client/src/lib/legacyAlertApi.ts` (nuovo): unico punto che usa `borsa-alert.onrender.com`
  (solo toggle watchlist della pagina Alerts), isolato per rimozione progressiva.

**Setup mancante completato:** creata la gerarchia agenti `.claude/agents/` (`chief-architect`,
`developer`, `test-engineer`) tarata sul progetto.

**Comandi eseguiti:** `npm install -D` (deps approvate) · `npm run check` (verde) ·
`npm test` (5/5) · `npm run lint` (0 errori, warning baseline) · `npm run build` (verde) ·
smoke-test locale `POST/GET /api/alerts` + `/api/health` → OK.

**Note autorizzazioni:** corretta la policy globale per i curl locali (anche composti/senza schema).
`.claude/settings.local.json` NON modificato di proposito (file protetto + inutile: l'autonomia sui
file di progetto è già data dalla regola workspace globale). Vedi `memory/MEMORY.md`.

**Aperti:** toggle watchlist pagina Alerts ancora su legacy (serve decisione su quale watchlist
locale mappare); prezzi alert assenti finché manca `FINNHUB_API_KEY` (in carico utente).

## 2026-06-21 — Blocco 2: groundwork storage + centralizzazione legacy + policy

**Tipo:** miglioramenti autonomi senza nuove dipendenze/schema/servizi (modalità continuativa).

**File modificati (progetto):**
- `server/storage.ts` — **storage factory**: `createStorage()` seleziona `DatabaseStorage`
  se `DATABASE_URL` è presente, altrimenti `MemStorage` (default locale invariato). Predispone
  D1/D4 senza scegliere/configurare il DB e senza cambiare comportamento finché manca la var.
- `client/src/lib/legacy.ts` — **nuovo**: `LEGACY_ALERT_API_BASE` (override via
  `VITE_LEGACY_ALERT_API_BASE`), punto unico per il backend esterno (prep rimozione D2).
- `client/src/pages/alerts.tsx` + `client/src/components/alert-chart.tsx` — sostituiti i 6
  URL hardcoded `borsa-alert.onrender.com` con la costante centralizzata (comportamento invariato).
- `.env.example` — documentata la variabile opzionale `VITE_LEGACY_ALERT_API_BASE`.

**File modificati (globale, su richiesta utente, con sua approvazione):**
- `~/.claude/authorization_policy.json` — low-risk auto-allow: `.env.example/.template/.sample`
  (esclusi dai pattern `.env` protetti via lookahead), HTTP verso `localhost`/`127.0.0.1`
  (safe_allow, prima di ask_force). Invariata la protezione di `.env` reali, segreti e curl esterni.

**Comandi eseguiti:** `npm run check` (verde) · `npm run build` (verde) · `npm run dev` +
`curl /api/health` → 200 + `/api/watchlists` → seed corretto · validazione JSON policy (OK).

**Esito:** type-check/build/runtime verdi; storage factory logga `MemStorage` (no DATABASE_URL);
endpoint locali OK. Policy aggiornata e validata.

**Note:** chiuso un dev server orfano (PID 29760) che occupava la porta 5000 (EADDRINUSE).

**Decisioni aperte invariate:** test/lint (nuove deps), migrazione `DatabaseStorage` (Postgres
locale), migrazione alert D2, rotazione chiave Finnhub.

## 2026-06-21 — Blocco 1: stabilizzazione locale (sicurezza + cross-platform + bugfix)

**Tipo:** correzioni locali sicure e reversibili (no schema DB, no scelta/config DB, no nuove
dipendenze, no servizi esterni, no deploy, no cancellazioni, no riscritture grandi FE).

**File modificati:**
- `package.json` — script `dev`/`start` resi cross-platform (rimosso `NODE_ENV=` inline).
- `server/index.ts` — rilevamento ambiente robusto (dev via tsx / prod via dist); error
  handler non rilancia più dopo la risposta; rimosso `reusePort` (incompatibile Windows/Node 24).
- `server/db.ts` — inizializzazione **lazy** (Proxy): import senza crash quando manca
  `DATABASE_URL`; connessione creata solo al primo uso reale.
- `server/routes.ts` — rimossa API key Finnhub hardcoded (fallback → `""` + warning);
  aggiunto `GET /api/health`; guard su `watchlistId` non valido nella POST item.
- `server/storage.ts` — `DatabaseStorage.deleteWatchlist` ora cancella prima gli item
  (evita orfani/FK); fix tipi `MemStorage` (userId/watchlistId `?? null`).
- `server/vite.ts` — `allowedHosts: true as const` (fix tipo).
- `client/src/lib/finnhub.ts` — rimossa API key hardcoded (file non usato, evitato leak nel bundle).
- `client/src/pages/watchlist.tsx` — default watchlist spostato in `useEffect`; fix bug di
  precedenza `(!a || a.length === 0)`.
- `client/src/components/alert-chart.tsx` — `position: 'insideTopRight'` (fix tipo Recharts).
- `.gitignore` — ignora `.env*`; nuovo `.env.example` (documenta `FINNHUB_API_KEY`, `DATABASE_URL`).

**Cosa è stato corretto:** sviluppo locale rotto su Windows; crash all'avvio per `DATABASE_URL`
mancante; segreto in chiaro; mancanza endpoint di liveness; instabilità error handler; bug FE.

**Comandi eseguiti:** `npm install` (ripristino deps dichiarate) · `npm run check` (verde) ·
`npm run build` (verde) · `npm run dev` + `curl /api/health` → **200**.

**Esito:** type-check, build e runtime locali verdi; `/api/health` operativo; app parte senza DB.

**Non verificato:** endpoint `/api/stocks/*` (richiedono `FINNHUB_API_KEY`); percorso
`DatabaseStorage` (richiede `DATABASE_URL` locale, non ancora deciso); test automatici (assenti).

**Decisioni aperte rimaste:** baseline test/lint = nuove dipendenze (D-test, da approvare);
migrazione a `DatabaseStorage` subordinata a Postgres locale (D1/D4).

## 2026-06-21 — Setup progetto + analisi iniziale

**Tipo:** configurazione + analisi (sola lettura, nessuna modifica al codice app).

**Fatto:**
- Lette le specifiche `Docs/SPECIFICHE_PROGETTO_FinancialWatchdog.md` e i template
  AI-LAB (`CLAUDE_CODE_BOOTSTRAP.md`, `PROJECT_OPERATING_MODEL.md`).
- Applicata configurazione AI-LAB: creati `.claude/settings.local.json`,
  `Docs/` (PROJECT_STATUS, WORK_LOG, CHANGELOG_DECISIONS, Architecture/, img/),
  `memory/MEMORY.md`; copiati i due documenti di autorità in `Docs/`.
- Analisi backend/frontend → `Docs/Architecture/ANALISI_INIZIALE.md` (report §18).

**Verifiche eseguite:** lettura file di progetto (package.json, server/*, shared/schema.ts,
client/src). Nessun comando di build/test (fase di sola analisi).

**Esito:** struttura di progetto conforme al modello operativo AI-LAB; quadro tecnico chiaro.

**Non verificato:** runtime (`npm run dev`), build, type-check — rinviati al primo step di codice.

**Prossimo:** implementare `GET /api/health`; consolidare con l'utente le decisioni D1-D4.
