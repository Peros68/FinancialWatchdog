import { describe, it, expect } from "vitest";
import { classifyMarket, commissionFor, applyBuy } from "../shared/portfolio";

const fees = { feeEuPct: 0.19, feeEuFixed: 1, feeUsaPct: 0.5, feeUsaFixed: 2 };

describe("classifyMarket", () => {
  it("maps USD / US exchanges to USA", () => {
    expect(classifyMarket("USD", null, "AAPL")).toBe("USA");
    expect(classifyMarket(null, "NASDAQ", "AAPL")).toBe("USA");
    expect(classifyMarket(null, "NYSE", "IBM")).toBe("USA");
  });

  it("maps EUR / Milan to EU and falls back to EU when ambiguous", () => {
    expect(classifyMarket("EUR", null, "ENI.MI")).toBe("EU");
    expect(classifyMarket(null, "Milan", "ENI.MI")).toBe("EU");
    expect(classifyMarket(null, null, "UNKNOWN")).toBe("EU");
  });
});

describe("commissionFor", () => {
  it("computes percent + fixed per market", () => {
    // EU: 10 * 10 * 0.19% + 1 = 0.19 + 1
    expect(commissionFor("EU", fees, 10, 10)).toBeCloseTo(1.19, 6);
    // USA: 10 * 100 * 0.5% + 2 = 5 + 2
    expect(commissionFor("USA", fees, 10, 100)).toBeCloseTo(7, 6);
  });

  it("is zero when all fee config is zero", () => {
    const z = { feeEuPct: 0, feeEuFixed: 0, feeUsaPct: 0, feeUsaFixed: 0 };
    expect(commissionFor("EU", z, 100, 50)).toBe(0);
  });
});

describe("applyBuy", () => {
  it("creates a new position with fees in the average", () => {
    const r = applyBuy(null, { quantity: 10, price: 100, commission: 5 });
    expect(r.quantity).toBe(10);
    expect(r.totalCost).toBeCloseTo(1005, 6);
    expect(r.avgPrice).toBeCloseTo(100.5, 6);
  });

  it("folds a second buy into the weighted average (fees included)", () => {
    const first = applyBuy(null, { quantity: 10, price: 100, commission: 5 });
    const second = applyBuy(first, { quantity: 10, price: 120, commission: 5 });
    expect(second.quantity).toBe(20);
    expect(second.totalCost).toBeCloseTo(2210, 6);
    expect(second.avgPrice).toBeCloseTo(110.5, 6);
  });

  it("with commission 0 (fees already included) the price is the all-in average", () => {
    const r = applyBuy(null, { quantity: 5, price: 20, commission: 0 });
    expect(r.avgPrice).toBeCloseTo(20, 6);
    expect(r.totalCost).toBeCloseTo(100, 6);
  });
});
