import { describe, it, expect } from "vitest";
import { mapDbAlertToUi, isAlertTriggered } from "@/lib/alertsApi";
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
  it("maps targetPrice -> target and carries id/symbol/alertType + price", () => {
    const ui = mapDbAlertToUi(baseAlert, 187.5);
    expect(ui).toEqual({
      id: 7,
      symbol: "AAPL",
      target: 200,
      alertType: "above",
      price: 187.5,
    });
  });

  it("defaults price to null when not provided (e.g. quote unavailable)", () => {
    const ui = mapDbAlertToUi(baseAlert);
    expect(ui.price).toBeNull();
    expect(ui.target).toBe(200);
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
