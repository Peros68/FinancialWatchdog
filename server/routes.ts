import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWatchlistSchema, insertWatchlistItemSchema, insertAlertSchema } from "@shared/schema";
import { z } from "zod";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || "d0obh91r01qu2361kgegd0obh91r01qu2361kgf0";
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

async function fetchFromFinnhub(endpoint: string) {
  const response = await fetch(`${FINNHUB_BASE_URL}${endpoint}&token=${FINNHUB_API_KEY}`);
  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.status}`);
  }
  return response.json();
}

export async function registerRoutes(app: Express): Promise<Server> {
  const defaultUserId = 1; // Using default user for demo

  // Stock search endpoint
  app.get("/api/stocks/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string' || q.length < 2) {
        return res.json({ result: [] });
      }

      const searchData = await fetchFromFinnhub(`/search?q=${encodeURIComponent(q)}`);
      
      // Get exchange info for each result
      const results = await Promise.all(
        searchData.result.slice(0, 10).map(async (stock: any) => {
          try {
            const profile = await fetchFromFinnhub(`/stock/profile2?symbol=${stock.symbol}`);
            return {
              symbol: stock.symbol,
              name: stock.description || profile.name || stock.displaySymbol,
              type: stock.type || "Stock",
              exchange: profile.exchange || "N/A"
            };
          } catch (error) {
            return {
              symbol: stock.symbol,
              name: stock.description || stock.displaySymbol,
              type: stock.type || "Stock", 
              exchange: "N/A"
            };
          }
        })
      );

      res.json({ result: results });
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Stock quote endpoint
  app.get("/api/stocks/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const quote = await fetchFromFinnhub(`/quote?symbol=${symbol}`);
      
      res.json({
        currentPrice: quote.c,
        change: quote.d,
        changePercent: quote.dp,
        high: quote.h,
        low: quote.l,
        open: quote.o,
        previousClose: quote.pc
      });
    } catch (error) {
      console.error("Quote error:", error);
      res.status(500).json({ error: "Failed to get quote" });
    }
  });

  // Stock profile endpoint
  app.get("/api/stocks/profile/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const profile = await fetchFromFinnhub(`/stock/profile2?symbol=${symbol}`);
      
      res.json({
        name: profile.name,
        symbol: symbol,
        exchange: profile.exchange,
        currency: profile.currency,
        country: profile.country,
        marketCapitalization: profile.marketCapitalization
      });
    } catch (error) {
      console.error("Profile error:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Stock chart data endpoint
  app.get("/api/stocks/chart/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { timeframe = "1D" } = req.query;
      
      const now = Math.floor(Date.now() / 1000);
      let from = now;
      let resolution = "1";
      
      switch (timeframe) {
        case "1D":
          from = now - 86400; // 1 day
          resolution = "5";
          break;
        case "5D":
          from = now - 432000; // 5 days
          resolution = "15";
          break;
        case "1M":
          from = now - 2592000; // 1 month
          resolution = "60";
          break;
        case "3M":
          from = now - 7776000; // 3 months
          resolution = "D";
          break;
        case "6M":
          from = now - 15552000; // 6 months
          resolution = "D";
          break;
        case "1Y":
          from = now - 31536000; // 1 year
          resolution = "D";
          break;
        case "5Y":
          from = now - 157680000; // 5 years
          resolution = "W";
          break;
        default:
          from = now - 86400;
          resolution = "5";
      }

      const candleData = await fetchFromFinnhub(`/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}`);
      
      if (candleData.s === "no_data") {
        return res.json({ data: [] });
      }

      const data = candleData.t.map((timestamp: number, index: number) => ({
        timestamp: timestamp * 1000,
        open: candleData.o[index],
        high: candleData.h[index],
        low: candleData.l[index],
        close: candleData.c[index],
        volume: candleData.v[index]
      }));

      res.json({ data });
    } catch (error) {
      console.error("Chart error:", error);
      res.status(500).json({ error: "Failed to get chart data" });
    }
  });

  // Watchlist endpoints
  app.get("/api/watchlists", async (req, res) => {
    try {
      const watchlists = await storage.getWatchlists(defaultUserId);
      res.json(watchlists);
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ error: "Failed to create watchlist" });
    }
  });

  app.delete("/api/watchlists/:id", async (req, res) => {
    try {
      await storage.deleteWatchlist(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete watchlist" });
    }
  });

  // Watchlist items endpoints
  app.get("/api/watchlists/:id/items", async (req, res) => {
    try {
      const items = await storage.getWatchlistItems(parseInt(req.params.id));
      res.json(items);
    } catch (error) {
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

      // Check if item already exists
      const existing = await storage.getWatchlistItemBySymbol(validation.data.watchlistId, validation.data.symbol);
      if (existing) {
        return res.status(400).json({ error: "Stock already in watchlist" });
      }

      const item = await storage.addWatchlistItem(validation.data);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to add item to watchlist" });
    }
  });

  app.delete("/api/watchlists/items/:id", async (req, res) => {
    try {
      await storage.removeWatchlistItem(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove item from watchlist" });
    }
  });

  // Alert endpoints
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getAlerts(defaultUserId);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alerts" });
    }
  });

  app.get("/api/alerts/:symbol", async (req, res) => {
    try {
      const alerts = await storage.getAlertsBySymbol(defaultUserId, req.params.symbol);
      res.json(alerts);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      await storage.deleteAlert(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
