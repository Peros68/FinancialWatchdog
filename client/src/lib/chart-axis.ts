// Pure helpers for the X-axis of the stock chart: how compactly to label the
// bottom axis for a given timeframe, and which timestamps to show as ticks so
// the area never gets crowded.
//
// Rule of thumb requested by the product:
//   5A (5 anni)  → una manciata di ANNI      es. 2022 … 2025
//   1A (1 anno)  → MESI                        es. gen, feb, …
//   1G (1 giorno)→ ORE                         es. 09:30, 12:00, …
//   1H (1 ora)   → MINUTI                      es. 14:05, 14:20, …
// Minute/hour timeframes render as time-of-day (HH:mm); day timeframes as
// "5 gen"; month as short month; year as the 4-digit year.

export type AxisGranularity = "time" | "day" | "month" | "year";

// Locale-independent Italian short months so tick labels are deterministic
// (and unit-testable) regardless of the host Intl data.
const SHORT_MONTHS_IT = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

// Map every timeframe value used by the chart to how its axis should read.
const GRANULARITY: Record<string, AxisGranularity> = {
  "1m": "time",
  "5m": "time",
  "15m": "time",
  "30m": "time",
  "1h": "time", // 1H → minuti (time-of-day)
  "1D": "time", // 1G → ore (time-of-day)
  "1W": "day",
  "1Mo": "day",
  "3Mo": "day",
  "6Mo": "day",
  "1Y": "month", // 1A → mesi
  "5Y": "year", // 5A → anni
};

export function granularityFor(timeframe: string): AxisGranularity {
  return GRANULARITY[timeframe] ?? "day";
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Compact label for a single axis tick, chosen by the timeframe's granularity. */
export function formatAxisTick(timestamp: number, timeframe: string): string {
  const d = new Date(timestamp);
  switch (granularityFor(timeframe)) {
    case "year":
      return `${d.getFullYear()}`;
    case "month":
      return SHORT_MONTHS_IT[d.getMonth()];
    case "day":
      return `${d.getDate()} ${SHORT_MONTHS_IT[d.getMonth()]}`;
    case "time":
    default:
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
}

/**
 * Fuller label for the hover tooltip: always more detailed than the axis tick,
 * so the user can tell exactly which point a price refers to. E.g. on the 5A
 * (year) view the axis reads "2024" but the tooltip reads "5 gen 2024"; on
 * intraday views the time-of-day is appended.
 */
export function formatTooltipLabel(timestamp: number, timeframe: string): string {
  const d = new Date(timestamp);
  const date = `${d.getDate()} ${SHORT_MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`;
  if (granularityFor(timeframe) === "time") {
    return `${date}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return date;
}

// Reduce an ordered array to at most `target` items, evenly spaced and always
// keeping the first and last element.
function thin<T>(items: T[], target: number): T[] {
  if (items.length <= target) return items;
  if (target <= 1) return [items[0]];
  const out: T[] = [];
  const step = (items.length - 1) / (target - 1);
  for (let i = 0; i < target; i++) {
    out.push(items[Math.round(i * step)]);
  }
  // Rounding can produce duplicates near the ends; keep them unique & ordered.
  return Array.from(new Set(out));
}

/**
 * Pick the timestamps to render as axis ticks for the given timeframe.
 * Ticks are spread **evenly across the whole series** (so the labels are equally
 * spaced in the plot, never bunched up):
 * - year:  one tick per distinct calendar year (2021 … 2025).
 * - month/day/time: evenly spaced by position, then consecutive duplicate labels
 *   are dropped (e.g. two ticks that would both read "gen").
 * The result is always a subset of `timestamps`, so it aligns with the chart's
 * categorical X scale.
 */
export function selectTicks(
  timestamps: number[],
  timeframe: string,
  target = 6,
): number[] {
  if (timestamps.length === 0) return [];
  if (timestamps.length <= target) return [...timestamps];

  const g = granularityFor(timeframe);

  // Years read best as one label per distinct year rather than by raw position.
  if (g === "year") {
    const firsts: number[] = [];
    let last = "";
    for (const t of timestamps) {
      const key = `${new Date(t).getFullYear()}`;
      if (key !== last) {
        firsts.push(t);
        last = key;
      }
    }
    return thin(firsts, target);
  }

  const even = thin(timestamps, target);

  // For month/day, evenly spaced positions can occasionally land on the same
  // label (same month/day) — drop the repeat so the axis reads cleanly.
  if (g === "month" || g === "day") {
    const out: number[] = [];
    let prevLabel: string | null = null;
    for (const t of even) {
      const label = formatAxisTick(t, timeframe);
      if (label !== prevLabel) {
        out.push(t);
        prevLabel = label;
      }
    }
    return out;
  }

  return even;
}
