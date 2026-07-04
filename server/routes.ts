import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWatchlistSchema, insertWatchlistItemSchema, insertAlertSchema } from "@shared/schema";
import { marketData } from "./marketData";
import { getPreferredProvider, setPreferredProvider, isValidPreference } from "./settings";

export async function registerRoutes(app: Express): Promise<Server> {
  const defaultUserId = 1; // Using default user for demo

  // Health / liveness probe
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // App settings (market-data provider preference). No secrets are exposed.
  app.get("/api/settings", (_req, res) => {
    res.json({
      marketDataProvider: getPreferredProvider(),
      finnhubAvailable: marketData.finnhubAvailable,
    });
  });

  app.put("/api/settings", (req, res) => {
    const value = req.body?.marketDataProvider;
    if (!isValidPreference(value)) {
      return res.status(400).json({ error: "Invalid marketDataProvider" });
    }
    if (value === "finnhub" && !marketData.finnhubAvailable) {
      return res.status(400).json({ error: "Finnhub non disponibile: FINNHUB_API_KEY non configurata" });
    }
    setPreferredProvider(value);
    res.json({
      marketDataProvider: getPreferredProvider(),
      finnhubAvailable: marketData.finnhubAvailable,
    });
  });

  // Yahoo Finance proxy for charts (raw passthrough, consumed by the chart components)
  app.get("/api/yahoo/chart/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { interval = "1d", range = "1mo" } = req.query;
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`,
        { headers: { "User-Agent": "Mozilla/5.0 (FinancialWatchdog)" } },
      );

      if (!response.ok) {
        throw new Error(`Yahoo Finance API failed: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Yahoo Finance proxy error:", error);
      res.status(500).json({ error: "Failed to fetch chart data from Yahoo Finance" });
    }
  });

  // Stock search (provider-agnostic: Yahoo default, Finnhub fallback/option)
  app.get("/api/stocks/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.length < 2) {
        return res.json({ result: [] });
      }
      const result = await marketData.search(q);
      res.json({ result });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Stock quote
  app.get("/api/stocks/quote/:symbol", async (req, res) => {
    try {
      const quote = await marketData.quote(req.params.symbol);
      res.json(quote);
    } catch (error) {
      console.error("Quote error:", error);
      res.status(500).json({ error: "Failed to get quote" });
    }
  });

  // Stock profile
  app.get("/api/stocks/profile/:symbol", async (req, res) => {
    try {
      const profile = await marketData.profile(req.params.symbol);
      res.json(profile);
    } catch (error) {
      console.error("Profile error:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Stock fundamentals (simple & reliable: Yahoo sector/industry/dividends +
  // Finnhub market cap/EPS/multiples when its key is present). Composed, with clean nulls.
  app.get("/api/stocks/fundamentals/:symbol", async (req, res) => {
    try {
      const fundamentals = await marketData.fundamentals(req.params.symbol);
      res.json(fundamentals);
    } catch (error) {
      console.error("Fundamentals error:", error);
      res.status(500).json({ error: "Failed to get fundamentals" });
    }
  });

  // Stock chart data (normalized, provider-agnostic)
  app.get("/api/stocks/chart/:symbol", async (req, res) => {
    try {
      const { timeframe = "1D" } = req.query;
      const data = await marketData.chart(req.params.symbol, String(timeframe));
      res.json({ data });
    } catch (error) {
      console.error("Chart error:", error);
      res.status(500).json({ error: "Failed to get chart data" });
    }
  });

  // Watchlist endpoints
  app.get("/api/watchlists", async (_req, res) => {
    try {
      const watchlists = await storage.getWatchlists(defaultUserId);
      res.json(watchlists);
    } catch {
      res.status(500).json({ error: "Failed to get watchlists" });
    }
  });

  app.post("/api/watchlists", async (req, res) => {
    try {
      const validation = insertWatchlistSchema.safeParse({ ...req.body, userId: defaultUserId });
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const watchlist = await storage.createWatchlist(validation.data);
      res.json(watchlist);
    } catch {
      res.status(500).json({ error: "Failed to create watchlist" });
    }
  });

  app.delete("/api/watchlists/:id", async (req, res) => {
    try {
      await storage.deleteWatchlist(parseInt(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete watchlist" });
    }
  });

  // Watchlist items endpoints
  app.get("/api/watchlists/:id/items", async (req, res) => {
    try {
      const items = await storage.getWatchlistItems(parseInt(req.params.id));
      res.json(items);
    } catch {
      res.status(500).json({ error: "Failed to get watchlist items" });
    }
  });

  app.post("/api/watchlists/:id/items", async (req, res) => {
    try {
      const validation = insertWatchlistItemSchema.safeParse({
        ...req.body,
        watchlistId: parseInt(req.params.id)
      });
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }
      if (validation.data.watchlistId == null || Number.isNaN(validation.data.watchlistId)) {
        return res.status(400).json({ error: "Invalid watchlist id" });
      }

      // Check if item already exists
      const existing = await storage.getWatchlistItemBySymbol(validation.data.watchlistId, validation.data.symbol);
      if (existing) {
        return res.status(400).json({ error: "Stock already in watchlist" });
      }

      const item = await storage.addWatchlistItem(validation.data);
      res.json(item);
    } catch {
      res.status(500).json({ error: "Failed to add item to watchlist" });
    }
  });

  app.delete("/api/watchlists/items/:id", async (req, res) => {
    try {
      await storage.removeWatchlistItem(parseInt(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to remove item from watchlist" });
    }
  });

  // Alert endpoints
  app.get("/api/alerts", async (_req, res) => {
    try {
      const alerts = await storage.getAlerts(defaultUserId);
      res.json(alerts);
    } catch {
      res.status(500).json({ error: "Failed to get alerts" });
    }
  });

  app.get("/api/alerts/:symbol", async (req, res) => {
    try {
      const alerts = await storage.getAlertsBySymbol(defaultUserId, req.params.symbol);
      res.json(alerts);
    } catch {
      res.status(500).json({ error: "Failed to get alerts for symbol" });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const validation = insertAlertSchema.safeParse({ ...req.body, userId: defaultUserId });
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const alert = await storage.createAlert(validation.data);
      res.json(alert);
    } catch {
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  app.put("/api/alerts/:id", async (req, res) => {
    try {
      const alert = await storage.updateAlert(parseInt(req.params.id), req.body);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch {
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      await storage.deleteAlert(parseInt(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
