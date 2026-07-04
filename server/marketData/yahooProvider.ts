import type { StockSearchResult, StockQuote, StockProfile, ChartData, Fundamentals, DividendEntry } from "@shared/schema";
import type { MarketDataProvider } from "./types";

const YH = "https://query1.finance.yahoo.com";
// A UA header reduces the chance of Yahoo throttling server-side requests.
const FETCH_OPTS = { headers: { "User-Agent": "Mozilla/5.0 (FinancialWatchdog)" } };

async function yfetch(url: string): Promise<any> {
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`);
  return res.json();
}

const num = (v: any): number =>
  typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0;

/** Map a Yahoo symbol/exchange to a TradingView symbol (from the Yahoo7.html example). */
export function toTradingViewSymbol(symbol: string, exchange?: string): string {
  if (symbol.endsWith(".MI")) return `MIL:${symbol.replace(".MI", "")}`;
  if (exchange === "NASDAQ") return `NASDAQ:${symbol}`;
  if (exchange === "NYSE") return `NYSE:${symbol}`;
  return symbol;
}

/** Pure: Yahoo /v1/finance/search payload -> normalized search results. */
export function mapYahooSearch(data: any): StockSearchResult[] {
  const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
  return quotes
    .filter((q: any) => q && q.symbol)
    .slice(0, 10)
    .map((q: any) => ({
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      type: q.typeDisp || q.quoteType || "Stock",
      exchange: q.exchDisp || q.exchange || "N/A",
    }));
}

/** Pure: Yahoo chart `meta` -> normalized quote. */
export function mapYahooQuoteFromMeta(meta: any): StockQuote {
  const currentPrice = num(meta?.regularMarketPrice);
  const previousClose = num(meta?.chartPreviousClose ?? meta?.previousClose);
  const change = currentPrice - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;
  return {
    currentPrice,
    change,
    changePercent,
    high: num(meta?.regularMarketDayHigh),
    low: num(meta?.regularMarketDayLow),
    open: num(meta?.regularMarketOpen ?? previousClose),
    previousClose,
  };
}

/** Pure: Yahoo chart payload -> normalized candles. */
export function mapYahooChart(data: any): ChartData[] {
  const result = data?.chart?.result?.[0];
  const ts = result?.timestamp;
  const q = result?.indicators?.quote?.[0];
  if (!Array.isArray(ts) || !q) return [];
  return ts
    .map((t: number, i: number) => ({
      timestamp: t * 1000,
      open: num(q.open?.[i]),
      high: num(q.high?.[i]),
      low: num(q.low?.[i]),
      close: num(q.close?.[i]),
      volume: num(q.volume?.[i]),
    }))
    .filter((c: ChartData) => c.close > 0);
}

/** Pure: extract sector/industry for a symbol from a Yahoo search payload. */
export function extractYahooSectorIndustry(
  searchData: any,
  symbol: string,
): { sector: string | null; industry: string | null } {
  const match = (searchData?.quotes || []).find(
    (q: any) => q?.symbol?.toUpperCase?.() === symbol.toUpperCase(),
  );
  return {
    sector: match?.sectorDisp || null,
    industry: match?.industryDisp || null,
  };
}

/** Pure: extract recent cash dividends from a Yahoo chart payload (events=div). */
export function mapYahooDividends(chartData: any): DividendEntry[] {
  const divs = chartData?.chart?.result?.[0]?.events?.dividends;
  if (!divs || typeof divs !== "object") return [];
  return Object.values(divs)
    .map((d: any) => ({
      date: new Date(num(d?.date) * 1000).toISOString().slice(0, 10),
      amount: num(d?.amount),
    }))
    .filter((d: DividendEntry) => d.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);
}

/** Map app timeframe tokens to Yahoo interval/range. */
export function yahooParams(timeframe: string): { interval: string; range: string } {
  switch (timeframe) {
    case "1m": return { interval: "1m", range: "1d" };
    case "5m": return { interval: "5m", range: "1d" };
    case "15m": return { interval: "15m", range: "5d" };
    case "30m": return { interval: "30m", range: "5d" };
    case "1h": return { interval: "1h", range: "5d" };
    case "4h": return { interval: "1h", range: "1mo" };
    case "1D": case "1d": return { interval: "1d", range: "1mo" };
    case "5D": return { interval: "15m", range: "5d" };
    case "1W": case "1wk": return { interval: "1wk", range: "3mo" };
    case "1M": case "1mo": return { interval: "1mo", range: "1y" };
    case "3M": return { interval: "1d", range: "3mo" };
    case "6M": return { interval: "1d", range: "6mo" };
    case "1Y": return { interval: "1wk", range: "1y" };
    case "5Y": return { interval: "1wk", range: "5y" };
    default: return { interval: "1d", range: "1mo" };
  }
}

export const yahooProvider: MarketDataProvider = {
  id: "yahoo",
  available: true,

  async search(query: string): Promise<StockSearchResult[]> {
    const data = await yfetch(
      `${YH}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
    );
    return mapYahooSearch(data);
  },

  async quote(symbol: string): Promise<StockQuote> {
    const data = await yfetch(
      `${YH}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
    );
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("Yahoo quote: no meta");
    return mapYahooQuoteFromMeta(meta);
  },

  async profile(symbol: string): Promise<StockProfile> {
    const [chartData, searchData] = await Promise.all([
      yfetch(`${YH}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`).catch(() => null),
      yfetch(`${YH}/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=10&newsCount=0`).catch(() => null),
    ]);
    const meta = chartData?.chart?.result?.[0]?.meta;
    const match = (searchData?.quotes || []).find(
      (q: any) => q?.symbol?.toUpperCase?.() === symbol.toUpperCase(),
    );
    if (!meta && !match) throw new Error("Yahoo profile: no data");
    return {
      name: match?.longname || match?.shortname || symbol,
      symbol,
      exchange: match?.exchDisp || meta?.exchangeName || "N/A",
      currency: meta?.currency || "USD",
      country: "",
      marketCapitalization: 0,
    };
  },

  async chart(symbol: string, timeframe: string): Promise<ChartData[]> {
    const { interval, range } = yahooParams(timeframe);
    const data = await yfetch(
      `${YH}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
    );
    return mapYahooChart(data);
  },

  // Yahoo contributes sector/industry (from search) and recent dividends (from the
  // chart events) — both without crumb/cookie. Market cap/EPS/multiples are left to
  // Finnhub (they require Yahoo crumb otherwise).
  async fundamentals(symbol: string): Promise<Partial<Fundamentals>> {
    const [searchData, chartData] = await Promise.all([
      yfetch(`${YH}/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=10&newsCount=0`).catch(() => null),
      yfetch(`${YH}/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d&events=div`).catch(() => null),
    ]);
    const { sector, industry } = extractYahooSectorIndustry(searchData, symbol);
    const dividends = mapYahooDividends(chartData);
    return {
      symbol,
      sector,
      industry,
      dividends: dividends.length > 0 ? dividends : null,
    };
  },
};
