// Pure geometry for the chart drawing tools (price alert lines).
//
// Two kinds of user-drawn objects:
//   - horizontal line: a single price level (a classic support/resistance alert).
//   - trend line: an inclined line through two anchor points, each pinned to a
//     data column (fractional index) and a price. Its value at "now" is the
//     projection to the last column — that is the price the alert watches.
//
// A drawn line stays anchored to the data: X is a fractional data index (0..n-1)
// and Y is a price, both independent of pixel size so the line survives resizes.

export interface Anchor {
  index: number; // fractional position across the series (0 .. n-1)
  price: number;
}

export interface HorizontalLine {
  id: string;
  kind: "horizontal";
  price: number;
}

export interface TrendLine {
  id: string;
  kind: "trend";
  a: Anchor;
  b: Anchor;
}

export type Drawing = HorizontalLine | TrendLine;

/** Plot rectangle handed to us by Recharts' <Customized> (in SVG pixel space). */
export interface PlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** X pixel for a fractional data index within the plot box. */
export function indexToX(index: number, n: number, box: PlotBox): number {
  if (n <= 1) return box.left + box.width / 2;
  const clamped = Math.max(0, Math.min(n - 1, index));
  return box.left + (clamped / (n - 1)) * box.width;
}

/** Inverse of indexToX: nearest fractional data index for an X pixel. */
export function xToIndex(x: number, n: number, box: PlotBox): number {
  if (n <= 1 || box.width === 0) return 0;
  const frac = (x - box.left) / box.width;
  return Math.max(0, Math.min(n - 1, frac * (n - 1)));
}

/**
 * Value of a trend line at a given fractional index (linear extrapolation).
 * When both anchors share a column the line is flat at anchor A's price.
 */
export function trendValueAt(line: TrendLine, index: number): number {
  const { a, b } = line;
  if (b.index === a.index) return a.price;
  const slope = (b.price - a.price) / (b.index - a.index);
  return a.price + slope * (index - a.index);
}

/**
 * The price a drawing's alert should watch, evaluated at the latest column.
 * Horizontal → its level; trend → its projection to the last data point.
 */
export function alertPriceFor(drawing: Drawing, n: number): number {
  if (drawing.kind === "horizontal") return drawing.price;
  return trendValueAt(drawing, n - 1);
}

/**
 * Alert direction relative to the current price: a line above the price arms an
 * "above" breakout; a line below arms a "below" breakdown.
 */
export function alertTypeFor(targetPrice: number, currentPrice: number): "above" | "below" {
  return targetPrice >= currentPrice ? "above" : "below";
}
