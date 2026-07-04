import { describe, it, expect } from "vitest";
import { resolveChain } from "../server/marketData";
import {
  mapYahooSearch,
  mapYahooQuoteFromMeta,
  toTradingViewSymbol,
} from "../server/marketData/yahooProvider";

describe("resolveChain (provider selection + fallback)", () => {
  it("defaults to Yahoo only when Finnhub is unavailable", () => {
    expect(resolveChain("yahoo", false)).toEqual(["yahoo"]);
    expect(resolveChain("auto", false)).toEqual(["yahoo"]);
    expect(resolveChain("finnhub", false)).toEqual(["yahoo"]);
  });

  it("uses Yahoo first with Finnhub fallback by default", () => {
    expect(resolveChain("yahoo", true)).toEqual(["yahoo", "finnhub"]);
    expect(resolveChain("auto", true)).toEqual(["yahoo", "finnhub"]);
  });

  it("uses Finnhub first only when explicitly preferred and available", () => {
    expect(resolveChain("finnhub", true)).toEqual(["finnhub", "yahoo"]);
  });
});

describe("mapYahooSearch", () => {
  it("normalizes Yahoo search quotes", () => {
    const data = {
      quotes: [
        { symbol: "AAPL", longname: "Apple Inc.", typeDisp: "Equity", exchDisp: "NASDAQ" },
        { symbol: "ENI.MI", shortname: "ENI", quoteType: "EQUITY", exchange: "MIL" },
        { /* no symbol -> filtered out */ longname: "X" },
      ],
    };
    const out = mapYahooSearch(data);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ symbol: "AAPL", name: "Apple Inc.", type: "Equity", exchange: "NASDAQ" });
    expect(out[1].name).toBe("ENI");
    expect(out[1].exchange).toBe("MIL");
  });

  it("returns [] on malformed payload", () => {
    expect(mapYahooSearch(null)).toEqual([]);
    expect(mapYahooSearch({})).toEqual([]);
  });
});

describe("mapYahooQuoteFromMeta", () => {
  it("derives price/change from chart meta", () => {
    const q = mapYahooQuoteFromMeta({
      regularMarketPrice: 110,
      chartPreviousClose: 100,
      regularMarketDayHigh: 112,
      regularMarketDayLow: 99,
      regularMarketOpen: 101,
    });
    expect(q.currentPrice).toBe(110);
    expect(q.previousClose).toBe(100);
    expect(q.change).toBe(10);
    expect(q.changePercent).toBeCloseTo(10);
    expect(q.high).toBe(112);
    expect(q.low).toBe(99);
    expect(q.open).toBe(101);
  });

  it("is robust to missing fields", () => {
    const q = mapYahooQuoteFromMeta({});
    expect(q.currentPrice).toBe(0);
    expect(q.changePercent).toBe(0);
  });
});

describe("toTradingViewSymbol", () => {
  it("maps exchanges and Milan suffix", () => {
    expect(toTradingViewSymbol("ENI.MI")).toBe("MIL:ENI");
    expect(toTradingViewSymbol("AAPL", "NASDAQ")).toBe("NASDAQ:AAPL");
    expect(toTradingViewSymbol("IBM", "NYSE")).toBe("NYSE:IBM");
    expect(toTradingViewSymbol("XYZ")).toBe("XYZ");
  });
});
