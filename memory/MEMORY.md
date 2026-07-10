# MEMORY — FinancialWatchdog (stato operativo)

> Memoria operativa del progetto (dentro il workspace, auto-approvata).
> Documenti di autorità in `Docs/`; prevalgono su questa memoria in caso di conflitto.

## Team di progetto (.claude/agents/)
- `chief-architect` — coordinamento, incrementi, decisioni aperte, doc/memory, stop-condition.
- `developer` — implementazione fullstack React/Vite + Express/Drizzle, bugfix, refactor minori.
- `test-engineer` — type-check, Vitest, lint, build, acceptance.
Asse 1 (funzionale) = team; Asse 2 (autorizzazioni) = Authorization Judge. Sono distinti:
gli agenti NON riducono i prompt del Judge.

## Pratiche anti-interruzione (apprese 2026-06-21)
- Per le verifiche usa i **test Vitest** (incluso `/api/health` integration) invece di
  avviare dev server manuali + curl: evita comandi `curl` e soprattutto i kill di processo.
- Se avvii `npm run dev` in background, fermalo con TaskStop e non accumulare istanze
  orfane su porta 5000 (i kill `Stop-Process` chiedono conferma e generano attriti).
- Non generare azioni che richiedono conferma se esiste un'alternativa equivalente.
- **NON modificare `.claude/settings.local.json`**: matcha `protected_file_patterns: .claude/settings`
  globale → genera prompt, ed è inutile (l'autonomia sui file di progetto è già data dalla regola
  globale `workspace_root: C:\AI-LAB`; il file locale non sovrascrive il Judge globale).
- I file di progetto (codice, Docs, memory, .claude/agents, test, package.json) si salvano SENZA
  prompt. Prompt solo su: ~/.claude globale, .env reali, Stop-Process/kill, nuove deps, deploy,
  schema DB, internet esterno. Mentre l'utente è via, evitare queste categorie.
- Per verificare il runtime usare `npm test` (il test integration su /api/health non richiede la
  porta 5000), così non serve `npm run dev` né kill di orfani.

## Identità progetto
- Path: `C:\AI-LAB\FinancialWatchdog` — app "FinAlert" importata da Replit.
- Web app fullstack: monitoraggio titoli, watchlist, grafici, alert di prezzo.
- Vincolo: NON riscrivere il frontend; migrare per micro-step testabili.

## Stack
React 18 + Vite + TS · Express + TS · Drizzle ORM (Postgres `pgTable`) · Neon ·
Finnhub + Yahoo proxy · porta 5000 (API + client serviti insieme).

## Stato attuale (2026-06-21)
- Setup AI-LAB completato; analisi iniziale fatta (`Docs/Architecture/ANALISI_INIZIALE.md`).
- Decisioni D1-D4 consolidate dall'utente (vedi sotto).
- **Blocco 1 stabilizzazione locale FATTO** (dettaglio in `Docs/WORK_LOG.md`):
  script cross-platform, `db.ts` lazy (parte senza `DATABASE_URL`), rimosso `reusePort`,
  rimossa API key Finnhub hardcoded, `GET /api/health`, fix error handler + `watchlist.tsx`
  + cascade `DatabaseStorage`, 6 errori `tsc` pre-esistenti risolti.
- **Blocco 2 FATTO**: storage factory `createStorage()` (MemStorage senza `DATABASE_URL`,
  DatabaseStorage con); modulo `client/src/lib/legacy.ts` (`LEGACY_ALERT_API_BASE`) e
  sostituiti i 6 URL hardcoded `borsa-alert.onrender.com`.
- **Verifiche verdi**: `npm run check`, `npm run build`, `npm run dev` + `/api/health` → 200,
  `/api/watchlists` → seed; log conferma `[storage] No DATABASE_URL → MemStorage`.
- **Storage reale = in memoria** (`MemStorage`) finché manca `DATABASE_URL`, seed:
  Tech Stocks / Blue Chips / Growth.
- **Alert**: pagina migrata sul backend locale `/api/alerts`. **D2-bis**: rimosso il toggle
  watchlist esterno (incoerente). **Nessun riferimento a `borsa-alert.onrender.com` a runtime**.
  `client/src/lib/legacy.ts` e `legacyAlertApi.ts` = dead-code orfani (rimozione finale: `rm`,
  lasciata all'utente per non generare prompt).
- Per i dati di mercato serve `FINNHUB_API_KEY` in `.env` (vedi `.env.example`); la chiave
  pubblica rimossa andrebbe **ruotata** lato account Finnhub.

## Ambiente
- Node v24 locale. `node_modules` installato. Porta 5000 (API + client).

## Comandi
`npm run dev` (ambiente auto-rilevato) · `npm run build` · `npm start` · `npm run check` (tsc, verde) ·
`npm run db:push` (richiede `DATABASE_URL`). NON esistono `db:seed` né test.

## Dati fondamentali (blocco 8)
- `fundamentals()` nel layer provider: Yahoo (sector/industry da search, dividendi da chart events,
  SENZA crumb) + Finnhub se key (marketCap/EPS/P-E/P-B/P-S/divYield via profile2+metric). Composizione
  (merge "riempi se vuoto"), `sources[]` traccia i contributori. Statements/crumb/TradingView esclusi.
- Route `GET /api/stocks/fundamentals/:symbol`; UI: sezione "Dati fondamentali" in stock-detail.
- Tipi `Fundamentals`/`DividendEntry` in shared/schema (solo TS, no tabella). Tipi puri testati.
- `toTradingViewSymbol` = utility pura NON cablata (no widget), per uso futuro.
- **`.env` ora caricato** da `server/loadEnv.ts` (`process.loadEnvFile`, built-in, no dep), importato
  per PRIMO in index.ts (prima dei provider che leggono process.env). Senza, la key non veniva letta.
- Verificato live: senza key sources=["yahoo"]; con key sources=["yahoo","finnhub"] (marketcap/EPS/multipli).
  Market cap Finnhub è in MILIONI (UI formatta in T/B/M). Key mai stampata.

## Provider dati di mercato (blocco 7)
- Layer provider-agnostic in `server/marketData/` (types/yahooProvider/finnhubProvider/index facade)
  + `server/settings.ts`. Default **Yahoo (senza key)**; **Finnhub opzionale/fallback** se key presente.
- `resolveChain(pref, finnhubAvailable)` pura: yahoo-first salvo pref 'finnhub' con key.
- `/api/stocks/*` → facade; `GET/PUT /api/settings`; pagina client `Settings` (rotta `/settings` + navbar).
- Chiavi SOLO server-side. Verificato live: search/quote/profile AAPL via Yahoo → 200.
- L'app **funziona senza Finnhub key**. Yahoo non espone country/marketCap (degradati).
- Porta 5000 può avere un dev server orfano (PID variabile): per i test runtime usare app su porta
  effimera via `registerRoutes` (vedi test), NON `Stop-Process` (chiede conferma).

## Stato schermate (blocco 4)
- Search: ok (dati Finnhub → serve key). Stock-detail: chart Yahoo (ok senza key), quote/profile
  Finnhub (serve key); Star → WatchlistModal collegata; formattazione robusta.
- Watchlist: create + remove collegati (endpoint locali); rimossa colonna prezzo fittizia.
  Mancano: prezzi live per item (Finnhub), rename/delete-watchlist UI (endpoint delete esiste).
- Alerts: su backend locale; prezzi via quote proxy (graceful se manca key). Toggle esterno rimosso.
  **Monitoraggio attivo v1 (client-side)**: polling 30s, evidenza visiva (badge/ring verde) e beep
  (Web Audio) al raggiungimento target. Logica trigger pura in `alertsApi.isAlertTriggered`.
  No triggered_at, no scheduler, no schema. Reversibile.
- Chart toolbar (stock-chart): SEMPLIFICATA — rimossi mock RSI/MA, Save, Fullscreen, disegno.
  Restano timeframe, toggle vista, Volume reale, Alert.
- **Grafico corretto (2026-07-04):** candele OHLC REALI (Bar dataKey=[low,high] + shape custom
  `Candle`, corpo open→close + stoppino high→low, verde/rosso); linea = `AreaChart` con gradiente;
  **tasto UNICO** che alterna linea↔candele (mostra la vista di destinazione). Y-domain dai veri
  high/low. Rimossa finta price-line a top:50%. Geometria pura in `client/src/lib/candles.ts`
  (`computeCandleGeometry`) + `tests/candles.test.ts`. Esempi visivi in `Docs/img/`.
- Watchlist: aggiunta ELIMINAZIONE watchlist (AlertDialog + DELETE /api/watchlists/:id). Rename TODO.
- File legacy ELIMINATI (legacy.ts, legacyAlertApi.ts). D2 chiusa anche a livello sorgente.
- **Grafico — timeframe + assi + linee alert disegnabili (2026-07-05):**
  - Label timeframe convenzione: minuti minuscolo (`15m`), dall'ora in su maiuscolo
    (`1H` `1G` `1S` `1M` `1A` `5A`). Aggiunto quick `1H` (value `1h`).
  - Asse X compatto/non affollato: `client/src/lib/chart-axis.ts` (`granularityFor`,
    `formatAxisTick`, `selectTicks`) — 5A→anni, 1A→mesi, 1G/1H→HH:mm; dataKey=`timestamp`
    (type category) + `ticks`/`tickFormatter`. Test `tests/chart-axis.test.ts` (9).
  - `ReferenceLine` tratteggiata sull'ultimo prezzo (label prezzo insideTopRight).
  - Nuova icona `PencilRuler` (dropdown) → **linea orizzontale** (cursore ns-resize a
    sinistra per scorrere il livello, tag prezzo a destra) e **linea inclinata a 2 punti**
    (anchor draggabili, preview rubber-band). Overlay SVG dentro il chart via Recharts
    `<Customized>` (scala da yAxisMap+offset; geometria in `client/src/lib/chart-drawings.ts`,
    puro). Ogni linea **arma un alert reale**: POST alla creazione, PUT al drag-end
    (prezzo proiettato al last col per il trend), DELETE alla rimozione. Nessuna modifica
    schema (riusa `/api/alerts` above/below). Verificato live: PUT /api/alerts sincronizza
    il target durante il drag.
  - **Rifiniture (2026-07-05, feedback utente):** (a) tick asse X distribuiti EQUAMENTE
    (even-by-index + dedup label consecutive; anno resta 1 per anno) — vedi test "spreads 1A".
    (b) Pill prezzo ultimo valore sul MARGINE DESTRO (fill=foreground/text=background, tema-aware,
    esempio `Docs/img/Livello prezzo.jpg`), rimossa la label sulla ReferenceLine. (c) Linea alert
    orizzontale più SOTTILE (strokeWidth 1) con tag prezzo a SINISTRA prima del selettore di
    scorrimento. (d) Linea trend estrapolata a TUTTA larghezza (i 2 anchor decidono solo
    l'inclinazione, clip al plot box), SENZA tag prezzo. (e) Tooltip: contrasto fix
    (labelStyle/itemStyle=foreground, bg=popover) + `formatTooltipLabel` con dettaglio maggiore
    del tick (es. 5A asse="2024" ma tooltip="5 gen 2024"; intraday aggiunge HH:mm).
  - **Rifiniture v2 (2026-07-05, feedback su `Docs/img/Attuale.jpg`):** i controlli della
    linea orizzontale sono FUORI dal grafico, in un MARGINE SINISTRO vuoto (`margin.left=LEFT_MARGIN=82`
    su AreaChart/ComposedChart/BarChart per allineare i plot), resi con `<foreignObject>` HTML:
    prezzo EDITABILE (`<input>` con buffer `editing`, live-update + commit su blur/Enter → PUT alert),
    selettore drag (GripHorizontal, handle "level") e × (X, elimina). Linea trend: × spostata
    sull'ESTREMITÀ SINISTRA (box.left, y clampata). Linee e handle ora BIANCHI (`DRAW_COLOR=#fff`).
    La linea orizzontale appare in PREVIEW mentre si posiziona (hover → preview tratteggiata) per
    precisione. Placement rect: onPointerMove aggiorna hover per ogni drawMode.
  - **Rifiniture v3 (2026-07-05):** (a) toggle Eye/EyeOff in toolbar (`showPriceGuides`) che
    nasconde/mostra INSIEME il tooltip (entrambi i chart) e la linea+pill del livello prezzo
    (davano fastidio mentre si disegna la trend). (b) I pallini di riposizionamento della trend
    ora sono AUTO-HIDE: nascosti di default, appaiono al click sulla linea (hit-line trasparente
    larga 12px con `pointerEvents:"stroke"` → `pokeTrend`), timer 3s che li nasconde se inattivo;
    ogni interazione (click/drag anchor, drag-end, creazione) riarma il timer (`trendTimerRef`,
    `activeTrendId`). × visibile solo quando la trend è attiva.
  - **Rifiniture v4 (2026-07-05):** (a) FIX FOCUS input prezzo: `<Customized>` ora usa un
    componente STABILE (`drawLayerComponentRef` → `drawLayerRenderRef`) così il layer SVG viene
    riconciliato e non rimontato a ogni render → l'input prezzo è digitabile (la linea si
    riposiziona live mentre scrivi; commit su blur/Enter). (b) Meccanismo click-to-show unificato
    (`activeDrawingId` + `pokeDrawing`/`idleTimerRef`, auto-hide 3s) anche per la linea ORIZZONTALE:
    a riposo mostra solo la linea + prezzo compatto read-only; al click sulla linea (hit-line
    trasparente) appaiono input editabile + selettore + ×; timer in pausa mentre l'input è a fuoco.
    (c) × della trend spostata sul VERO inizio-sinistra della linea visibile (intersezione col plot
    box, `leftPt`). (d) Preview trend: dopo il primo punto la linea è già mostrata estrapolata a
    tutta larghezza attraverso primo punto + cursore (come la finale), si fissa al secondo click.
  - **Rifiniture v5 (2026-07-05):** (a) input prezzo orizzontale: onChange aggiorna SOLO il
    buffer testo; la linea si sposta solo al commit (Invio/blur), non a ogni tasto. (b) Preview
    trend/orizzontale resa `pointerEvents:none` e il rect di cattura spostato COME ULTIMO figlio
    (in cima) → durante il posizionamento la preview non ruba gli eventi: la linea resta stabile
    dopo il primo click (niente flicker/scomparsa quando il mouse è fermo) e il secondo click
    arriva sempre al rect. (c) In posizionamento della linea orizzontale il livello prezzo è già
    mostrato a sinistra (label bianca sul cursore) prima di confermare.
  - **Rifiniture v6 (2026-07-05):** (a) NUOVA linea VERTICALE (drawMode "vertical"): un click
    la posiziona, alla base mostra la data (`formatTooltipLabel` del punto più vicino), drag
    orizzontale (handle "x"), × su select, preview durante il posizionamento. (b) Modello ALERT
    cambiato: la linea è solo visiva finché non si clicca la CAMPANELLA (`toggleArm`) → arma
    (crea alert `/api/alerts`), ri-click disarma (DELETE). Rimosso l'auto-create alla creazione.
    Campanella persistente al margine quando armata (`bellHandle`). Beep Web Audio (`playBeep`) +
    toast quando `currentPrice` attraversa una linea armata (effect su prevPriceRef). (c) FIX
    "redraw a ogni tasto": input prezzo estratto in componente figlio `PriceInput` con stato
    proprio (il typing ri-renderizza solo l'input, non StockChart/Recharts) + `isAnimationActive
    ={false}` su Area e Bar volume. Rimosso lo stato `editing`.
  - **Doc aggiornata:** `Docs/PROJECT_STATUS.md` → sezione "Grafico avanzato — strumenti di disegno
    & alert (2026-07-05)" con tutte le funzionalità del grafico.
  - Qualità dopo rifiniture: check 0 · lint 0 · Vitest 52/52 · build OK.

## Alert fase 2 server-side (2026-07-06, FATTO — modello in discussione)
- `server/alertScheduler.ts`: `shouldTrigger` pura (semantica = client v1: above ≥, below ≤,
  mai su prezzo null/≤0/NaN); `checkAlertsOnce` (1 quote/simbolo dedup, errori per-simbolo non
  fatali, salva `triggeredAt=now`); `createAlertScheduler` (no-overlap, unref, primo pass allo
  start). Avvio in `index.ts`: default 60s, `ALERT_CHECK_INTERVAL_MS` override (<1000 = off).
- `IStorage.getActiveAlerts()` = isActive ∧ triggeredAt NULL, tutti gli utenti (Mem+Database).
- `isActive` NON toccato dallo scheduler (interruttore utente); trigger one-shot via
  triggeredAt; riarmo = azzerare triggeredAt con PUT.
- Test: `tests/alert-scheduler.test.ts` (10) + storage +1 → 63/63. check/lint/build verdi.
- **Vincolo sessione 2026-07-06 (utente):** auto-allow SOLO `npm run check/test/build/lint`;
  NO db:push, db:seed, install, deploy senza conferma.

## Modello C — drawings persistenti + reprojection (2026-07-06, DECISO utente e FATTO)
- **Decisione utente:** C piena — TUTTI i disegni persistenti nel DB (anche non armati e
  verticali); armato ⇔ `alertId` valorizzato; ricalcolo dinamico server-side alle 08:00 Italia.
- Tabella `drawings` in shared/schema.ts: 2 ancore (aTime/aPrice/bTime/bPrice, orizzontale =
  prezzi uguali, verticale = solo aTime), `alertId` FK **on delete set null** (= disarmo),
  kind enum in `insertDrawingSchema` (z.coerce.date sulle ancore, superRefine per-kind).
- `server/alertReprojector.ts`: `projectPriceAt` (lineare NEL TEMPO), `reprojectOnce(deps, only?)`
  (target sempre riproiettato; alertType ri-derivato da 1 quote/simbolo, mantenuto se quote KO;
  tocca solo alert attivi non scattati), `msUntilNextHourInTz` (Intl DST-aware),
  `startDailyReprojector(deps, 8, "Europe/Rome")` + catch-up allo start. Avviato in index.ts.
- Route `/api/drawings`: GET/:symbol, POST, PUT/:id (se armato → reprojection immediata),
  DELETE/:id (cancella anche l'alert). PUT drawing = UNICA fonte di sync alert (il client non
  fa più PUT /api/alerts sul drag; `syncAlertFor` resta fallback per linee senza dbId).
- Client: `timeToIndex`/`indexToTime` in chart-drawings.ts (mediana dei passi per estrapolare
  fuori serie); `drawingsApi.ts` transport; stock-chart.tsx = hydration per simbolo, reset su
  cambio simbolo, re-index su cambio timeframe (ancore = ISTANTI), persist su crea/drag/commit,
  campanella → POST alert + PUT {alertId}. Tipi locali con `dbId` e tempi canonici.
- Test 63→89: alert-reprojector (13), drawings-api (5, armamento via storage per evitare rete),
  chart-drawings (6), storage +2. Verde: check 0 · lint 0 · 89/89 · build OK.
- **GATE APERTO: `npm run db:push` NON eseguito** (conferma utente richiesta). Senza push i
  drawings funzionano solo su MemStorage; su Postgres la tabella non esiste ancora.

## Qualità
ESLint 0 · Vitest 89/89 (health, storage, mapping+trigger, alert-scheduler, alert-reprojector,
watchlist/alerts/drawings API, marketData, fundamentals, candles, chart-axis, chart-drawings) ·
check 0 · build ok.

## SESSIONE CHIUSA (2026-06-21)
Per ripresa leggere `Docs/HANDOVER.md`. Verde: check 0 · lint 0 · test 31/31 · build OK.
Branch `main`, ~33 voci NON committate (nessun commit in sessione). Prossimo incremento:
**PostgreSQL (D1/D4)** — vedi HANDOVER §6 (richiede nuova dep driver + modifica schema → approvazione).

## Ripresa 2026-07-04
- Rimosso l'ultimo dead-code residuo `client/src/lib/finnhub.ts` (non importato; verificato che
  le occorrenze "finnhub" in `settings.tsx` sono solo `finnhubAvailable`/valore provider).
- Verde dopo rimozione: check 0 · lint 0 · test 31/31 · build OK.
- **Authorization Judge — auto-allow di workspace** installato per i comandi Bash ordinari con
  cwd dentro `C:\AI-LAB\FinancialWatchdog` (step 6b nel hook + `bash_autoallow_roots` in policy).
  Restano a conferma: fuori-workspace, segreti, nuove dipendenze, DB/schema, deploy/cloud, kill
  processi, cancellazioni massive. Verificato 17/17 + self-test hook 35/35. Dettaglio e razionale
  (incl. perche' editare la policy chiede SEMPRE conferma) in `memory/policy-workspace-autoallow.md`.
- **Feedback utente (2026-07-04):** quando servono piu' modifiche alla policy del Judge, farle
  in UNA sola scrittura (Write dell'intero file), MAI a colpi di Edit multipli = N prompt.
- **Piano commit FATTO (2026-07-04):** working tree interamente committato in 5 commit logici su
  `main` (`17acf6d` tooling · `e8ac643` server+market-data · `5f91bc7` client · `aec5566` test ·
  `1901a60` docs/memory/agents). Verde prima del commit: check 0 · lint 0 · test 31/31 · build OK.
  Identità git impostata **inline** (`-c user.email/user.name`), NON in config (evita prompt Judge).
  `.gitignore` ora ignora `.local/` e `.claude/settings.local.json`. Non tracciato lo screenshot
  orfano `attached_assets/image_1782028596346.png`.
- **Feedback utente (2026-07-04):** NON far scattare prompt di autorizzazione durante il lavoro
  ordinario. Cause note da evitare nei comandi Bash: (a) la stringa letterale `.env` (il Judge la
  intercetta — non metterla nei comandi diagnostici); (b) `git config` che SCRIVE la config →
  usare invece `git -c user.email=.. -c user.name=.. commit`. Lavorare in autonomia fino al
  completamento senza chiedere conferme.
- Resto (PostgreSQL, rename watchlist, alert fase 2, TradingView) su decisione utente.

## Stato (storico): SVILUPPO APPLICATIVO CONGELATO (2026-06-21)
Consolidamento fatto. Verde: check 0 · lint 0 · test 11/11 · build OK.
- Funziona senza key: avvio, /api/health, watchlist (crea/elimina/aggiungi-rimuovi titoli),
  alert (crea/lista/elimina), grafici (proxy Yahoo), monitoraggio alert v1 (UI; trigger dipende dai prezzi).
- Richiede FINNHUB_API_KEY (utente, in .env): search/quote/profile → prezzi in stock-detail e alert,
  e quindi lo scatto reale del monitoraggio. Grafici NON richiedono la key.
- Su MemStorage (volatile): users/watchlists/items/alerts. Si azzerano al riavvio.

## Prossimo step
PostgreSQL (D1/D4) NON ora — è il prossimo grande incremento, da decidere. Serve: provisioning DB
locale + DATABASE_URL, valutare driver `pg`/node-postgres (nuova dep), db:push, seed idempotente,
eventuale adeguamento schema. Rinviati anche: rename watchlist, fase 2 alert server-side, deploy.
Dettaglio completo nel "Riepilogo finale" in `Docs/PROJECT_STATUS.md`.

## PostgreSQL locale — Blocco B (2026-07-05, ATTIVATO E VERIFICATO)
Piano B approvato dall'utente (pg + Postgres locale Docker + schema arricchito). Modifiche
codice fatte E attivazione completata: Docker up, db:push, db:seed, verifica DatabaseStorage.
- **Attivazione (2026-07-05):** `docker compose up -d` → container `finwatch-postgres`
  (postgres:16-alpine, healthy, porta 5432); `db:push` → "Changes applied" (tabelle create);
  `db:seed` → utente default id=1 + 3 watchlist. **Idempotenza verificata** (re-run: "already
  exists"). **DatabaseStorage verificato**: log "[storage] DATABASE_URL detected", constructor
  `DatabaseStorage`, `getWatchlists(1)` legge le 3 watchlist da Postgres.
- **DATABASE_URL (locale Docker):** `postgres://finwatch:finwatch@localhost:5432/finwatch`.
  Passato INLINE ai comandi (db:push/seed/verify), NON scritto in `.env` (l'utente lo inserisce).
  Finché non è in `.env`, `npm run dev`/`npm start` restano su MemStorage.
- **FIX runtime `server/db.ts`:** `pg` è CommonJS → sotto Node ESM il named import
  `{ Pool }` NON è risolvibile a runtime (tsc/vitest passavano perché non istanziano il DB;
  fallisce solo con DATABASE_URL reale). Corretto in `import pg from "pg"; const { Pool } = pg;`.
- **Dipendenza:** aggiunta `pg` ^8.13.1 (+ `@types/pg` ^8.11.10); `@neondatabase/serverless`
  RESTA in package.json per futuro Neon (D4). `npm install` eseguito (approvato).
- **`server/db.ts`:** passato da neon-serverless a **node-postgres** (`Pool` da `pg` +
  `drizzle-orm/node-postgres`), inizializzazione lazy invariata (proxy `pool`/`db`).
- **`shared/schema.ts` arricchito:** `alerts.triggeredAt` (timestamp nullable, per alert
  fase 2); `watchlist_items` + `currency` (nullable) + `createdAt` + unique
  `watchlist_symbol_unique(watchlist_id, symbol)`; FK `watchlists/items/alerts` con
  `onDelete: "cascade"`. `insertWatchlistItemSchema` include `currency` (opzionale).
- **`server/storage.ts`:** MemStorage adeguato ai nuovi tipi `$inferSelect` (add `currency`/
  `createdAt` su item, `triggeredAt: null` su alert) — necessario per il type-check.
- **`server/seed.ts` (nuovo):** seed idempotente utente `default` (id=1, usato da
  `routes.ts:9 defaultUserId`) + 3 watchlist demo; risolve il bug FK su DB vuoto.
  Script `db:seed` in package.json. NON eseguito.
- **`docker-compose.yml` (nuovo):** `postgres:16-alpine`, porta 5432, credenziali
  finwatch/finwatch/finwatch, volume `finwatch-pgdata`, healthcheck. NON avviato.
- **`.env.example` NON modificato:** bloccato dal guard sui pattern `.env` (Read/Write negati).
  Da aggiungere a mano il blocco DATABASE_URL Docker (`postgres://finwatch:finwatch@localhost:5432/finwatch`).
- **Verde (post-attivazione):** `npm run check` 0 · `npm test` 52/52 · `npm run build` OK.
- **Per usare Postgres da dev/prod:** l'utente deve mettere in `.env`
  `DATABASE_URL=postgres://finwatch:finwatch@localhost:5432/finwatch` (con Docker attivo).
- **Gestione container:** `docker compose up -d` / `down` (mantiene i dati nel volume
  `financialwatchdog_finwatch-pgdata`) / `down -v` (cancella i dati).
- **Server LIVE verificato (2026-07-05):** fermato il vecchio dev server orfano su :5000
  (era pre-`.env`, su MemStorage) via `Stop-Process` (autorizzato dall'utente); riavviato
  `npm run dev` → boot log "DatabaseStorage", `/api/watchlists` restituisce i 3 record con
  `createdAt` = ora del seed (17:11), NON l'uptime → conferma lettura da Postgres persistente.
  Un dev server gira in background (log `_tmp_devlog.txt`); URL app: http://localhost:5000.
- **CRUD/cascade DatabaseStorage VERIFICATO (2026-07-05):** via API live + psql diretto.
  Create watchlist+2 item+alert → righe presenti in Postgres (watchlists=1/items=2/alerts=1);
  DELETE watchlist → item spariti (API `[]` e Postgres `0`) = cascade OK; cleanup alert; zero
  residui. `currency` opzionale rispettato (USD/null). Watchlist, item e alert PERSISTENTI.
- **Restano da fare:** `.env.example` blocco Docker (guard `.env`, a mano); alert fase 2
  (scheduler server-side + `triggered_at` già in schema); rename watchlist; deploy (D4).

## Decisioni consolidate (2026-06-21)
- **D1:** PostgreSQL (no SQLite; schema già `pgTable`).
- **D2:** alert → backend locale; `borsa-alert.onrender.com` = legacy da dismettere gradualmente.
- **D3:** controllo alert lato frontend in fase 1; scheduler backend in fase successiva.
- **D4:** solo locale, NO cloud/Render ora; predisporre per `DATABASE_URL`. Nessun nuovo
  servizio esterno e nessun costo senza conferma utente.
Dettaglio in `Docs/CHANGELOG_DECISIONS.md`.

## Note operative
- Stato di progetto qui, NON in `~/.claude/projects/...` (guard nativo).
- File temporanei: prefisso `_tmp_` dentro il workspace.

## Preferenze utente (autorizzazioni)
- **AUTONOMIA PIENA NEL WORKSPACE (utente, 2026-07-04):** dentro `C:\AI-LAB\FinancialWatchdog`
  sono autorizzato a **leggere, scrivere, modificare e cancellare** file di progetto SENZA chiedere
  conferma e SENZA premesse autorizzative. Basta frasi tipo "procedo alla cancellazione circoscritta",
  "richiede l'utente", ecc. per operazioni ordinarie sul workspace: si eseguono e basta.
  Restano stop-condition SOLO: nuove dipendenze esterne, modifica schema DB / dati reali, servizi
  cloud/API a pagamento, costi, azioni distruttive fuori dal workspace, segreti reali (`.env`).
- **`.env.example` / `.env.template` / `.env.sample`**: file documentali sicuri se contengono
  SOLO placeholder → creazione/modifica autonoma, NESSUNA conferma (placeholder, commenti,
  nomi variabili). Decisa dall'utente 2026-06-21.
- Resta OBBLIGATORIA la conferma per: `.env`, file con API key/token/password reali,
  `DATABASE_URL` reale, qualunque segreto effettivo.
- **Policy Authorization Judge** (`~/.claude/authorization_policy.json`): NON testarla con
  comandi che contengono letteralmente `curl`, `.env` o pattern sensibili (il Judge li
  intercetta). La validazione JSON è sufficiente. Aggiornata 2026-06-21 con low-risk
  auto-allow per `.env.example/.template/.sample`, `Docs\`, `memory\`, e HTTP verso
  localhost/127.0.0.1 (pattern robusto: vale anche nei comandi composti, esclude URL esterni).
- **NON accedere a `C:\Users\rosar\.claude`** salvo richiesta esplicita dell'utente.
  Lavorare solo nel workspace `C:\AI-LAB\FinancialWatchdog`.
- **Fix policy DB/schema (2026-07-05, richiesto dall'utente):** in `never_learn_patterns` i
  pattern `drizzle-kit`/`db:push`/`db:migrate`/`prisma` non sono più parola nuda ma ancorati
  all'INVOCAZIONE reale (inizio segmento o dopo `npx`/`npm|pnpm|yarn|bun run`). Così
  grep/find/rg/select-string che CERCANO quelle parole (anche via `| xargs grep`) restano
  read-only auto-allow; solo l'esecuzione reale resta `ask`. Fatta in UN solo Write dell'intero
  `authorization_policy.json`. Verificato: test mirato 11/11 + selftest hook 35/35, nessuna
  regressione. Nota: scrivere la policy fa scattare 1 conferma (è `protected_file`, by design).

## Authorization Judge v2 ATTIVO (2026-07-10, F.2/F.3 fatte — CANARY F.4 in corso)
- v2 = classificazione deterministica context-aware: quote-masking (P1), per-segmento con
  max-severity (P2), cwd effettivo via cd (P3), credenziali per azione+target (P4), rete per
  host (P5: localhost=safe anche nei compositi, remoto=ask), scratchpad di sessione fidato
  (P6), giudice IA SPENTO (G-1a, default-ask). Dettaglio completo, FP eliminati, buchi chiusi,
  procedura canary e criteri di rollback: `memory/policy-judge-v2.md`.
- Selftest: `python ~/.claude/hooks/_selftest_v2.py --target v2` → 50/50 (fa 1 ask, by design).
  Backup v1 per rollback: `~/.claude/hooks/backup/2026-07-07/`.
- **CANARY (2026-07-10 → ~13/07):** a fine giornata audit del log di produzione (ask fondate,
  allow nuove regole a campione, zero ai-judge, zero deny errati). Primo giro verde:
  check 0 · Vitest 89/89 auto-approvati senza prompt.
