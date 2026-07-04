# WORK LOG — FinancialWatchdog

Registro cronologico degli incrementi. Voce più recente in alto.

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
