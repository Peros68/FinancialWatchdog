import { describe, it, expect } from "vitest";
import {
  computeCandleGeometry,
  CANDLE_UP_COLOR,
  CANDLE_DOWN_COLOR,
} from "../client/src/lib/candles";

// Pixel box: high=110 at y=0, low=90 at y=100 → 100px span over a 20-price range = 5px/unit.
const box = { x: 10, y: 0, width: 10, height: 100, high: 110, low: 90 };

describe("computeCandleGeometry", () => {
  it("colors an up candle green (close >= open)", () => {
    const g = computeCandleGeometry({ ...box, open: 95, close: 105 });
    expect(g.isUp).toBe(true);
    expect(g.color).toBe(CANDLE_UP_COLOR);
  });

  it("colors a down candle red (close < open)", () => {
    const g = computeCandleGeometry({ ...box, open: 105, close: 95 });
    expect(g.isUp).toBe(false);
    expect(g.color).toBe(CANDLE_DOWN_COLOR);
  });

  it("wick spans the full high→low pixel box", () => {
    const g = computeCandleGeometry({ ...box, open: 100, close: 100 });
    expect(g.wickTop).toBe(0); // high
    expect(g.wickBottom).toBe(100); // low
    expect(g.centerX).toBe(15); // x + width/2
  });

  it("positions the body between open and close in the correct scale", () => {
    // up candle open=95 close=105: body top at 105, bottom at 95.
    // 5px per unit → top is (110-105)*5 = 25px from the top; height (105-95)*5 = 50px.
    const g = computeCandleGeometry({ ...box, open: 95, close: 105 });
    expect(g.bodyY).toBeCloseTo(25);
    expect(g.bodyHeight).toBeCloseTo(50);
  });

  it("orients the body identically regardless of direction (only color flips)", () => {
    const up = computeCandleGeometry({ ...box, open: 95, close: 105 });
    const down = computeCandleGeometry({ ...box, open: 105, close: 95 });
    expect(down.bodyY).toBeCloseTo(up.bodyY);
    expect(down.bodyHeight).toBeCloseTo(up.bodyHeight);
    expect(up.color).not.toBe(down.color);
  });

  it("keeps a doji (open == close) visible with a minimum 1px body", () => {
    const g = computeCandleGeometry({ ...box, open: 100, close: 100 });
    expect(g.bodyHeight).toBe(1);
  });

  it("makes the body narrower than the column to leave gaps", () => {
    const g = computeCandleGeometry({ ...box, open: 95, close: 105 });
    expect(g.bodyWidth).toBeLessThan(box.width);
    expect(g.bodyWidth).toBeCloseTo(7); // width * 0.7
  });

  it("does not divide by zero when high == low (flat bar)", () => {
    const g = computeCandleGeometry({
      x: 0, y: 50, width: 10, height: 0, high: 100, low: 100, open: 100, close: 100,
    });
    expect(Number.isFinite(g.bodyY)).toBe(true);
    expect(g.bodyHeight).toBe(1);
  });
});
