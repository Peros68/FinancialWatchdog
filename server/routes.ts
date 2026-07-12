import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertWatchlistSchema,
  insertWatchlistItemSchema,
  insertAlertSchema,
  insertDrawingSchema,
  updateDrawingSchema,
  insertPortfolioSchema,
  updatePortfolioSchema,
  addHoldingSchema,
} from "@shared/schema";
import { classifyMarket, commissionFor, applyBuy } from "@shared/portfolio";
import { marketData } from "./marketData";
import { reprojectOnce } from "./alertReprojector";
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

  // Portfolio endpoints
  app.get("/api/portfolios", async (_req, res) => {
    try {
      const list = await storage.getPortfolios(defaultUserId);
      res.json(list);
    } catch {
      res.status(500).json({ error: "Failed to get portfolios" });
    }
  });

  app.post("/api/portfolios", async (req, res) => {
    try {
      const validation = insertPortfolioSchema.safeParse({ ...req.body, userId: defaultUserId });
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }
      const portfolio = await storage.createPortfolio(validation.data);
      res.json(portfolio);
    } catch {
      res.status(500).json({ error: "Failed to create portfolio" });
    }
  });

  app.put("/api/portfolios/:id", async (req, res) => {
    try {
      const validation = updatePortfolioSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }
      const id = parseInt(req.params.id);
      const updates = validation.data;

      const current = await storage.getPortfolio(id);
      if (!current) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      // Consistency guard: a portfolio that ends up NON multi-currency must hold
      // only its (possibly new) base currency. This blocks both turning
      // multiCurrency off and changing the base currency while positions in a
      // different currency exist.
      const nextBase = (updates.baseCurrency ?? current.baseCurrency).toUpperCase();
      const nextMulti = updates.multiCurrency ?? current.multiCurrency;
      if (!nextMulti) {
        const holdings = await storage.getHoldings(id);
        const foreign = Array.from(
          new Set(
            holdings
              .map((h) => h.currency?.toUpperCase())
              .filter((c): c is string => !!c && c !== nextBase),
          ),
        );
        if (foreign.length > 0) {
          return res.status(400).json({
            error: `Operazione non consentita: il portafoglio ha posizioni in ${foreign.join(", ")}, diverse dalla valuta base ${nextBase}. Mantieni il portafoglio multivaluta oppure rimuovi/converti prima quelle posizioni.`,
          });
        }
      }

      const portfolio = Object.keys(updates).length === 0
        ? current
        : await storage.updatePortfolio(id, updates);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }
      res.json(portfolio);
    } catch {
      res.status(500).json({ error: "Failed to update portfolio" });
    }
  });

  app.delete("/api/portfolios/:id", async (req, res) => {
    try {
      await storage.deletePortfolio(parseInt(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete portfolio" });
    }
  });

  app.get("/api/portfolios/:id/holdings", async (req, res) => {
    try {
      const holdings = await storage.getHoldings(parseInt(req.params.id));
      res.json(holdings);
    } catch {
      res.status(500).json({ error: "Failed to get holdings" });
    }
  });

  // Add a position (buy). If the symbol already exists, quantity and average
  // price are recomputed (fees included). feesIncluded=true imports an existing
  // real position: commission is forced to 0 and `price` is the all-in average.
  app.post("/api/portfolios/:id/holdings", async (req, res) => {
    try {
      const portfolioId = parseInt(req.params.id);
      const portfolio = await storage.getPortfolio(portfolioId);
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      const validation = addHoldingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }
      const buy = validation.data;

      // Currency guard: a non-multi-currency portfolio rejects a different currency.
      if (!portfolio.multiCurrency && buy.currency) {
        if (buy.currency.toUpperCase() !== portfolio.baseCurrency.toUpperCase()) {
          return res.status(400).json({
            error: `Portafoglio non multivaluta: accetta solo ${portfolio.baseCurrency}, ricevuto ${buy.currency}`,
          });
        }
      }

      // Commission: 0 when fees are already included; otherwise the client value
      // (edited in the popup) or, if absent, computed from the portfolio config.
      const market = classifyMarket(buy.currency, buy.exchange, buy.symbol);
      const commission = buy.feesIncluded
        ? 0
        : buy.commission ?? commissionFor(market, portfolio, buy.quantity, buy.price);

      const existing = await storage.getHoldingBySymbol(portfolioId, buy.symbol);
      const result = applyBuy(existing, { quantity: buy.quantity, price: buy.price, commission });

      const holding = existing
        ? await storage.updateHolding(existing.id, {
            quantity: result.quantity,
            avgPrice: result.avgPrice,
            totalCost: result.totalCost,
          })
        : await storage.createHolding({
            portfolioId,
            symbol: buy.symbol,
            name: buy.name,
            exchange: buy.exchange,
            currency: buy.currency ?? null,
            quantity: result.quantity,
            avgPrice: result.avgPrice,
            totalCost: result.totalCost,
          });

      res.json(holding);
    } catch {
      res.status(500).json({ error: "Failed to add holding" });
    }
  });

  app.delete("/api/portfolios/holdings/:id", async (req, res) => {
    try {
      await storage.removeHolding(parseInt(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to remove holding" });
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

  // Chart drawing endpoints (persistent lines; armed ⇔ alertId set)
  app.get("/api/drawings/:symbol", async (req, res) => {
    try {
      const drawings = await storage.getDrawings(defaultUserId, req.params.symbol);
      res.json(drawings);
    } catch {
      res.status(500).json({ error: "Failed to get drawings" });
    }
  });

  app.post("/api/drawings", async (req, res) => {
    try {
      const validation = insertDrawingSchema.safeParse({ ...req.body, userId: defaultUserId });
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const drawing = await storage.createDrawing(validation.data);
      res.json(drawing);
    } catch {
      res.status(500).json({ error: "Failed to create drawing" });
    }
  });

  app.put("/api/drawings/:id", async (req, res) => {
    try {
      const validation = updateDrawingSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.issues });
      }

      const id = parseInt(req.params.id);
      const updates = validation.data;
      const drawing = Object.keys(updates).length === 0
        ? await storage.getDrawing(id)
        : await storage.updateDrawing(id, updates);
      if (!drawing) {
        return res.status(404).json({ error: "Drawing not found" });
      }
      // Keep the linked alert in sync right away (don't wait for the daily
      // pass): re-project the moved/armed line to now. Best-effort.
      if (drawing.alertId != null) {
        try {
          await reprojectOnce(
            { storage, getQuote: (symbol) => marketData.quote(symbol) },
            [drawing],
          );
        } catch {
          /* non-fatal: the daily reprojection will catch up */
        }
      }
      res.json(drawing);
    } catch {
      res.status(500).json({ error: "Failed to update drawing" });
    }
  });

  app.delete("/api/drawings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const drawing = await storage.getDrawing(id);
      if (drawing?.alertId != null) {
        await storage.deleteAlert(drawing.alertId);
      }
      await storage.deleteDrawing(id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete drawing" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
