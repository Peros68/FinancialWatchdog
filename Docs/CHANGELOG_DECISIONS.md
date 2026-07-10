# CHANGELOG DECISIONI — FinancialWatchdog

Registro delle decisioni architetturali/funzionali. Le decisioni aperte sono
stop-condition: vanno consolidate con l'utente, mai prese in autonomia (spec §8, §13).

## Decisioni prese

### D1 — Database: **PostgreSQL** ✅ (deciso 2026-06-21)
- **Decisione:** usare PostgreSQL.
- **Motivo (utente):** lo schema è già basato su `pgTable`/Drizzle Postgres; si vogliono
  evitare conversioni premature a SQLite.
- **Implicazioni:** nessuna riscrittura dello schema; il percorso target resta
  `MemStorage → DatabaseStorage` dietro lo stesso `IStorage`.

### D2 — Sistema alert: **migrare sul backend locale** ✅ (deciso 2026-06-21)
- **Decisione:** gli alert devono passare al backend locale del progetto (`/api/alerts` + DB).
- **Stato del backend esterno:** `https://borsa-alert.onrender.com` è da considerare
  **dipendenza legacy/provvisoria da eliminare gradualmente**, NON architettura target.
- **Implicazioni:** la pagina `client/src/pages/alerts.tsx` (e `alert-chart.tsx`) andrà
  gradualmente staccata dall'URL esterno e collegata all'API locale.

### D3 — Controllo alert: **frontend (fase 1)** ✅ (deciso 2026-06-21)
- **Decisione:** in fase 1 il controllo resta lato frontend (confronto prezzo corrente vs soglia).
- **Fase successiva:** valutare job periodico / scheduler backend (con `triggered_at`).

### D4 — Provisioning DB / `DATABASE_URL`: **solo locale, no cloud** ✅ (deciso 2026-06-21)
- **Decisione:** per ora **nessun provisioning cloud** e **nessuna configurazione Render**.
- **Vincoli:** lavorare solo in locale e predisporre il progetto perché possa poi usare
  `DATABASE_URL`. **Nessun nuovo servizio esterno e nessun costo senza conferma dell'utente.**
- **Implicazioni:** Postgres locale (o equivalente) in dev; lo switch a `DatabaseStorage`
  resta subordinato alla disponibilità di un `DATABASE_URL` locale.

### Aggiornamento decisioni — 2026-06-21 (blocco baseline + migrazione alert)

- **D-test ✅ APPROVATA**: aggiunti Vitest + ESLint come dev-deps (baseline qualità).
- **D1/D4 — timing ✅**: PostgreSQL **non ora**. Restare su `MemStorage` finché frontend/
  backend locale non è stabilizzato; Postgres è il passo successivo.
- **D2 — scope ✅**: migrazione alert al backend locale **progressiva**, mantenendo
  `MemStorage` e **senza modifiche allo schema** in questo blocco. Backend esterno isolato
  in `client/src/lib/legacyAlertApi.ts` (da rimuovere progressivamente).
- **D-secret ✅**: rotazione chiave Finnhub in carico all'utente; non inserire chiavi reali.
- **D-naming ✅**: aggiornare la documentazione allo stato reale; **non** rinominare endpoint
  ora (evitare rotture). Endpoint reali: `DELETE /api/watchlists/items/:id`, `PUT /api/alerts/:id`.

### D2-bis — Toggle watchlist nella pagina Alerts ✅ (deciso 2026-06-21, delega all'agente)
- **Contesto:** il pulsante Star puntava alla watchlist piatta esterna (`borsa-alert`),
  scollegata dal sistema multi-watchlist locale; dalla pagina Alerts si ha solo `symbol`
  (manca name/exchange richiesti dagli item locali).
- **Opzioni valutate:** (a) mapping su watchlist dedicata — duplica un concetto esistente e
  produce dati degradati/dipende da Finnhub; (b) mapping su watchlist predefinita —
  categorizzazione errata; (c) **rimozione del pulsante**.
- **Decisione: (c) rimozione.** È la più coerente: elimina l'ultima dipendenza diretta da
  `borsa-alert.onrender.com`, niente dati degradati né concetto duplicato. Il favoriting resta
  nel flusso canonico (Ricerca → `StockItem` → `WatchlistModal`, con metadati completi).
- **Implicazioni:** `client/src/lib/legacy.ts` e `client/src/lib/legacyAlertApi.ts` diventano
  dead-code orfani. **Aggiornamento:** i due file sono stati **eliminati** (autorizzazione utente).
  **D2 chiusa: nessun riferimento esterno, né a runtime né nei sorgenti.**

### Toolbar grafico — semplificazione ✅ (deciso 2026-06-21)
- **Decisione:** rimuovere gli elementi mock/fuorvianti del grafico (RSI/MA20/MA50 finti, Save e
  Fullscreen senza handler, strumenti di disegno decorativi). Meglio una UI più semplice ma vera.
- **Esito:** restano timeframe, Line/Candles, toggle Volume (reale), pulsante Alert.

### Gestione watchlist — eliminazione ✅ / rename ⏸️ (deciso 2026-06-21)
- **Eliminazione:** implementata (pulsante con conferma `AlertDialog` → `DELETE /api/watchlists/:id`,
  endpoint già esistente e sicuro; cascade item in MemStorage).
- **Rename:** **rimandato** — richiede nuova API/endpoint; non implementato per ora.

### D3 fase 1 — Monitoraggio attivo alert v1 (client-side) ✅ (deciso 2026-06-21)
- **Decisione:** implementare ORA una v1 locale e reversibile: polling periodico quote, confronto
  con `targetPrice`/`alertType`, evidenza visiva al target, avviso sonoro semplice senza nuove
  dipendenze. **Vincoli:** niente `triggered_at`, niente scheduler backend, niente schema, niente PostgreSQL.
- **Esito:** `isAlertTriggered()` pura + pagina Alerts con `refetchInterval` 30s, badge/ring verde,
  beep Web Audio (best-effort). I prezzi (quindi i trigger) dipendono da `FINNHUB_API_KEY`.
- **Fase 2 (server-side: scheduler + `triggered_at` + notifica persistente):** rinviata a PostgreSQL.

### Stato sviluppo — CONGELATO ✅ (2026-06-21) → poi RIPRESO per i provider dati
- Consolidamento eseguito; successivamente ripreso lo sviluppo su richiesta utente per i provider.

### D-provider — Architettura provider dati di mercato ✅ (deciso 2026-06-21)
- **Decisione:** layer provider-agnostic con **Yahoo come default** (senza key) e **Finnhub opzionale**
  (solo se `FINNHUB_API_KEY` presente), con **fallback automatico**; scelta del provider da **Settings**.
- **Analisi:** Yahoo7.html → ricerca `/v1/finance/search`, quote da `meta` del chart, profilo
  search+meta, conversione simboli TradingView. quoteSummary evitato (richiede crumb/auth).
- **Implementazione:** `server/marketData/*` (yahoo/finnhub/facade/types) + `server/settings.ts` +
  `/api/settings` + pagina Settings client. Chiavi **solo server-side**. Schema invariato, nessuna dep.
- **Esito:** verificato live che l'app funziona **senza** Finnhub key (Yahoo). Finnhub = opzione/fallback.
- **Aperto:** profilo Yahoo non espone `country`/`marketCapitalization` (degradati); per dati completi
  servirebbe Finnhub o Yahoo quoteSummary (con crumb) — non necessario ora.

### D-fundamentals — Dati fondamentali semplici ✅ (deciso 2026-06-21)
- **Decisione:** aggiungere `fundamentals()` al layer provider, SOLO dati semplici/affidabili:
  Yahoo per settore/industria/dividendi (senza crumb), Finnhub (se key) per market cap/EPS/multipli;
  fallback pulito (campi null). Esclusi: conto economico/stato patrimoniale/cash flow, crumb Yahoo,
  provider a pagamento, widget TradingView.
- **Composizione, non fallback:** i fondamentali uniscono i contributi dei due provider; `sources[]`
  indica chi ha fornito i dati. Indipendente dalla preferenza provider.
- **TradingView:** `toTradingViewSymbol` resta utility pura non cablata (documentata per il futuro).
- **Abilitazione key:** aggiunto `server/loadEnv.ts` (`process.loadEnvFile`, built-in, no dep) per
  caricare `.env` PRIMA dei provider — senza, la `FINNHUB_API_KEY` non veniva letta dall'app.
- **Verificato live** con e senza key (sources `["yahoo"]` vs `["yahoo","finnhub"]`); key mai esposta.

### D-judge-v2 — Authorization Judge v2 (classificazione SAFE/ASK/DENY context-aware) ✅ (2026-07-10)
- **Decisione (utente):** adottare la proposta `Docs/PROPOSAL_AUTH_JUDGE_V2.md` con le
  raccomandazioni del blocco G: **G-1(a)** giudice IA spento (zona grigia → default-ask
  deterministico); **G-2(a)** rete verso host remoti sempre ask (anche read-only, es. `gh api`);
  **G-3(b)** `npm ci`/`npm install` senza pacchetti (lockfile) = safe, con pacchetti = ask;
  **G-4(a)** `git push` normale ask, force-push/`--delete` deny; **G-5(b)** `git add -A/.`
  ask solo se esiste un `.env` reale non ignorato nel cwd (check contestuale, fail-closed);
  **G-6(a)** `rm -rf` resta ask anche nel workspace; **G-7 sì** scratchpad di sessione fidato.
- **G-8 (versionamento git di `~/.claude`): NON attivato** — il rollback resta la copia datata
  in `~/.claude/hooks/backup/<data>/` (v1 in `2026-07-07/`).
- **Esito:** implementata il 2026-07-10 (F.2/F.3), selftest 50/50; canary F.4 in corso.
- **Effetto atteso:** ask reali ridotte alle sole stop-condition (stima −58% sul periodo
  post-2026-07-04), zero verdetti non deterministici, niente DENY "per forma".
