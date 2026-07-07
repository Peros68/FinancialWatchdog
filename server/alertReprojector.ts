import type { ChartDrawing, StockQuote } from "@shared/schema";
import type { IStorage } from "./storage";

// Daily reprojection of drawing-backed alerts (phase 2, "modello C").
// A trend line's trigger level changes with time; the alert row only holds a
// static targetPrice. This module re-projects each armed drawing's line to
// "now" and refreshes the linked alert, so the 60s price scheduler keeps
// checking against a fresh level. Horizontal lines project to a constant,
// making their reprojection a natural no-op.

/**
 * Pure: value at `when` of the line through anchors a and b (linear in TIME).
 * With coincident anchor times the line is flat at anchor A's price — which is
 * exactly how horizontal drawings (equal prices) behave too.
 */
export function projectPriceAt(
  a: { time: Date; price: number },
  b: { time: Date; price: number },
  when: Date,
): number {
  const dt = b.time.getTime() - a.time.getTime();
  if (dt === 0) return a.price;
  const slope = (b.price - a.price) / dt;
  return a.price + slope * (when.getTime() - a.time.getTime());
}

/** Same convention as the client: a line above the price arms an "above" breakout. */
export function alertTypeFor(targetPrice: number, currentPrice: number): "above" | "below" {
  return targetPrice >= currentPrice ? "above" : "below";
}

export type ReprojectorStorage = Pick<IStorage, "getArmedDrawings" | "getActiveAlerts" | "updateAlert">;

export interface ReprojectorDeps {
  storage: ReprojectorStorage;
  getQuote: (symbol: string) => Promise<StockQuote>;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface ReprojectResult {
  armed: number; // armed drawings considered
  updated: number; // alerts whose target/type changed
  skipped: number; // armed but not eligible (alert gone/triggered/inactive, bad anchors)
  quoteErrors: number; // symbols whose quote failed (alertType kept as-is)
}

/**
 * One reprojection pass. Only drawings whose alert is still active and
 * untriggered are touched. The target is always recomputed from the anchors;
 * the direction (above/below) is re-derived from a live quote when available
 * (one per distinct symbol) and left unchanged when the quote fails.
 * With `only` set, the pass is restricted to those drawings (used by the
 * PUT /api/drawings route to re-sync right after a drag).
 */
export async function reprojectOnce(
  deps: ReprojectorDeps,
  only?: ChartDrawing[],
): Promise<ReprojectResult> {
  const { storage, getQuote } = deps;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((m) => console.log(m));

  const armed = only ?? (await storage.getArmedDrawings());
  const result: ReprojectResult = { armed: armed.length, updated: 0, skipped: 0, quoteErrors: 0 };
  if (armed.length === 0) return result;

  const activeAlerts = new Map((await storage.getActiveAlerts()).map((a) => [a.id, a]));
  const quoteCache = new Map<string, number | null>();
  const priceFor = async (symbol: string): Promise<number | null> => {
    if (quoteCache.has(symbol)) return quoteCache.get(symbol) ?? null;
    let price: number | null = null;
    try {
      const quote = await getQuote(symbol);
      price = quote != null && quote.currentPrice > 0 ? quote.currentPrice : null;
    } catch {
      result.quoteErrors++;
    }
    quoteCache.set(symbol, price);
    return price;
  };

  for (const drawing of armed) {
    const alert = drawing.alertId != null ? activeAlerts.get(drawing.alertId) : undefined;
    if (
      !alert ||
      drawing.kind === "vertical" ||
      drawing.aTime == null ||
      drawing.aPrice == null ||
      drawing.bTime == null ||
      drawing.bPrice == null
    ) {
      result.skipped++;
      continue;
    }

    const projected = projectPriceAt(
      { time: drawing.aTime, price: drawing.aPrice },
      { time: drawing.bTime, price: drawing.bPrice },
      now(),
    );
    const targetPrice = Number(projected.toFixed(4));
    const price = await priceFor(drawing.symbol);
    const alertType = price != null ? alertTypeFor(targetPrice, price) : alert.alertType;
    if (targetPrice === alert.targetPrice && alertType === alert.alertType) continue;

    await storage.updateAlert(alert.id, { targetPrice, alertType });
    result.updated++;
    log(
      `[alerts] reprojected #${alert.id} ${drawing.symbol} (${drawing.kind}) → ${alertType} ${targetPrice}`,
    );
  }
  return result;
}

/**
 * Pure: milliseconds from `now` to the next wall-clock `hour`:00:00 in the
 * given IANA time zone (DST-aware via Intl; a transition crossing the wait is
 * off by at most an hour and self-corrects at the next scheduling).
 */
export function msUntilNextHourInTz(now: Date, hour: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const secondsOfDay = get("hour") * 3600 + get("minute") * 60 + get("second");
  let deltaSeconds = hour * 3600 - secondsOfDay;
  if (deltaSeconds <= 0) deltaSeconds += 24 * 3600;
  return deltaSeconds * 1000 - now.getMilliseconds();
}

/**
 * Run `reprojectOnce` every day at `hour`:00 in `timeZone` (default 08:00
 * Europe/Rome), plus one catch-up pass immediately (covers server downtime).
 * The timeout chain is unref'd so it never keeps the process alive.
 */
export function startDailyReprojector(
  deps: ReprojectorDeps,
  hour = 8,
  timeZone = "Europe/Rome",
): { stop(): void } {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  const log = deps.log ?? ((m) => console.log(m));

  const runSafely = async () => {
    try {
      await reprojectOnce(deps);
    } catch (error) {
      console.error("[alerts] reprojection pass failed:", error);
    }
  };
  const schedule = () => {
    if (stopped) return;
    const delay = Math.max(1000, msUntilNextHourInTz(new Date(), hour, timeZone));
    timer = setTimeout(async () => {
      await runSafely();
      schedule();
    }, delay);
    timer.unref?.();
  };

  log(
    `[alerts] daily alert reprojection scheduled at ${String(hour).padStart(2, "0")}:00 ${timeZone}`,
  );
  void runSafely(); // catch-up pass at startup
  schedule();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
