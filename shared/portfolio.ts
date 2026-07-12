// Pure helpers for virtual portfolios, shared by the server (authoritative
// computation in routes) and the client (commission preview in the buy popup).
// No side effects, no I/O — trivially unit-testable.

export type Market = "EU" | "USA";

/**
 * Classify a security into the EU or USA commission bucket from the data the UI
 * already has (currency and/or exchange and/or symbol). USD or US exchanges
 * (NYSE/NASDAQ/AMEX) ⇒ USA. EUR or the Milan suffix/exchange ⇒ EU. Anything
 * ambiguous falls back to EU (the app's default base currency); the commission
 * is always editable in the popup, so a wrong guess is a prefill, not a lock-in.
 */
export function classifyMarket(
  currency?: string | null,
  exchange?: string | null,
  symbol?: string | null,
): Market {
  const cur = (currency || "").toUpperCase();
  const exch = (exchange || "").toUpperCase();
  const sym = (symbol || "").toUpperCase();

  if (cur === "USD" || exch.includes("NASDAQ") || exch.includes("NYSE") || exch.includes("AMEX")) {
    return "USA";
  }
  // EU markers (EUR, Milan exchange/suffix); anything else falls back to EU too,
  // since the commission is always editable in the popup.
  if (cur === "EUR" || exch.includes("MIL") || sym.endsWith(".MI")) {
    return "EU";
  }
  return "EU";
}

/** Portfolio fields needed to compute a commission (subset of Portfolio). */
export interface FeeConfig {
  feeEuPct: number;
  feeEuFixed: number;
  feeUsaPct: number;
  feeUsaFixed: number;
}

/**
 * Commission for a trade on the given market: quantity * price * pct% + fixed.
 * Percentages are stored as percent values (0.19 ⇒ 0.19%), hence the /100.
 */
export function commissionFor(
  market: Market,
  fees: FeeConfig,
  quantity: number,
  price: number,
): number {
  const pct = market === "USA" ? fees.feeUsaPct : fees.feeEuPct;
  const fixed = market === "USA" ? fees.feeUsaFixed : fees.feeEuFixed;
  return quantity * price * (pct / 100) + fixed;
}

export interface Position {
  quantity: number;
  totalCost: number;
}

export interface BuyResult {
  quantity: number;
  avgPrice: number;
  totalCost: number;
}

/**
 * Fold a buy into an (optional) existing position. `commission` is the cost
 * already resolved by the caller (0 when the client flagged fees as already
 * included in `price`). avgPrice is the weighted average cost per share,
 * fees included.
 */
export function applyBuy(
  existing: Position | null | undefined,
  buy: { quantity: number; price: number; commission: number },
): BuyResult {
  const oldQty = existing?.quantity ?? 0;
  const oldCost = existing?.totalCost ?? 0;
  const addedCost = buy.quantity * buy.price + buy.commission;
  const quantity = oldQty + buy.quantity;
  const totalCost = oldCost + addedCost;
  return {
    quantity,
    totalCost,
    avgPrice: quantity > 0 ? totalCost / quantity : 0,
  };
}
