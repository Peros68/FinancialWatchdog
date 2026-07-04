# FinancialWatchdog — Analisi iniziale (sola lettura)

> Report prodotto secondo la spec §17-18. Nessun file dell'app è stato modificato.
> Data: 2026-06-21.

## 1. Architettura attuale rilevata

App fullstack monorepo importata da Replit ("FinAlert"):

- **Frontend**: React 18 + TypeScript, build Vite, routing Wouter, stato server con
  TanStack Query, UI shadcn/Radix, grafici Recharts, Tailwind (tema dark).
- **Backend**: Express + TypeScript (`server/index.ts`), API REST sotto `/api`,
  server unico sulla porta **5000** che serve sia API sia client (Vite in dev,
  static in prod).
- **ORM/schema**: Drizzle ORM, dialetto **PostgreSQL** (`pgTable`), schema condiviso
  in `shared/schema.ts`. Driver Neon serverless.
- **Provider dati dinamici**: **Finnhub** (search, quote, profile, candle) + proxy
  **Yahoo Finance** per i grafici (`/api/yahoo/chart/:symbol`).

## 2. File analizzati

`package.json`, `server/index.ts`, `server/routes.ts`, `server/storage.ts`,
`server/db.ts`, `shared/schema.ts`, `drizzle.config.ts`, `replit.md`,
`client/src/lib/queryClient.ts`, `client/src/pages/alerts.tsx`, struttura `client/src`.

## 3. Storage attuale watchlist

- **In memoria.** `server/storage.ts` esporta `export const storage = new MemStorage()`.
- `MemStorage` usa `Map` in RAM e in `initializeDefaultData()` crea l'utente `default`
  e **3 watchlist seed**: `Tech Stocks`, `Blue Chips`, `Growth`.
- Esiste già una classe `DatabaseStorage` completa (Drizzle/Postgres) **ma non è
  istanziata**: il backend gira interamente in memoria. I dati si perdono al riavvio.
- Le watchlist sono servite dal backend locale (`/api/watchlists`) e consumate dal
  frontend tramite TanStack Query.

## 4. Storage attuale alert

**Doppio sistema, incoerente:**

1. Backend locale `/api/alerts` (CRUD su `MemStorage`, in memoria) — definito in
   `routes.ts` + `storage.ts`, ma **non usato dalla pagina Alerts**.
2. La pagina `client/src/pages/alerts.tsx` chiama **direttamente un backend esterno**
   `https://borsa-alert.onrender.com` (`/alerts`, `/watchlist`), bypassando l'API
   Express locale. Anche `client/src/components/alert-chart.tsx` vi fa riferimento.

Quindi gli alert mostrati all'utente NON passano dal backend locale né dal DB.

## 5. API endpoint esistenti (`server/routes.ts`)

```
GET    /api/yahoo/chart/:symbol
GET    /api/stocks/search?q=
GET    /api/stocks/quote/:symbol
GET    /api/stocks/profile/:symbol
GET    /api/stocks/chart/:symbol?timeframe=
GET    /api/watchlists
POST   /api/watchlists
DELETE /api/watchlists/:id
GET    /api/watchlists/:id/items
POST   /api/watchlists/:id/items
DELETE /api/watchlists/items/:id
GET    /api/alerts
GET    /api/alerts/:symbol
POST   /api/alerts
PUT    /api/alerts/:id
DELETE /api/alerts/:id
```

### Delta rispetto agli endpoint target della spec (§9)

| Target spec | Stato attuale |
|---|---|
| `GET /api/health` | **assente** |
| `DELETE /api/watchlist-items/:id` | presente come `DELETE /api/watchlists/items/:id` |
| `PATCH /api/alerts/:id` | presente come `PUT /api/alerts/:id` |
| resto | allineato |

`userId` è fisso a `1` (`defaultUserId`) in tutte le route: nessuna autenticazione reale.

## 6. Database configurato

- `server/db.ts`: Pool Neon serverless, **richiede `DATABASE_URL`** (throw se assente).
- `drizzle.config.ts`: dialetto Postgres, output migrazioni.
- Script `db:push` presente (`drizzle-kit push`); **nessuno** script `db:seed`.
- **Nessuna `.env`** rilevata; `DATABASE_URL` non impostata → con lo storage attuale
  (MemStorage) il backend parte comunque perché `db.ts` non viene importato a runtime.

## 7. Dati statici / seed trovati

- Utente `default` / password `password` (in chiaro) — `MemStorage`.
- Watchlist seed: `Tech Stocks`, `Blue Chips`, `Growth`.
- API key Finnhub **hardcoded come fallback** in `server/routes.ts` (rischio sicurezza).

## 8. Schema Drizzle vs entità spec (§7)

| Entità | Delta rispetto alla spec |
|---|---|
| `users` | manca `created_at`; password in chiaro |
| `watchlists` | manca `updated_at` |
| `watchlist_items` | mancano `currency` e `created_at`; manca vincolo unico `(watchlist_id, symbol)` (oggi solo controllato a livello applicativo) |
| `alerts` | manca `triggered_at` |

## 9. Rischi

1. **Persistenza assente**: storage in memoria → perdita dati al riavvio (watchlist/alert).
2. **Doppia fonte alert**: backend locale vs `borsa-alert.onrender.com` → incoerenza,
   dipendenza esterna non governata.
3. **Segreto in chiaro**: API key Finnhub nel sorgente.
4. **Nessun `DATABASE_URL`**: passare a `DatabaseStorage` richiede provisioning DB.
5. **Naming endpoint** divergente dalla spec (rotture potenziali se si "standardizza").
6. `throw err` nell'error handler di `index.ts` dopo aver già risposto.

## 10. Decisioni aperte (da consolidare con l'utente — stop-condition)

- **D1 — Database**: SQLite vs PostgreSQL (spec §8 richiede decisione esplicita,
  vietato scegliere in autonomia). Lo schema attuale è `pgTable` → Postgres è il
  percorso a minor attrito.
- **D2 — Alert**: mantenere il backend esterno `borsa-alert.onrender.com` o migrare
  gli alert sul backend locale + DB? (servizio esterno = stop-condition).
- **D3 — Controllo alert**: frontend (confronto prezzo/soglia) vs backend periodico.
- **D4 — Provisioning DB / `DATABASE_URL`**: servizio esterno/cloud → richiede conferma.

## 11. Primo micro-step consigliato (non bloccato, reversibile)

Aggiungere `GET /api/health` (endpoint diagnostico mancante richiesto dalla spec §9):
modifica minima, isolata, testabile con `npm run check` + curl, nessuna dipendenza,
nessun DB, nessun rischio. Sblocca la verifica di liveness prima di toccare lo storage.

Step successivi (dopo le decisioni D1-D4): switch graduale `MemStorage → DatabaseStorage`
dietro lo stesso `IStorage`, script di seed idempotente, client API centralizzato
`client/src/lib/api.ts`, riconciliazione del sistema alert.
