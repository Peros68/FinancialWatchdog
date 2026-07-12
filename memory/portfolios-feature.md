---
name: portfolios-feature
description: Portafogli virtuali multipli — implementato, deployato su Render e verificato live su Supabase (round-trip reale OK).
metadata:
  type: project
---

Feature "Portafogli virtuali multipli" implementata e IN PRODUZIONE (sessione 2026-07-12).

**Stato:** COMPLETATA e LIVE. Codice + test locali OK (tsc, 103 vitest verdi incl. `portfolio-math`/`portfolio-api`, build, lint). **`db:push` su Supabase eseguito dall'utente** ("Changes applied"). **Commit `deb9955` pushato su `main` → Render redeploy automatico** (live in ~63s). **Round-trip live verificato** su `https://financialwatchdog.onrender.com`: create portafoglio, 2 acquisti (spese calcolate + spese incluse), read-back da Supabase (valori `numeric`→`number`, precisione esatta 10.119/11.0595/221.19), guardia valuta USD→400, delete+cascade. Dati di test ripuliti, nessun segreto stampato.

**Delta DB (additivo, 2 nuove tabelle):** `portfolios` (name, userId **NOT NULL**, baseCurrency, multiCurrency, feeEuPct/Fixed, feeUsaPct/Fixed) e `portfolio_holdings` (portfolioId **NOT NULL** FK cascade, symbol, name, exchange, currency, quantity, avgPrice, totalCost; unique `(portfolio_id, symbol)`). Nessuna modifica alle tabelle esistenti.

**Correzione richiesta dall'utente (2026-07-12):** denaro/quantità/prezzi/commissioni usano **`numeric(p,s)`** (non `real`): quantity/avg_price `numeric(20,8)`, total_cost/fee fissi `numeric(20,4)`, fee pct `numeric(10,6)`. Poiché Drizzle 0.39.1 mappa `numeric`→stringa, in `shared/schema.ts` uso un `customType` `decimalNumber(p,s)` che espone `number` in TS (fromDriver `Number`, toDriver `String`) mantenendo l'aritmetica invariata. FK `user_id`/`portfolio_id` ora NOT NULL. SQL rigenerato offline e verificato.

**Decisioni utente:** multivaluta *dichiarata* alla creazione (se false → blocca valuta ≠ baseCurrency); niente tabella transazioni (solo posizione aggregata); nuova pagina `/portfolios`; commissioni % + fisso per EU/USA default 0 (nessun valore broker hardcoded); toggle "spese già incluse" per import storico (commissione forzata a 0, prezzo = costo medio all-in). Media pesata spese incluse: `newAvg = (oldTotalCost + qty*price + commission) / (oldQty + qty)`.

**File toccati:** `shared/schema.ts`, `shared/portfolio.ts` (nuovo, util pure), `server/storage.ts`, `server/routes.ts`, `client/src/components/portfolio-buy-form.tsx` (nuovo), `watchlist-modal.tsx` (tab), `pages/portfolios.tsx` (nuovo), `navigation.tsx`, `App.tsx`, `tests/portfolio-math.test.ts` + `tests/portfolio-api.test.ts`.

**Prossimo step dopo OK utente:** `npm run db:push` (+ eventuale allineamento seed/doc). Vedi [[minimize-permission-prompts]].
