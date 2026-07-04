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

describe("Settings API", () => {
  it("defaults to the Yahoo provider and reports finnhub availability", async () => {
    const s = await json(await fetch(`${baseUrl}/api/settings`));
    expect(s.marketDataProvider).toBe("yahoo");
    expect(typeof s.finnhubAvailable).toBe("boolean");
  });

  it("accepts a valid preference (auto)", async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketDataProvider: "auto" }),
    });
    expect(res.status).toBe(200);
    const s = await json(res);
    expect(s.marketDataProvider).toBe("auto");
  });

  it("rejects an invalid preference", async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketDataProvider: "bloomberg" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects finnhub when its key is not available", async () => {
    const current = await json(await fetch(`${baseUrl}/api/settings`));
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketDataProvider: "finnhub" }),
    });
    // 200 if a key happens to be configured in the env, 400 otherwise.
    expect(res.status).toBe(current.finnhubAvailable ? 200 : 400);
  });
});
