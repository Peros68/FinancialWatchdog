import type { StockSearchResult, StockQuote, StockProfile, ChartData, Fundamentals } from "@shared/schema";

/** Identifiers of the concrete providers. */
export type ProviderId = "yahoo" | "finnhub";

/** User-selectable preference. "auto" behaves like the default (Yahoo first). */
export type ProviderPreference = "yahoo" | "finnhub" | "auto";

/**
 * Provider-agnostic market-data contract. Each provider returns normalized shapes
 * (defined in shared/schema) so routes and the frontend never depend on a provider.
 */
export interface MarketDataProvider {
  readonly id: ProviderId;
  /** Whether this provider can be used (e.g. Finnhub requires an API key). */
  readonly available: boolean;
  search(query: string): Promise<StockSearchResult[]>;
  quote(symbol: string): Promise<StockQuote>;
  profile(symbol: string): Promise<StockProfile>;
  chart(symbol: string, timeframe: string): Promise<ChartData[]>;
  /**
   * Simple, reliable fundamentals. Each provider returns only the fields it can
   * supply without crumb/cookie scraping or paid endpoints; the rest stay absent.
   */
  fundamentals(symbol: string): Promise<Partial<Fundamentals>>;
}
