import { describe, it, expect } from "vitest";
import { extractYahooSectorIndustry, mapYahooDividends } from "../server/marketData/yahooProvider";
import { mapFinnhubFundamentals } from "../server/marketData/finnhubProvider";
import { mergeFundamentals } from "../server/marketData";
import type { Fundamentals } from "@shared/schema";

function emptyFundamentals(symbol: string): Fundamentals {
  return {
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
}

describe("extractYahooSectorIndustry", () => {
  it("returns sector/industry for the matching symbol", () => {
    const data = { quotes: [{ symbol: "AAPL", sectorDisp: "Technology", industryDisp: "Consumer Electronics" }] };
    expect(extractYahooSectorIndustry(data, "aapl")).toEqual({
      sector: "Technology",
      industry: "Consumer Electronics",
    });
  });
  it("returns nulls when not found / malformed", () => {
    expect(extractYahooSectorIndustry({ quotes: [] }, "AAPL")).toEqual({ sector: null, industry: null });
    expect(extractYahooSectorIndustry(null, "AAPL")).toEqual({ sector: null, industry: null });
  });
});

describe("mapYahooDividends", () => {
  it("maps and sorts dividend events", () => {
    const chart = {
      chart: { result: [{ events: { dividends: {
        "1610000000": { amount: 0.85, date: 1610000000 },
        "1600000000": { amount: 0.82, date: 1600000000 },
      } } }] },
    };
    const out = mapYahooDividends(chart);
    expect(out).toHaveLength(2);
    expect(out[0].amount).toBe(0.82); // earliest first after sort
    expect(out[1].amount).toBe(0.85);
    expect(out[0].date <= out[1].date).toBe(true);
  });
  it("returns [] when there are no events", () => {
    expect(mapYahooDividends({})).toEqual([]);
    expect(mapYahooDividends({ chart: { result: [{}] } })).toEqual([]);
  });
});

describe("mapFinnhubFundamentals", () => {
  it("maps market cap / EPS / multiples with fallbacks", () => {
    const profile = { marketCapitalization: 3_000_000, finnhubIndustry: "Technology" };
    const metric = { metric: { peTTM: 30, pbAnnual: 45, psTTM: 8, epsTTM: 6.5, currentDividendYieldTTM: 0.5 } };
    expect(mapFinnhubFundamentals(profile, metric)).toEqual({
      industry: "Technology",
      marketCapitalization: 3_000_000,
      peRatio: 30,
      pbRatio: 45,
      psRatio: 8,
      eps: 6.5,
      dividendYield: 0.5,
    });
  });
  it("yields nulls for missing metrics", () => {
    const out = mapFinnhubFundamentals({}, {});
    expect(out.peRatio).toBeNull();
    expect(out.marketCapitalization).toBeNull();
  });
});

describe("mergeFundamentals", () => {
  it("fills empty fields and reports contribution", () => {
    const base = emptyFundamentals("AAPL");
    const contributed = mergeFundamentals(base, { sector: "Technology", marketCapitalization: 100 });
    expect(contributed).toBe(true);
    expect(base.sector).toBe("Technology");
    expect(base.marketCapitalization).toBe(100);
  });
  it("does not override existing values and reports no contribution", () => {
    const base = emptyFundamentals("AAPL");
    base.sector = "Technology";
    const contributed = mergeFundamentals(base, { sector: "Other" });
    expect(contributed).toBe(false);
    expect(base.sector).toBe("Technology");
  });
});
