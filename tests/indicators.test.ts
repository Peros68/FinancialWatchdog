import { describe, it, expect } from "vitest";
import { computeRSI } from "../client/src/lib/indicators";

describe("computeRSI", () => {
  it("returns all-null when there is not enough data", () => {
    expect(computeRSI([1, 2, 3], 14)).toEqual([null, null, null]);
    // exactly `period` closes still can't produce a value (needs period+1)
    expect(computeRSI([1, 2, 3, 4], 3)).toEqual([null, null, null, 100]);
  });

  it("is 100 for a monotonically rising series (no losses)", () => {
    const closes = [1, 2, 3, 4, 5, 6];
    const rsi = computeRSI(closes, 3);
    // first 3 are null, the rest are defined and equal to 100
    expect(rsi.slice(0, 3)).toEqual([null, null, null]);
    for (let i = 3; i < rsi.length; i++) expect(rsi[i]).toBeCloseTo(100, 6);
  });

  it("is 0 for a monotonically falling series (no gains)", () => {
    const closes = [6, 5, 4, 3, 2, 1];
    const rsi = computeRSI(closes, 3);
    for (let i = 3; i < rsi.length; i++) expect(rsi[i]).toBeCloseTo(0, 6);
  });

  it("sits near 50 for alternating equal up/down moves", () => {
    const closes = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11];
    const rsi = computeRSI(closes, 4);
    const last = rsi[rsi.length - 1];
    expect(last).not.toBeNull();
    expect(last as number).toBeGreaterThan(30);
    expect(last as number).toBeLessThan(70);
  });
});
