const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || "d0obh91r01qu2361kgegd0obh91r01qu2361kgf0";
const BASE_URL = "https://finnhub.io/api/v1";

export interface FinnhubSearchResult {
  count: number;
  result: Array<{
    description: string;
    displaySymbol: string;
    symbol: string;
    type: string;
  }>;
}

export interface FinnhubQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

export interface FinnhubProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

export interface FinnhubCandle {
  c: number[]; // Close prices
  h: number[]; // High prices
  l: number[]; // Low prices
  o: number[]; // Open prices
  s: string; // Status
  t: number[]; // Timestamps
  v: number[]; // Volume data
}

async function fetchFromFinnhub(endpoint: string): Promise<any> {
  const response = await fetch(`${BASE_URL}${endpoint}&token=${API_KEY}`);
  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.status}`);
  }
  return response.json();
}

export const finnhub = {
  search: (query: string): Promise<FinnhubSearchResult> => {
    return fetchFromFinnhub(`/search?q=${encodeURIComponent(query)}`);
  },

  quote: (symbol: string): Promise<FinnhubQuote> => {
    return fetchFromFinnhub(`/quote?symbol=${symbol}`);
  },

  profile: (symbol: string): Promise<FinnhubProfile> => {
    return fetchFromFinnhub(`/stock/profile2?symbol=${symbol}`);
  },

  candles: (symbol: string, resolution: string, from: number, to: number): Promise<FinnhubCandle> => {
    return fetchFromFinnhub(`/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`);
  },
};
