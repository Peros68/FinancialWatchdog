import type { StockSearchResult, StockQuote, StockProfile, ChartData, Fundamentals } from "@shared/schema";
import type { MarketDataProvider, ProviderId, ProviderPreference } from "./types";
import { yahooProvider, toTradingViewSymbol } from "./yahooProvider";
import { finnhubProvider } from "./finnhubProvider";
import { getPreferredProvider } from "../settings";

/**
 * Pure: decide the ordered provider chain from the preference and Finnhub availability.
 * Yahoo is the default; Finnhub is only used when its key is present, and only first
 * when explicitly preferred. The remaining provider is always the automatic fallback.
 */
export function resolveChain(
  preference: ProviderPreference,
  finnhubAvailable: boolean,
): ProviderId[] {
  if (preference === "finnhub" && finnhubAvailable) return ["finnhub", "yahoo"];
  return finnhubAvailable ? ["yahoo", "finnhub"] : ["yahoo"];
}

function providerById(id: ProviderId): MarketDataProvider {
  return id === "finnhub" ? finnhubProvider : yahooProvider;
}

/** Run an operation across the provider chain, falling back on error or empty result. */
async function withFallback<T>(
  run: (p: MarketDataProvider) => Promise<T>,
  isEmpty: (r: T) => boolean,
): Promise<T> {
  const chain = resolveChain(getPreferredProvider(), finnhubProvider.available);
  let lastError: unknown;
  let lastEmpty: T | undefined;
  for (const id of chain) {
    try {
      const result = await run(providerById(id));
      if (!isEmpty(result)) return result;
      lastEmpty = result;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastEmpty !== undefined) return lastEmpty;
  throw lastError ?? new Error("No market-data provider returned data");
}

const FUNDAMENTAL_KEYS = [
  "sector",
  "industry",
  "marketCapitalization",
  "peRatio",
  "pbRatio",
  "psRatio",
  "eps",
  "dividendYield",
  "dividends",
] as const;

/**
 * Pure: fill empty fields of `base` from `partial`. Returns true if it contributed
 * at least one value (so the facade can record the provider in `sources`).
 */
export function mergeFundamentals(base: Fundamentals, partial: Partial<Fundamentals>): boolean {
  let contributed = false;
  for (const key of FUNDAMENTAL_KEYS) {
    const value = (partial as any)[key];
    if ((base as any)[key] == null && value != null) {
      (base as any)[key] = value;
      contributed = true;
    }
  }
  return contributed;
}

export const marketData = {
  finnhubAvailable: finnhubProvider.available,
  toTradingViewSymbol,

  search(query: string): Promise<StockSearchResult[]> {
    return withFallback((p) => p.search(query), (r) => r.length === 0);
  },
  quote(symbol: string): Promise<StockQuote> {
    return withFallback(
      (p) => p.quote(symbol),
      (r) => r == null || !(r.currentPrice > 0),
    );
  },
  profile(symbol: string): Promise<StockProfile> {
    return withFallback((p) => p.profile(symbol), (r) => r == null);
  },
  chart(symbol: string, timeframe: string): Promise<ChartData[]> {
    return withFallback((p) => p.chart(symbol, timeframe), (r) => r.length === 0);
  },

  // Fundamentals are COMPOSED, not failed-over: Yahoo provides sector/industry/dividends,
  // Finnhub (only if its key is present) adds market cap/EPS/multiples. Missing data is
  // simply left null (clean fallback). Independent of the preferred-provider setting.
  async fundamentals(symbol: string): Promise<Fundamentals> {
    const base: Fundamentals = {
      symbol,
      sector: null,
      industry: null,
      marketCapitalization: null,
      peRatio: null,
      pbRatio: null,
      psRatio: null,
      eps: null,
      dividendYield: null,
      dividends: null,
      sources: [],
    };
    const sources = new Set<string>();
    try {
      if (mergeFundamentals(base, await yahooProvider.fundamentals(symbol))) sources.add("yahoo");
    } catch { /* best-effort */ }
    if (finnhubProvider.available) {
      try {
        if (mergeFundamentals(base, await finnhubProvider.fundamentals(symbol))) sources.add("finnhub");
      } catch { /* best-effort */ }
    }
    base.sources = Array.from(sources);
    return base;
  },
};

// Log provider availability at startup WITHOUT exposing the key (boolean only).
console.log(
  `[marketData] default=yahoo, finnhub available: ${finnhubProvider.available}`,
);
