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
const post = (path: string, body: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("Portfolio API", () => {
  it("creates a portfolio, adds/updates a holding (avg incl. fees) and enforces the currency guard", async () => {
    // create a non-multi-currency EUR portfolio with EU fees 0.19% + 1
    const pf = await json(
      await post("/api/portfolios", {
        name: "Reale",
        baseCurrency: "EUR",
        multiCurrency: false,
        feeEuPct: 0.19,
        feeEuFixed: 1,
        feeUsaPct: 0.5,
        feeUsaFixed: 2,
      }),
    );
    expect(pf.id).toBeGreaterThan(0);
    expect(pf.multiCurrency).toBe(false);

    // first buy: 10 @ 10, EUR, fees computed (0.19 + 1 = 1.19) → total 101.19, avg 10.119
    const h1 = await json(
      await post(`/api/portfolios/${pf.id}/holdings`, {
        symbol: "ENI.MI",
        name: "Eni",
        exchange: "Milan",
        currency: "EUR",
        quantity: 10,
        price: 10,
      }),
    );
    expect(h1.quantity).toBe(10);
    expect(h1.totalCost).toBeCloseTo(101.19, 4);
    expect(h1.avgPrice).toBeCloseTo(10.119, 4);

    // second buy on same symbol, fees already included → commission ignored
    // added 120 → total 221.19, qty 20, avg 11.0595
    const h2 = await json(
      await post(`/api/portfolios/${pf.id}/holdings`, {
        symbol: "ENI.MI",
        name: "Eni",
        exchange: "Milan",
        currency: "EUR",
        quantity: 10,
        price: 12,
        feesIncluded: true,
      }),
    );
    expect(h2.quantity).toBe(20);
    expect(h2.totalCost).toBeCloseTo(221.19, 4);
    expect(h2.avgPrice).toBeCloseTo(11.0595, 4);

    // single aggregated row per symbol
    const holdings = await json(await fetch(`${baseUrl}/api/portfolios/${pf.id}/holdings`));
    expect(holdings).toHaveLength(1);

    // currency guard: a USD stock is rejected by a non-multi EUR portfolio
    const blocked = await post(`/api/portfolios/${pf.id}/holdings`, {
      symbol: "AAPL",
      name: "Apple",
      exchange: "NASDAQ",
      currency: "USD",
      quantity: 1,
      price: 100,
    });
    expect(blocked.status).toBe(400);

    // list portfolios includes ours
    const list = await json(await fetch(`${baseUrl}/api/portfolios`));
    expect(list.some((p: any) => p.id === pf.id)).toBe(true);

    // delete cascades holdings
    const del = await json(await fetch(`${baseUrl}/api/portfolios/${pf.id}`, { method: "DELETE" }));
    expect(del.success).toBe(true);
  });

  it("updates name, base currency, multi-currency and commission config", async () => {
    const pf = await json(
      await post("/api/portfolios", { name: "Old", baseCurrency: "EUR", multiCurrency: false }),
    );

    const updated = await json(
      await fetch(`${baseUrl}/api/portfolios/${pf.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Name",
          baseCurrency: "USD",
          multiCurrency: true,
          feeEuPct: 0.25,
          feeUsaFixed: 3,
        }),
      }),
    );
    expect(updated.name).toBe("New Name");
    expect(updated.baseCurrency).toBe("USD");
    expect(updated.multiCurrency).toBe(true);
    expect(updated.feeEuPct).toBeCloseTo(0.25, 6);
    expect(updated.feeUsaFixed).toBeCloseTo(3, 6);

    // persisted: a fresh GET reflects the change
    const list = await json(await fetch(`${baseUrl}/api/portfolios`));
    const found = list.find((p: any) => p.id === pf.id);
    expect(found.name).toBe("New Name");
    expect(found.multiCurrency).toBe(true);

    // unknown portfolio → 404
    const missing = await fetch(`${baseUrl}/api/portfolios/999999`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(missing.status).toBe(404);
  });

  it("blocks turning off multi-currency or changing base currency while foreign positions exist", async () => {
    // multi-currency EUR portfolio holding a USD position
    const pf = await json(
      await post("/api/portfolios", { name: "Mixed", baseCurrency: "EUR", multiCurrency: true }),
    );
    await post(`/api/portfolios/${pf.id}/holdings`, {
      symbol: "AAPL", name: "Apple", exchange: "NASDAQ", currency: "USD",
      quantity: 2, price: 100, feesIncluded: true,
    });

    const put = (body: unknown) =>
      fetch(`${baseUrl}/api/portfolios/${pf.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });

    // turning multi off with a USD holding present → blocked
    const offMulti = await put({ multiCurrency: false });
    expect(offMulti.status).toBe(400);
    expect((await json(offMulti)).error).toMatch(/USD/);

    // changing base currency to one that still leaves USD "foreign" while non-multi → blocked
    const changeBase = await put({ multiCurrency: false, baseCurrency: "GBP" });
    expect(changeBase.status).toBe(400);

    // staying multi-currency → base currency change allowed
    const stillMulti = await put({ baseCurrency: "USD" });
    expect(stillMulti.status).toBe(200);
    expect((await json(stillMulti)).baseCurrency).toBe("USD");
  });

  it("blocks changing the base currency of a NON-multi portfolio that has positions", async () => {
    const pf = await json(
      await post("/api/portfolios", { name: "EUR only", baseCurrency: "EUR", multiCurrency: false }),
    );
    await post(`/api/portfolios/${pf.id}/holdings`, {
      symbol: "ENI.MI", name: "Eni", exchange: "Milan", currency: "EUR", quantity: 1, price: 10, feesIncluded: true,
    });
    const res = await fetch(`${baseUrl}/api/portfolios/${pf.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseCurrency: "USD" }),
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/EUR/);
  });

  it("a multi-currency portfolio accepts mixed currencies", async () => {
    const pf = await json(
      await post("/api/portfolios", { name: "Multi", baseCurrency: "EUR", multiCurrency: true }),
    );
    const usd = await post(`/api/portfolios/${pf.id}/holdings`, {
      symbol: "AAPL",
      name: "Apple",
      exchange: "NASDAQ",
      currency: "USD",
      quantity: 2,
      price: 100,
      feesIncluded: true,
    });
    expect(usd.status).toBe(200);
  });
});
