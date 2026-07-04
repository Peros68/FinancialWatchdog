// Pure geometry for OHLC candlesticks rendered inside a Recharts floating Bar.
//
// The bar's dataKey is the [low, high] range, so Recharts hands the shape a pixel
// box where `y` is the high price and `y + height` is the low price. From the OHLC
// we derive, in the SAME vertical scale, the body (open→close) and the wick color.

export const CANDLE_UP_COLOR = "#16a34a"; // green — close >= open
export const CANDLE_DOWN_COLOR = "#ef4444"; // red — close < open

export interface CandleInput {
  x: number;
  y: number; // pixel of `high`
  width: number;
  height: number; // pixels spanning high → low
  open: number;
  high: number;
  low: number;
  close: number;
  /** Fraction of the column width used by the body (0..1). */
  bodyWidthRatio?: number;
}

export interface CandleGeometry {
  color: string;
  isUp: boolean;
  centerX: number;
  wickTop: number; // pixel of high
  wickBottom: number; // pixel of low
  bodyX: number;
  bodyY: number;
  bodyWidth: number;
  bodyHeight: number;
}

export function computeCandleGeometry(input: CandleInput): CandleGeometry {
  const { x, y, width, height, open, high, low, close } = input;
  const bodyWidthRatio = input.bodyWidthRatio ?? 0.7;

  const range = high - low;
  const ratio = range > 0 ? height / range : 0;
  const isUp = close >= open;

  const bodyTop = Math.max(open, close);
  const bodyBottom = Math.min(open, close);
  const bodyY = y + (high - bodyTop) * ratio;
  // Never fully collapse a doji: keep at least 1px so the candle stays visible.
  const bodyHeight = Math.max((bodyTop - bodyBottom) * ratio, 1);

  const centerX = x + width / 2;
  const bodyWidth = Math.max(width * bodyWidthRatio, 1);
  const bodyX = centerX - bodyWidth / 2;

  return {
    color: isUp ? CANDLE_UP_COLOR : CANDLE_DOWN_COLOR,
    isUp,
    centerX,
    wickTop: y,
    wickBottom: y + height,
    bodyX,
    bodyY,
    bodyWidth,
    bodyHeight,
  };
}
