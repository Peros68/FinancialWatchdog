import type { Alert, StockQuote } from "@shared/schema";
import type { IStorage } from "./storage";

/**
 * Pure trigger check (server-side, phase 2). Same semantics as the client v1
 * (`alertsApi.isAlertTriggered`): "above" → price >= target, "below" → price <= target.
 * Never triggers on unavailable/invalid prices or unknown alert types.
 */
export function shouldTrigger(
  alert: Pick<Alert, "targetPrice" | "alertType">,
  price: number | null,
): boolean {
  if (price == null || !Number.isFinite(price) || price <= 0) return false;
  if (alert.alertType === "above") return price >= alert.targetPrice;
  if (alert.alertType === "below") return price <= alert.targetPrice;
  return false;
}

/** Storage surface the scheduler needs (kept narrow for testability). */
export type SchedulerStorage = Pick<IStorage, "getActiveAlerts" | "updateAlert">;

export interface SchedulerDeps {
  storage: SchedulerStorage;
  getQuote: (symbol: string) => Promise<StockQuote>;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface CheckResult {
  checked: number; // active alerts considered
  symbols: number; // distinct symbols quoted
  triggered: number; // alerts marked with triggeredAt
  quoteErrors: number; // symbols whose quote failed (alerts left untouched)
}

/**
 * One monitoring pass: read active (not yet triggered) alerts, quote each distinct
 * symbol once, and stamp `triggeredAt` on the alerts whose target was hit.
 * Quote failures are per-symbol and non-fatal: those alerts stay eligible for the
 * next pass. `isActive` is left untouched (it remains a user-controlled switch);
 * a triggered alert stops being monitored because `triggeredAt` is now set.
 */
export async function checkAlertsOnce(deps: SchedulerDeps): Promise<CheckResult> {
  const { storage, getQuote } = deps;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((m) => console.log(m));

  const active = await storage.getActiveAlerts();
  const result: CheckResult = { checked: active.length, symbols: 0, triggered: 0, quoteErrors: 0 };
  if (active.length === 0) return result;

  const bySymbol = new Map<string, Alert[]>();
  for (const alert of active) {
    const group = bySymbol.get(alert.symbol);
    if (group) group.push(alert);
    else bySymbol.set(alert.symbol, [alert]);
  }
  result.symbols = bySymbol.size;

  for (const [symbol, group] of Array.from(bySymbol.entries())) {
    let price: number | null;
    try {
      const quote = await getQuote(symbol);
      price = quote?.currentPrice ?? null;
    } catch {
      result.quoteErrors++;
      continue;
    }
    for (const alert of group) {
      if (!shouldTrigger(alert, price)) continue;
      await storage.updateAlert(alert.id, { triggeredAt: now() });
      result.triggered++;
      log(
        `[alerts] triggered #${alert.id} ${symbol} ${alert.alertType} ${alert.targetPrice} (price ${price})`,
      );
    }
  }
  return result;
}

export interface AlertScheduler {
  start(): void;
  stop(): void;
  /** Run a single pass immediately (also used by tests). */
  runOnce(): Promise<CheckResult>;
  readonly running: boolean;
}

/**
 * Periodic runner around `checkAlertsOnce`. Passes never overlap: if one is still
 * in flight when the interval fires, the tick is skipped. The timer is unref'd so
 * it never keeps the process alive on its own.
 */
export function createAlertScheduler(deps: SchedulerDeps, intervalMs: number): AlertScheduler {
  let timer: NodeJS.Timeout | undefined;
  let inFlight = false;
  const log = deps.log ?? ((m) => console.log(m));

  async function runOnce(): Promise<CheckResult> {
    if (inFlight) return { checked: 0, symbols: 0, triggered: 0, quoteErrors: 0 };
    inFlight = true;
    try {
      return await checkAlertsOnce(deps);
    } catch (error) {
      console.error("[alerts] monitoring pass failed:", error);
      return { checked: 0, symbols: 0, triggered: 0, quoteErrors: 0 };
    } finally {
      inFlight = false;
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => void runOnce(), intervalMs);
      timer.unref?.();
      log(`[alerts] server-side monitoring started (every ${Math.round(intervalMs / 1000)}s)`);
      void runOnce(); // immediate first pass, don't wait a full interval
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
    },
    runOnce,
    get running() {
      return timer !== undefined;
    },
  };
}
