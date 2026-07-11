// Local alerts API + mapping (decision D2).
// The Alerts page now reads from the local backend (/api/alerts, MemStorage) instead
// of the external borsa-alert.onrender.com service. Current price is enriched from the
// local market-data proxy (/api/stocks/quote/:symbol); it is null when unavailable
// (e.g. no FINNHUB_API_KEY configured), and the UI degrades gracefully.
import type { Alert as DbAlert } from "@shared/schema";

export interface UiAlert {
  id: number;
  symbol: string;
  name: string | null;
  target: number;
  alertType: string;
  price: number | null;
}

/**
 * Pure trigger check (v1, client-side): is the current price at/over the target?
 * - "above": triggered when price >= target
 * - "below": triggered when price <= target
 * Returns false when the price is unavailable (e.g. no market-data key configured).
 */
export function isAlertTriggered(alert: { price: number | null; target: number; alertType: string }): boolean {
  if (alert.price == null) return false;
  if (alert.alertType === "above") return alert.price >= alert.target;
  if (alert.alertType === "below") return alert.price <= alert.target;
  return false;
}

/**
 * Pure predicate for the Alerts page search box: same match as "Search Stocks"
 * (case-insensitive substring), but against symbol OR company name. An empty
 * query matches everything.
 */
export function matchesAlertQuery(alert: { symbol: string; name: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return alert.symbol.toLowerCase().includes(q) || (alert.name?.toLowerCase().includes(q) ?? false);
}

/** Pure mapping from a persisted alert to the UI shape used by the Alerts page. */
export function mapDbAlertToUi(alert: DbAlert, price: number | null = null, name: string | null = null): UiAlert {
  return {
    id: alert.id,
    symbol: alert.symbol,
    name,
    target: alert.targetPrice,
    alertType: alert.alertType,
    price,
  };
}

async function fetchCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/stocks/quote/${symbol}`);
    if (!res.ok) return null;
    const q = await res.json();
    return typeof q?.currentPrice === "number" && q.currentPrice > 0 ? q.currentPrice : null;
  } catch {
    return null;
  }
}

// Reuses the same /api/stocks/profile endpoint that already powers stock-detail /
// search (StockProfile.name), so the Alerts search box can match company names
// with the same data source as "Search Stocks" — no new dependency.
async function fetchCompanyName(symbol: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/stocks/profile/${symbol}`);
    if (!res.ok) return null;
    const p = await res.json();
    return typeof p?.name === "string" && p.name.length > 0 ? p.name : null;
  } catch {
    return null;
  }
}

export async function fetchLocalAlerts(): Promise<UiAlert[]> {
  const res = await fetch("/api/alerts", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load alerts (HTTP ${res.status})`);
  const dbAlerts: DbAlert[] = await res.json();
  return Promise.all(
    dbAlerts.map(async (a) => {
      const [price, name] = await Promise.all([fetchCurrentPrice(a.symbol), fetchCompanyName(a.symbol)]);
      return mapDbAlertToUi(a, price, name);
    }),
  );
}
