import { describe, it, expect } from "vitest";
import { MemStorage } from "../server/storage";

describe("MemStorage — watchlists & items", () => {
  it("creates, reads and deletes watchlists (with item cascade)", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "u1", password: "p" });

    const wl = await storage.createWatchlist({ name: "My List", userId: user.id });
    expect(wl.id).toBeGreaterThan(0);
    expect(wl.name).toBe("My List");

    const lists = await storage.getWatchlists(user.id);
    expect(lists.some((l) => l.id === wl.id)).toBe(true);

    const item = await storage.addWatchlistItem({
      watchlistId: wl.id,
      symbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
    });
    expect(item.symbol).toBe("AAPL");

    // unique-by-symbol lookup
    const found = await storage.getWatchlistItemBySymbol(wl.id, "AAPL");
    expect(found?.id).toBe(item.id);

    // deleting the watchlist cascades to its items
    await storage.deleteWatchlist(wl.id);
    expect(await storage.getWatchlist(wl.id)).toBeUndefined();
    expect(await storage.getWatchlistItems(wl.id)).toHaveLength(0);
  });
});

describe("MemStorage — alerts", () => {
  it("creates, lists, filters, updates and deletes alerts", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "u2", password: "p" });

    const alert = await storage.createAlert({
      userId: user.id,
      symbol: "TSLA",
      targetPrice: 250.5,
      alertType: "above",
    });
    expect(alert.id).toBeGreaterThan(0);
    expect(alert.isActive).toBe(true);
    expect(alert.targetPrice).toBe(250.5);

    const all = await storage.getAlerts(user.id);
    expect(all.some((a) => a.id === alert.id)).toBe(true);

    const bySymbol = await storage.getAlertsBySymbol(user.id, "TSLA");
    expect(bySymbol).toHaveLength(1);

    const updated = await storage.updateAlert(alert.id, { isActive: false });
    expect(updated?.isActive).toBe(false);

    await storage.deleteAlert(alert.id);
    expect(await storage.getAlerts(user.id)).toHaveLength(0);
  });

  it("getActiveAlerts returns only active, not-yet-triggered alerts (all users)", async () => {
    const storage = new MemStorage();
    const u1 = await storage.createUser({ username: "u3", password: "p" });
    const u2 = await storage.createUser({ username: "u4", password: "p" });

    const eligible = await storage.createAlert({ userId: u1.id, symbol: "AAPL", targetPrice: 1, alertType: "above" });
    const otherUser = await storage.createAlert({ userId: u2.id, symbol: "MSFT", targetPrice: 2, alertType: "below" });
    const inactive = await storage.createAlert({ userId: u1.id, symbol: "TSLA", targetPrice: 3, alertType: "above" });
    await storage.updateAlert(inactive.id, { isActive: false });
    const triggered = await storage.createAlert({ userId: u1.id, symbol: "NVDA", targetPrice: 4, alertType: "above" });
    await storage.updateAlert(triggered.id, { triggeredAt: new Date() });

    const active = await storage.getActiveAlerts();
    const ids = active.map((a) => a.id).sort();
    expect(ids).toEqual([eligible.id, otherUser.id].sort());
  });
});

describe("MemStorage — drawings", () => {
  const t0 = new Date("2026-07-01T00:00:00Z");
  const t1 = new Date("2026-07-02T00:00:00Z");

  it("creates, lists (per symbol), updates and deletes drawings", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "d1", password: "p" });

    const trend = await storage.createDrawing({
      userId: user.id,
      symbol: "AAPL",
      kind: "trend",
      aTime: t0,
      aPrice: 100,
      bTime: t1,
      bPrice: 110,
    });
    expect(trend.id).toBeGreaterThan(0);
    expect(trend.alertId).toBeNull();

    await storage.createDrawing({ userId: user.id, symbol: "MSFT", kind: "vertical", aTime: t0 });

    expect(await storage.getDrawings(user.id)).toHaveLength(2);
    expect(await storage.getDrawings(user.id, "AAPL")).toHaveLength(1);

    const updated = await storage.updateDrawing(trend.id, { aPrice: 105 });
    expect(updated?.aPrice).toBe(105);

    await storage.deleteDrawing(trend.id);
    expect(await storage.getDrawing(trend.id)).toBeUndefined();
  });

  it("getArmedDrawings returns linked drawings; deleting the alert disarms them", async () => {
    const storage = new MemStorage();
    const user = await storage.createUser({ username: "d2", password: "p" });
    const alert = await storage.createAlert({ userId: user.id, symbol: "AAPL", targetPrice: 1, alertType: "above" });
    const drawing = await storage.createDrawing({
      userId: user.id,
      symbol: "AAPL",
      kind: "horizontal",
      aTime: t0,
      aPrice: 1,
      bTime: t1,
      bPrice: 1,
    });
    expect(await storage.getArmedDrawings()).toHaveLength(0);

    await storage.updateDrawing(drawing.id, { alertId: alert.id });
    expect((await storage.getArmedDrawings()).map((d) => d.id)).toEqual([drawing.id]);

    // FK parity: deleting the alert sets the drawing's alertId to null.
    await storage.deleteAlert(alert.id);
    expect(await storage.getArmedDrawings()).toHaveLength(0);
    expect((await storage.getDrawing(drawing.id))?.alertId).toBeNull();
  });
});
