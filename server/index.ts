import "./loadEnv"; // MUST be first: loads .env before provider modules read process.env
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createAlertScheduler } from "./alertScheduler";
import { startDailyReprojector } from "./alertReprojector";
import { storage } from "./storage";
import { marketData } from "./marketData";

// Cross-platform environment detection.
// Inline `NODE_ENV=...` in npm scripts is not portable (POSIX shells vs Windows
// cmd), so the scripts no longer set it. We honor NODE_ENV when explicitly
// provided and otherwise infer the mode from the entrypoint: the bundled
// production build runs as dist/index.js, while development runs the TypeScript
// source via tsx (index.ts).
const isProduction =
  process.env.NODE_ENV === "production" ||
  (process.env.NODE_ENV === undefined && import.meta.url.endsWith(".js"));
process.env.NODE_ENV = isProduction ? "production" : "development";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error(err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app (both API and client) on port 5000.
  // `reusePort` is intentionally omitted: SO_REUSEPORT is not supported on all
  // platforms (e.g. Windows) and can make listen() fail on recent Node versions.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });

  // Alert monitoring phase 2 (server-side): periodically compare active alerts
  // against live quotes and persist `triggeredAt` when a target is hit.
  // ALERT_CHECK_INTERVAL_MS overrides the 60s default; 0 (or "off") disables it.
  const rawInterval = process.env.ALERT_CHECK_INTERVAL_MS;
  const intervalMs = rawInterval === undefined ? 60_000 : Number(rawInterval);
  if (Number.isFinite(intervalMs) && intervalMs >= 1000) {
    const scheduler = createAlertScheduler(
      { storage, getQuote: (symbol) => marketData.quote(symbol), log },
      intervalMs,
    );
    scheduler.start();
    // Daily at 08:00 Italy: re-project trend-line alerts to "now" so the
    // scheduler above always checks against a fresh target.
    startDailyReprojector({ storage, getQuote: (symbol) => marketData.quote(symbol), log });
  } else {
    log("[alerts] server-side monitoring disabled (ALERT_CHECK_INTERVAL_MS)");
  }
})();
