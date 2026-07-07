import { describe, it, expect } from "vitest";
import { timeToIndex, indexToTime } from "@/lib/chart-drawings";

describe("timeToIndex / indexToTime (drawing persistence)", () => {
  const uniform = [1000, 2000, 3000, 4000, 5000];

  it("maps exact timestamps to integer indexes and back", () => {
    uniform.forEach((t, i) => {
      expect(timeToIndex(t, uniform)).toBe(i);
      expect(indexToTime(i, uniform)).toBe(t);
    });
  });

  it("interpolates fractional positions inside the series", () => {
    expect(timeToIndex(2500, uniform)).toBeCloseTo(1.5);
    expect(indexToTime(1.5, uniform)).toBeCloseTo(2500);
  });

  it("extrapolates outside the series using the median bar step", () => {
    expect(timeToIndex(6000, uniform)).toBeCloseTo(5); // one step past the end
    expect(timeToIndex(0, uniform)).toBeCloseTo(-1); // one step before the start
    expect(indexToTime(5, uniform)).toBeCloseTo(6000);
    expect(indexToTime(-1, uniform)).toBeCloseTo(0);
  });

  it("handles gapped series (e.g. weekends) via the median step", () => {
    const gapped = [0, 100, 200, 500]; // median diff = 100 despite the 300 gap
    expect(timeToIndex(350, gapped)).toBeCloseTo(2.5); // halfway across the gap
    expect(indexToTime(2.5, gapped)).toBeCloseTo(350);
    expect(timeToIndex(600, gapped)).toBeCloseTo(4); // extrapolation uses step 100
  });

  it("round-trips arbitrary instants", () => {
    const series = [10_000, 20_000, 30_000, 60_000, 70_000];
    for (const t of [12_345, 25_000, 65_432, 80_000, 5_000]) {
      expect(indexToTime(timeToIndex(t, series), series)).toBeCloseTo(t);
    }
  });

  it("degenerate series", () => {
    expect(timeToIndex(123, [])).toBe(0);
    expect(indexToTime(0.7, [])).toBe(0);
    expect(timeToIndex(123, [50])).toBe(0);
    expect(indexToTime(3, [50])).toBe(50);
  });
});
