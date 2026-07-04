import type { StockSearchResult, StockQuote, StockProfile, ChartData, Fundamentals } from "@shared/schema";
import type { MarketDataProvider } from "./types";

/** First finite number among the candidates, else null. */
function pickNumber(...vals: any[]): number | null {
  for (const v of vals) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Pure: map Finnhub profile2 + metric payloads to fundamentals (market cap/EPS/multiples). */
export function mapFinnhubFundamentals(profile: any, metricResp: any): Partial<Fundamentals> {
  const m = metricResp?.metric || {};
  return {
    industry: profile?.finnhubIndustry || null,
    marketCapitalization: pickNumber(profile?.marketCapitalization),
    peRatio: pickNumber(m.peTTM, m.peBasicExclExtraTTM, m.peAnnual),
    pbRatio: pickNumber(m.pbAnnual, m.pbQuarterly, m.pb),
    psRatio: pickNumber(m.psTTM, m.psAnnual),
    eps: pickNumber(m.epsTTM, m.epsBasicExclExtraItemsTTM, m.epsAnnual),
    dividendYield: pickNumber(m.currentDividendYieldTTM, m.dividendYieldIndicatedAnnual),
  };
}

// Key stays server-side only. Never logged, never returned to the client.
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || "";
const BASE = "https://finnhub.io/api/v1";

async function ffetch(endpoint: string): Promise<any> {
  const res = await fetch(`${BASE}${endpoint}&token=${FINNHUB_API_KEY}`);
  if (!res.ok) throw new Error(`Finnhub API error: ${res.status}`);
  return res.json();
}

function timeframeToCandle(timeframe: string): { from: number; resolution: string } {
  const now = Math.floor(Date.now() / 1000);
  switch (timeframe) {
    case "1D": return { from: now - 86400, resolution: "5" };
    case "5D": return { from: now - 432000, resolution: "15" };
    case "1M": return { from: now - 2592000, resolution: "60" };
    case "3M": return { from: now - 7776000, resolution: "D" };
    case "6M": return { from: now - 15552000, resolution: "D" };
    case "1Y": return { from: now - 31536000, resolution: "D" };
    case "5Y": return { from: now - 157680000, resolution: "W" };
    default: return { from: now - 86400, resolution: "5" };
  }
}

export const finnhubProvider: MarketDataProvider = {
  id: "finnhub",
  available: Boolean(FINNHUB_API_KEY),

  async search(query: string): Promise<StockSearchResult[]> {
    const searchData = await ffetch(`/search?q=${encodeURIComponent(query)}`);
    return Promise.all(
      (searchData.result || []).slice(0, 10).map(async (stock: any) => {
        try {
          const profile = await ffetch(`/stock/profile2?symbol=${stock.symbol}`);
          return {
            symbol: stock.symbol,
            name: stock.description || profile.name || stock.displaySymbol,
            type: stock.type || "Stock",
            exchange: profile.exchange || "N/A",
          };
        } catch {
          return {
            symbol: stock.symbol,
            name: stock.description || stock.displaySymbol,
            type: stock.type || "Stock",
            exchange: "N/A",
          };
        }
      }),
    );
  },

  async quote(symbol: string): Promise<StockQuote> {
    const q = await ffetch(`/quote?symbol=${symbol}`);
    return {
      currentPrice: q.c,
      change: q.d,
      changePercent: q.dp,
      high: q.h,
      low: q.l,
      open: q.o,
      previousClose: q.pc,
    };
  },

  async profile(symbol: string): Promise<StockProfile> {
    const p = await ffetch(`/stock/profile2?symbol=${symbol}`);
    return {
      name: p.name,
      symbol,
      exchange: p.exchange,
      currency: p.currency,
      country: p.country,
      marketCapitalization: p.marketCapitalization,
    };
  },

  async chart(symbol: string, timeframe: string): Promise<ChartData[]> {
    const now = Math.floor(Date.now() / 1000);
    const { from, resolution } = timeframeToCandle(timeframe);
    const candle = await ffetch(
      `/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}`,
    );
    if (candle.s === "no_data" || !Array.isArray(candle.t)) return [];
    return candle.t.map((t: number, i: number) => ({
      timestamp: t * 1000,
      open: candle.o[i],
      high: candle.h[i],
      low: candle.l[i],
      close: candle.c[i],
      volume: candle.v[i],
    }));
  },

  // Finnhub contributes market cap, EPS and the main multiples via free endpoints
  // (/stock/profile2 + /stock/metric). Full statements are NOT used (premium).
  async fundamentals(symbol: string): Promise<Partial<Fundamentals>> {
    const [profile, metric] = await Promise.all([
      ffetch(`/stock/profile2?symbol=${symbol}`).catch(() => null),
      ffetch(`/stock/metric?symbol=${symbol}&metric=all`).catch(() => null),
    ]);
    if (!profile && !metric) return {};
    return mapFinnhubFundamentals(profile, metric);
  },
};
