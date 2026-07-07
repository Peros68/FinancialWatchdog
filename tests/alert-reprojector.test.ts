import { describe, it, expect, vi } from "vitest";
import {
  projectPriceAt,
  alertTypeFor,
  msUntilNextHourInTz,
  reprojectOnce,
} from "../server/alertReprojector";
import { MemStorage } from "../server/storage";
import type { StockQuote } from "@shared/schema";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function quoteOf(price: number): StockQuote {
  return {
    currentPrice: price,
    change: 0,
    changePercent: 0,
    high: price,
    low: price,
    open: price,
    previousClose: price,
  };
}

describe("projectPriceAt (pure, linear in time)", () => {
  const t0 = new Date("2026-07-01T00:00:00Z");
  const t1 = new Date(t0.getTime() + DAY);

  it("projects a sloped line forward and backward in time", () => {
    const a = { time: t0, price: 100 };
    const b = { time: t1, price: 110 };
    expect(projectPriceAt(a, b, new Date(t0.getTime() + 2 * DAY))).toBeCloseTo(120);
    expect(projectPriceAt(a, b, new Date(t0.getTime() + DAY / 2))).toBeCloseTo(105);
    expect(projectPriceAt(a, b, new Date(t0.getTime() - DAY))).toBeCloseTo(90);
  });

  it("a flat line (equal prices) projects to a constant — horizontal drawings", () => {
    const a = { time: t0, price: 250 };
    const b = { time: t1, price: 250 };
    expect(projectPriceAt(a, b, new Date(t0.getTime() + 30 * DAY))).toBe(250);
  });

  it("degenerate anchors (same instant) fall back to anchor A's price", () => {
    const a = { time: t0, price: 100 };
    const b = { time: t0, price: 999 };
    expect(projectPriceAt(a, b, t1)).toBe(100);
  });
});

describe("alertTypeFor (same convention as the client)", () => {
  it("line at/above the price → 'above', below → 'below'", () => {
    expect(alertTypeFor(110, 100)).toBe("above");
    expect(alertTypeFor(100, 100)).toBe("above");
    expect(alertTypeFor(90, 100)).toBe("below");
  });
});

describe("msUntilNextHourInTz (08:00 Europe/Rome, DST-aware)", () => {
  it("summer (CEST, UTC+2): 05:30Z is 07:30 local → 30 minutes to 08:00", () => {
    expect(msUntilNextHourInTz(new Date("2026-07-06T05:30:00Z"), 8, "Europe/Rome")).toBe(30 * 60_000);
  });

  it("summer: 07:00Z is 09:00 local → 23 hours to the NEXT 08:00", () => {
    expect(msUntilNextHourInTz(new Date("2026-07-06T07:00:00Z"), 8, "Europe/Rome")).toBe(23 * HOUR);
  });

  it("winter (CET, UTC+1): 06:59Z is 07:59 local → one minute", () => {
    expect(msUntilNextHourInTz(new Date("2026-01-15T06:59:00Z"), 8, "Europe/Rome")).toBe(60_000);
  });

  it("exactly at the target hour schedules a full day ahead", () => {
    expect(msUntilNextHourInTz(new Date("2026-07-06T06:00:00Z"), 8, "Europe/Rome")).toBe(24 * HOUR);
  });
});

describe("reprojectOnce", () => {
  const t0 = new Date("2026-07-01T00:00:00Z");
  const t1 = new Date(t0.getTime() + DAY);

  async function setupArmedTrend(storage: MemStorage, userId: number, symbol = "AAPL") {
    const alert = await storage.createAlert({ userId, symbol, targetPrice: 110, alertType: "above" });
    const drawing = await storage.createDrawing({
      userId,
      symbol,
      kind: "trend",
      aTime: t0,
      aPrice: 100,
      bTime: t1,
      bPrice: 110,
    });
    await storage.updateDrawing(drawing.id, { alertId: alert.id });
    return { alert, drawing };
  }

  it("re-projects an armed trend line to 'now' and re-derives the direction", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "rp1", password: "p" });
    const { alert } = await setupArmedTrend(storage, user.id);

    const result = await reprojectOnce({
      storage,
      getQuote: async () => quoteOf(100),
      now: () => new Date(t0.getTime() + 2 * DAY), // line is at 120 now
      log: () => {},
    });

    expect(result).toMatchObject({ armed: 1, updated: 1, quoteErrors: 0 });
    const updated = (await storage.getAlerts(user.id)).find((a) => a.id === alert.id);
    expect(updated?.targetPrice).toBeCloseTo(120);
    expect(updated?.alertType).toBe("above"); // 120 ≥ price 100
  });

  it("horizontal drawings are a no-op when the alert already matches", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "rp2", password: "p" });
    const alert = await storage.createAlert({ userId: user.id, symbol: "MSFT", targetPrice: 250, alertType: "above" });
    const drawing = await storage.createDrawing({
      userId: user.id,
      symbol: "MSFT",
      kind: "horizontal",
      aTime: t0,
      aPrice: 250,
      bTime: t1,
      bPrice: 250,
    });
    await storage.updateDrawing(drawing.id, { alertId: alert.id });

    const result = await reprojectOnce({
      storage,
      getQuote: async () => quoteOf(200), // 250 ≥ 200 → 'above', unchanged
      now: () => new Date(t0.getTime() + 30 * DAY),
      log: () => {},
    });
    expect(result.updated).toBe(0);
  });

  it("skips drawings whose alert is inactive or already triggered", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "rp3", password: "p" });
    const a = await setupArmedTrend(storage, user.id, "TSLA");
    await storage.updateAlert(a.alert.id, { triggeredAt: new Date() });

    const getQuote = vi.fn(async () => quoteOf(1));
    const result = await reprojectOnce({ storage, getQuote, log: () => {} });
    expect(result).toMatchObject({ armed: 1, updated: 0, skipped: 1 });
    expect(getQuote).not.toHaveBeenCalled();
  });

  it("on quote failure the target still moves but the direction is kept", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "rp4", password: "p" });
    const { alert } = await setupArmedTrend(storage, user.id, "NVDA");

    const result = await reprojectOnce({
      storage,
      getQuote: async () => {
        throw new Error("provider down");
      },
      now: () => new Date(t0.getTime() + 2 * DAY),
      log: () => {},
    });

    expect(result).toMatchObject({ armed: 1, updated: 1, quoteErrors: 1 });
    const updated = (await storage.getAlerts(user.id)).find((a) => a.id === alert.id);
    expect(updated?.targetPrice).toBeCloseTo(120);
    expect(updated?.alertType).toBe("above"); // unchanged
  });

  it("quotes each distinct symbol once and supports the `only` restriction", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "rp5", password: "p" });
    const first = await setupArmedTrend(storage, user.id, "AAPL");
    await setupArmedTrend(storage, user.id, "AAPL");
    await setupArmedTrend(storage, user.id, "MSFT");

    const getQuote = vi.fn(async () => quoteOf(100));
    const now = () => new Date(t0.getTime() + 2 * DAY);
    const full = await reprojectOnce({ storage, getQuote, now, log: () => {} });
    expect(full.armed).toBe(3);
    expect(getQuote).toHaveBeenCalledTimes(2); // AAPL once, MSFT once

    getQuote.mockClear();
    const restricted = await reprojectOnce(
      { storage, getQuote, now: () => new Date(t0.getTime() + 3 * DAY), log: () => {} },
      [(await storage.getDrawing(first.drawing.id))!],
    );
    expect(restricted.armed).toBe(1);
    expect(getQuote).toHaveBeenCalledTimes(1);
  });
});
