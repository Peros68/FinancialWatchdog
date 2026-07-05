import { describe, it, expect } from "vitest";
import {
  formatAxisTick,
  formatTooltipLabel,
  selectTicks,
  granularityFor,
} from "../client/src/lib/chart-axis";

// Fixed instants (local time) used across the assertions.
const jan5_0930 = new Date(2024, 0, 5, 9, 30).getTime(); // 5 gen 2024, 09:30
const mar1 = new Date(2024, 2, 1, 12, 0).getTime();

describe("granularityFor", () => {
  it("maps 5A→year, 1A→month, 1G/1H→time", () => {
    expect(granularityFor("5Y")).toBe("year");
    expect(granularityFor("1Y")).toBe("month");
    expect(granularityFor("1D")).toBe("time");
    expect(granularityFor("1h")).toBe("time");
  });
});

describe("formatAxisTick", () => {
  it("shows the 4-digit year for 5A", () => {
    expect(formatAxisTick(jan5_0930, "5Y")).toBe("2024");
  });
  it("shows the Italian short month for 1A", () => {
    expect(formatAxisTick(jan5_0930, "1Y")).toBe("gen");
    expect(formatAxisTick(mar1, "1Y")).toBe("mar");
  });
  it("shows day + month for weekly/monthly views", () => {
    expect(formatAxisTick(jan5_0930, "1W")).toBe("5 gen");
  });
  it("shows zero-padded HH:mm for intraday views", () => {
    expect(formatAxisTick(jan5_0930, "1D")).toBe("09:30");
    expect(formatAxisTick(jan5_0930, "1h")).toBe("09:30");
  });
});

describe("formatTooltipLabel", () => {
  it("is more detailed than the axis tick: shows day+month+year even for 5A", () => {
    expect(formatAxisTick(jan5_0930, "5Y")).toBe("2024"); // axis stays compact
    expect(formatTooltipLabel(jan5_0930, "5Y")).toBe("5 gen 2024"); // tooltip detailed
  });
  it("shows day+month+year for the year view", () => {
    expect(formatTooltipLabel(jan5_0930, "1Y")).toBe("5 gen 2024");
  });
  it("appends the time-of-day on intraday views", () => {
    expect(formatTooltipLabel(jan5_0930, "1D")).toBe("5 gen 2024, 09:30");
    expect(formatTooltipLabel(jan5_0930, "1h")).toBe("5 gen 2024, 09:30");
  });
});

describe("selectTicks", () => {
  it("returns every timestamp when there are fewer than the target", () => {
    const ts = [1, 2, 3];
    expect(selectTicks(ts, "1D", 6)).toEqual([1, 2, 3]);
  });

  it("thins a dense intraday series to the target, keeping first and last", () => {
    const ts = Array.from({ length: 100 }, (_, i) => i + 1);
    const ticks = selectTicks(ts, "1D", 6);
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks[0]).toBe(1);
    expect(ticks[ticks.length - 1]).toBe(100);
  });

  it("picks one tick per year for a 5A series", () => {
    // ~monthly points across 5 calendar years.
    const ts: number[] = [];
    for (let y = 2021; y <= 2025; y++) {
      for (let m = 0; m < 12; m++) ts.push(new Date(y, m, 1).getTime());
    }
    const ticks = selectTicks(ts, "5Y", 6);
    const labels = ticks.map((t) => formatAxisTick(t, "5Y"));
    // One label per distinct year, no duplicates, chronological.
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("2021");
    expect(labels).toContain("2025");
  });

  it("spreads 1A (month) ticks evenly across the series, not bunched by period", () => {
    // 252 trading days across a year (like Yahoo interval=1d range=1y).
    const start = new Date(2024, 7, 1).getTime(); // ago
    const day = 24 * 3600 * 1000;
    const ts = Array.from({ length: 252 }, (_, i) => start + i * day * (365 / 252));
    const ticks = selectTicks(ts, "1Y", 6);
    // Chosen positions are (near-)uniform: gaps within ~1 tick of each other.
    const idx = ticks.map((t) => ts.indexOf(t));
    const gaps = idx.slice(1).map((v, i) => v - idx[i]);
    const maxGap = Math.max(...gaps);
    const minGap = Math.min(...gaps);
    expect(maxGap - minGap).toBeLessThanOrEqual(2);
    // Distinct month labels, spanning the whole year.
    const labels = ticks.map((t) => formatAxisTick(t, "1Y"));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("returns a subset of the input timestamps (aligns with the category axis)", () => {
    const ts = Array.from({ length: 40 }, (_, i) => new Date(2024, 0, 1 + i).getTime());
    const ticks = selectTicks(ts, "1Y", 6);
    expect(ticks.every((t) => ts.includes(t))).toBe(true);
  });
});
