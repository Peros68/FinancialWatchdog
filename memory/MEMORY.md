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
  Restano timeframe, Line/Candles, Volume reale, Alert.
- Watchlist: aggiunta ELIMINAZIONE watchlist (AlertDialog + DELETE /api/watchlists/:id). Rename TODO.
- File legacy ELIMINATI (legacy.ts, legacyAlertApi.ts). D2 chiusa anche a livello sorgente.

## Qualità
ESLint 0 · Vitest 31/31 (health, storage, mapping+trigger, watchlist/alerts/settings API, marketData,
fundamentals) · check 0 · build ok.

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
  Lavorare solo nel workspace `C:\AI-LAB\FinancialWatchdog`. Modifica policy = conclusa.
