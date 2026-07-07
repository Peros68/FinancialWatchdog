import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address !== "object") throw new Error("no address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const json = (res: Response) => res.json() as Promise<any>;
const post = (path: string, body: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const put = (path: string, body: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const T0 = "2026-07-01T00:00:00.000Z";
const T1 = "2026-07-02T00:00:00.000Z";

describe("Drawings API (persistent chart lines)", () => {
  it("creates, lists and updates a horizontal drawing (ISO times coerced)", async () => {
    const created = await json(
      await post("/api/drawings", {
        symbol: "AAPL",
        kind: "horizontal",
        aTime: T0,
        aPrice: 200,
        bTime: T1,
        bPrice: 200,
      }),
    );
    expect(created.id).toBeGreaterThan(0);
    expect(created.kind).toBe("horizontal");
    expect(created.alertId).toBeNull();
    expect(new Date(created.aTime).toISOString()).toBe(T0);

    const list = await json(await fetch(`${baseUrl}/api/drawings/AAPL`));
    expect(list.some((d: any) => d.id === created.id)).toBe(true);

    // move the level (unarmed → no alert side effects)
    const updated = await json(await put(`/api/drawings/${created.id}`, { aPrice: 210, bPrice: 210 }));
    expect(updated.aPrice).toBe(210);
    expect(updated.bPrice).toBe(210);
  });

  it("accepts a vertical drawing with only aTime, rejects a trend missing anchors", async () => {
    const vertical = await post("/api/drawings", { symbol: "AAPL", kind: "vertical", aTime: T0 });
    expect(vertical.status).toBe(200);

    const badTrend = await post("/api/drawings", {
      symbol: "AAPL",
      kind: "trend",
      aTime: T0,
      aPrice: 100, // missing bTime/bPrice
    });
    expect(badTrend.status).toBe(400);

    const badVertical = await post("/api/drawings", { symbol: "AAPL", kind: "vertical" });
    expect(badVertical.status).toBe(400);

    const badKind = await post("/api/drawings", { symbol: "AAPL", kind: "circle", aTime: T0 });
    expect(badKind.status).toBe(400);
  });

  it("lists per symbol only", async () => {
    await post("/api/drawings", {
      symbol: "MSFT",
      kind: "trend",
      aTime: T0,
      aPrice: 100,
      bTime: T1,
      bPrice: 110,
    });
    const forMsft = await json(await fetch(`${baseUrl}/api/drawings/MSFT`));
    expect(forMsft.length).toBeGreaterThan(0);
    expect(forMsft.every((d: any) => d.symbol === "MSFT")).toBe(true);
    const forOther = await json(await fetch(`${baseUrl}/api/drawings/ZZZZ`));
    expect(forOther).toHaveLength(0);
  });

  it("deleting an armed drawing deletes its alert too", async () => {
    const drawing = await json(
      await post("/api/drawings", {
        symbol: "NVDA",
        kind: "trend",
        aTime: T0,
        aPrice: 100,
        bTime: T1,
        bPrice: 110,
      }),
    );
    const alert = await json(
      await post("/api/alerts", { symbol: "NVDA", targetPrice: 120, alertType: "above" }),
    );
    // Arm via storage to avoid the PUT-route reprojection (would hit the
    // network for a quote); the reprojection itself is unit-tested.
    await storage.updateDrawing(drawing.id, { alertId: alert.id });

    const del = await json(await fetch(`${baseUrl}/api/drawings/${drawing.id}`, { method: "DELETE" }));
    expect(del.success).toBe(true);

    const drawingsLeft = await json(await fetch(`${baseUrl}/api/drawings/NVDA`));
    expect(drawingsLeft.some((d: any) => d.id === drawing.id)).toBe(false);
    const alertsLeft = await json(await fetch(`${baseUrl}/api/alerts`));
    expect(alertsLeft.some((a: any) => a.id === alert.id)).toBe(false);
  });

  it("deleting the alert disarms the drawing (alertId set null)", async () => {
    const drawing = await json(
      await post("/api/drawings", {
        symbol: "AMD",
        kind: "horizontal",
        aTime: T0,
        aPrice: 150,
        bTime: T1,
        bPrice: 150,
      }),
    );
    const alert = await json(
      await post("/api/alerts", { symbol: "AMD", targetPrice: 150, alertType: "above" }),
    );
    await storage.updateDrawing(drawing.id, { alertId: alert.id });

    await fetch(`${baseUrl}/api/alerts/${alert.id}`, { method: "DELETE" });

    const rows = await json(await fetch(`${baseUrl}/api/drawings/AMD`));
    const found = rows.find((d: any) => d.id === drawing.id);
    expect(found).toBeDefined();
    expect(found.alertId).toBeNull();
  });
});
