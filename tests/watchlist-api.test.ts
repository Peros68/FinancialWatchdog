import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
import { registerRoutes } from "../server/routes";

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

describe("Watchlist API flow (create → add → list → remove)", () => {
  it("supports the full lifecycle used by the Watchlist UI", async () => {
    // create
    const created = await json(
      await fetch(`${baseUrl}/api/watchlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test List" }),
      }),
    );
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe("Test List");

    // add item
    const item = await json(
      await fetch(`${baseUrl}/api/watchlists/${created.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "MSFT", name: "Microsoft", exchange: "NASDAQ" }),
      }),
    );
    expect(item.symbol).toBe("MSFT");

    // list items
    const items = await json(await fetch(`${baseUrl}/api/watchlists/${created.id}/items`));
    expect(items).toHaveLength(1);
    expect(items[0].symbol).toBe("MSFT");

    // duplicate symbol rejected
    const dupRes = await fetch(`${baseUrl}/api/watchlists/${created.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: "MSFT", name: "Microsoft", exchange: "NASDAQ" }),
    });
    expect(dupRes.status).toBe(400);

    // remove item
    const del = await json(await fetch(`${baseUrl}/api/watchlists/items/${item.id}`, { method: "DELETE" }));
    expect(del.success).toBe(true);

    const after = await json(await fetch(`${baseUrl}/api/watchlists/${created.id}/items`));
    expect(after).toHaveLength(0);
  });
});

describe("Alerts API", () => {
  it("creates and lists alerts (source consumed by the Alerts page)", async () => {
    const created = await json(
      await fetch(`${baseUrl}/api/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "NVDA", targetPrice: 1000, alertType: "above" }),
      }),
    );
    expect(created.symbol).toBe("NVDA");
    expect(created.isActive).toBe(true);

    const list = await json(await fetch(`${baseUrl}/api/alerts`));
    expect(list.some((a: any) => a.symbol === "NVDA")).toBe(true);
  });
});
