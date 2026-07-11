import { describe, it, expect } from "vitest";
import { mapDbAlertToUi, isAlertTriggered, matchesAlertQuery } from "@/lib/alertsApi";
import type { Alert as DbAlert } from "@shared/schema";

const baseAlert: DbAlert = {
  id: 7,
  userId: 1,
  symbol: "AAPL",
  targetPrice: 200,
  alertType: "above",
  isActive: true,
  createdAt: new Date(),
};

describe("mapDbAlertToUi", () => {
  it("maps targetPrice -> target and carries id/symbol/alertType + price + name", () => {
    const ui = mapDbAlertToUi(baseAlert, 187.5, "Apple Inc.");
    expect(ui).toEqual({
      id: 7,
      symbol: "AAPL",
      name: "Apple Inc.",
      target: 200,
      alertType: "above",
      price: 187.5,
    });
  });

  it("defaults price and name to null when not provided (e.g. quote/profile unavailable)", () => {
    const ui = mapDbAlertToUi(baseAlert);
    expect(ui.price).toBeNull();
    expect(ui.name).toBeNull();
    expect(ui.target).toBe(200);
  });
});

describe("matchesAlertQuery (Alerts page search box)", () => {
  const aapl = { symbol: "AAPL", name: "Apple Inc." };

  it("empty query matches everything", () => {
    expect(matchesAlertQuery(aapl, "")).toBe(true);
    expect(matchesAlertQuery(aapl, "   ")).toBe(true);
  });

  it("matches by symbol, case-insensitive substring", () => {
    expect(matchesAlertQuery(aapl, "aap")).toBe(true);
    expect(matchesAlertQuery(aapl, "AAPL")).toBe(true);
    expect(matchesAlertQuery(aapl, "msft")).toBe(false);
  });

  it("matches by company name, case-insensitive substring", () => {
    expect(matchesAlertQuery(aapl, "apple")).toBe(true);
    expect(matchesAlertQuery(aapl, "inc")).toBe(true);
    expect(matchesAlertQuery(aapl, "microsoft")).toBe(false);
  });

  it("falls back to symbol-only match when name is unavailable (null)", () => {
    const noName = { symbol: "AAPL", name: null };
    expect(matchesAlertQuery(noName, "aapl")).toBe(true);
    expect(matchesAlertQuery(noName, "apple")).toBe(false);
  });
});

describe("isAlertTriggered (v1 client-side monitoring)", () => {
  it("'above' triggers when price >= target", () => {
    expect(isAlertTriggered({ price: 205, target: 200, alertType: "above" })).toBe(true);
    expect(isAlertTriggered({ price: 200, target: 200, alertType: "above" })).toBe(true);
    expect(isAlertTriggered({ price: 199.99, target: 200, alertType: "above" })).toBe(false);
  });

  it("'below' triggers when price <= target", () => {
    expect(isAlertTriggered({ price: 95, target: 100, alertType: "below" })).toBe(true);
    expect(isAlertTriggered({ price: 100, target: 100, alertType: "below" })).toBe(true);
    expect(isAlertTriggered({ price: 100.01, target: 100, alertType: "below" })).toBe(false);
  });

  it("never triggers when price is unavailable", () => {
    expect(isAlertTriggered({ price: null, target: 200, alertType: "above" })).toBe(false);
    expect(isAlertTriggered({ price: null, target: 200, alertType: "below" })).toBe(false);
  });

  it("unknown alertType does not trigger", () => {
    expect(isAlertTriggered({ price: 999, target: 200, alertType: "weird" })).toBe(false);
  });
});
