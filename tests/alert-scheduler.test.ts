import { describe, it, expect, vi } from "vitest";
import { shouldTrigger, checkAlertsOnce, createAlertScheduler } from "../server/alertScheduler";
import { MemStorage } from "../server/storage";
import type { StockQuote } from "@shared/schema";

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

describe("shouldTrigger (server-side, same semantics as client v1)", () => {
  it("'above' triggers when price >= target", () => {
    expect(shouldTrigger({ targetPrice: 200, alertType: "above" }, 205)).toBe(true);
    expect(shouldTrigger({ targetPrice: 200, alertType: "above" }, 200)).toBe(true);
    expect(shouldTrigger({ targetPrice: 200, alertType: "above" }, 199.99)).toBe(false);
  });

  it("'below' triggers when price <= target", () => {
    expect(shouldTrigger({ targetPrice: 100, alertType: "below" }, 95)).toBe(true);
    expect(shouldTrigger({ targetPrice: 100, alertType: "below" }, 100)).toBe(true);
    expect(shouldTrigger({ targetPrice: 100, alertType: "below" }, 100.01)).toBe(false);
  });

  it("never triggers on unavailable or invalid prices", () => {
    expect(shouldTrigger({ targetPrice: 100, alertType: "below" }, null)).toBe(false);
    expect(shouldTrigger({ targetPrice: 100, alertType: "below" }, 0)).toBe(false);
    expect(shouldTrigger({ targetPrice: 100, alertType: "below" }, NaN)).toBe(false);
    expect(shouldTrigger({ targetPrice: 100, alertType: "below" }, -5)).toBe(false);
  });

  it("unknown alertType does not trigger", () => {
    expect(shouldTrigger({ targetPrice: 100, alertType: "weird" }, 999)).toBe(false);
  });
});

describe("checkAlertsOnce", () => {
  async function setup() {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "sched", password: "p" });
    return { storage, userId: user.id };
  }

  it("stamps triggeredAt on hit alerts and leaves the others untouched", async () => {
    const { storage, userId } = await setup();
    const hit = await storage.createAlert({ userId, symbol: "AAPL", targetPrice: 200, alertType: "above" });
    const miss = await storage.createAlert({ userId, symbol: "AAPL", targetPrice: 300, alertType: "above" });

    const when = new Date("2026-07-06T10:00:00Z");
    const result = await checkAlertsOnce({
      storage,
      getQuote: async () => quoteOf(205),
      now: () => when,
      log: () => {},
    });

    expect(result).toEqual({ checked: 2, symbols: 1, triggered: 1, quoteErrors: 0 });
    const alerts = await storage.getAlerts(userId);
    expect(alerts.find((a) => a.id === hit.id)?.triggeredAt).toEqual(when);
    expect(alerts.find((a) => a.id === hit.id)?.isActive).toBe(true); // user switch untouched
    expect(alerts.find((a) => a.id === miss.id)?.triggeredAt).toBeNull();
  });

  it("skips inactive and already-triggered alerts", async () => {
    const { storage, userId } = await setup();
    const inactive = await storage.createAlert({ userId, symbol: "TSLA", targetPrice: 100, alertType: "above" });
    await storage.updateAlert(inactive.id, { isActive: false });
    const done = await storage.createAlert({ userId, symbol: "TSLA", targetPrice: 100, alertType: "above" });
    const already = new Date("2026-07-01T00:00:00Z");
    await storage.updateAlert(done.id, { triggeredAt: already });

    const getQuote = vi.fn(async () => quoteOf(999));
    const result = await checkAlertsOnce({ storage, getQuote, log: () => {} });

    expect(result.checked).toBe(0);
    expect(getQuote).not.toHaveBeenCalled();
    // the already-triggered timestamp is preserved, not overwritten
    const alerts = await storage.getAlerts(userId);
    expect(alerts.find((a) => a.id === done.id)?.triggeredAt).toEqual(already);
  });

  it("quotes each distinct symbol once", async () => {
    const { storage, userId } = await setup();
    await storage.createAlert({ userId, symbol: "AAPL", targetPrice: 10, alertType: "above" });
    await storage.createAlert({ userId, symbol: "AAPL", targetPrice: 20, alertType: "above" });
    await storage.createAlert({ userId, symbol: "MSFT", targetPrice: 30, alertType: "above" });

    const getQuote = vi.fn(async () => quoteOf(1000));
    const result = await checkAlertsOnce({ storage, getQuote, log: () => {} });

    expect(getQuote).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ checked: 3, symbols: 2, triggered: 3 });
  });

  it("a failing quote leaves that symbol's alerts eligible for the next pass", async () => {
    const { storage, userId } = await setup();
    await storage.createAlert({ userId, symbol: "BROKEN", targetPrice: 10, alertType: "above" });
    const ok = await storage.createAlert({ userId, symbol: "GOOD", targetPrice: 10, alertType: "above" });

    const getQuote = vi.fn(async (symbol: string) => {
      if (symbol === "BROKEN") throw new Error("provider down");
      return quoteOf(50);
    });
    const result = await checkAlertsOnce({ storage, getQuote, log: () => {} });

    expect(result).toMatchObject({ checked: 2, symbols: 2, triggered: 1, quoteErrors: 1 });
    expect((await storage.getActiveAlerts()).map((a) => a.symbol)).toEqual(["BROKEN"]);
    expect((await storage.getAlerts(ok.userId!)).find((a) => a.id === ok.id)?.triggeredAt).toBeInstanceOf(Date);
  });
});

describe("createAlertScheduler", () => {
  it("start/stop toggles the timer and runs an immediate first pass", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "timer", password: "p" });
    await storage.createAlert({ userId: user.id, symbol: "NVDA", targetPrice: 100, alertType: "above" });

    const scheduler = createAlertScheduler(
      { storage, getQuote: async () => quoteOf(150), log: () => {} },
      60_000,
    );
    expect(scheduler.running).toBe(false);
    scheduler.start();
    expect(scheduler.running).toBe(true);
    await vi.waitFor(async () => {
      expect(await storage.getActiveAlerts()).toHaveLength(0);
    });
    scheduler.stop();
    expect(scheduler.running).toBe(false);
  });

  it("does not overlap passes: runOnce during an in-flight pass is a no-op", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "overlap", password: "p" });
    await storage.createAlert({ userId: user.id, symbol: "AMD", targetPrice: 10, alertType: "above" });

    let release!: (q: StockQuote) => void;
    const gate = new Promise<StockQuote>((resolve) => (release = resolve));
    const getQuote = vi.fn(() => gate);
    const scheduler = createAlertScheduler({ storage, getQuote, log: () => {} }, 60_000);

    const first = scheduler.runOnce();
    const second = await scheduler.runOnce(); // in-flight → skipped
    expect(second).toEqual({ checked: 0, symbols: 0, triggered: 0, quoteErrors: 0 });
    expect(getQuote).toHaveBeenCalledTimes(1);

    release(quoteOf(999));
    expect((await first).triggered).toBe(1);
  });
});
