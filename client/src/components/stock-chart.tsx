import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  TrendingUp,
  CandlestickChart,
  ChevronDown,
  PencilRuler,
  Minus,
  Slash,
  GripHorizontal,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { ChartData } from "@shared/schema";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  ComposedChart,
  Customized,
} from "recharts";
import { cn } from "@/lib/utils";
import { computeCandleGeometry } from "@/lib/candles";
import { formatAxisTick, formatTooltipLabel, selectTicks } from "@/lib/chart-axis";
import {
  indexToX,
  xToIndex,
  trendValueAt,
  alertPriceFor,
  alertTypeFor,
  timeToIndex,
  indexToTime,
  type Anchor,
  type PlotBox,
} from "@/lib/chart-drawings";
import {
  fetchDrawings,
  createDrawing as apiCreateDrawing,
  updateDrawing as apiUpdateDrawing,
  deleteDrawing as apiDeleteDrawing,
  type DrawingRow,
  type DrawingAnchorsPayload,
} from "@/lib/drawingsApi";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AlertModal from "./alert-modal";

interface StockChartProps {
  symbol: string;
  currentPrice?: number;
}

// Quick period selectors. Convention: minuti in minuscolo (15m); dall'ora in su
// lettera maiuscola (1H ora, 1G giorno, 1S settimana, 1M mese, 1A anno).
const quickTimeframes = [
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "1G", value: "1D" },
  { label: "1S", value: "1W" },
  { label: "1M", value: "1Mo" },
  { label: "1A", value: "1Y" }, // default
  { label: "5A", value: "5Y" },
];

// Full list for the "more" dropdown; every value must resolve in getYahooParams.
const allTimeframes = [
  { label: "1 Minuto", value: "1m" },
  { label: "5 Minuti", value: "5m" },
  { label: "15 Minuti", value: "15m" },
  { label: "30 Minuti", value: "30m" },
  { label: "1 Ora", value: "1h" },
  { label: "1 Giorno", value: "1D" },
  { label: "1 Settimana", value: "1W" },
  { label: "1 Mese", value: "1Mo" },
  { label: "1 Anno", value: "1Y" },
  { label: "5 Anni", value: "5Y" },
];

// ---- Drawing tools (price alert lines) -------------------------------------
type DrawMode = "horizontal" | "trend" | "vertical" | null;

// Every drawing is persisted in the DB (dbId) with TIME anchors; on screen it
// lives as fractional data indexes. Trend/vertical also carry their canonical
// times so indexes can be recomputed when the loaded timeframe changes.
interface HLine {
  id: string;
  kind: "horizontal";
  price: number;
  armed?: boolean; // acts as a sound alert when the price touches it
  alertId?: number;
  dbId?: number;
}
interface TLine {
  id: string;
  kind: "trend";
  a: Anchor;
  b: Anchor;
  times?: { a: number; b: number }; // anchor instants (epoch ms), persisted form
  armed?: boolean;
  alertId?: number;
  dbId?: number;
}
interface VLine {
  id: string;
  kind: "vertical";
  index: number; // fractional data position; the day is shown at its base
  time?: number; // canonical instant (epoch ms), persisted form
  dbId?: number;
}
type Drawing = HLine | TLine | VLine;

type DragTarget = { id: string; handle: "level" | "a" | "b" | "x" } | null;

// Short beep via Web Audio, played when the price touches an armed line.
let sharedAudioCtx: AudioContext | null = null;
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    sharedAudioCtx = sharedAudioCtx || new Ctx();
    const ctx = sharedAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio not available */
  }
}

// Drawn alert lines use white so they stand out over the coloured price series.
const DRAW_COLOR = "#ffffff";
// Width of the empty left margin that hosts the horizontal-alert controls.
const LEFT_MARGIN = 82;
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `d${Date.now()}${Math.random().toString(16).slice(2)}`;

// Editable price field for a horizontal alert line. It owns its text state so
// typing re-renders ONLY this input — not StockChart / Recharts — which keeps the
// chart from being redrawn on every keystroke. The line moves only on commit.
function PriceInput({
  initial,
  onFocusStart,
  onCommit,
}: {
  initial: number;
  onFocusStart: () => void;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState(initial.toFixed(2));
  const focused = useRef(false);
  // Reflect external changes (e.g. slider drag) while not being edited.
  useEffect(() => {
    if (!focused.current) setText(initial.toFixed(2));
  }, [initial]);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label="Prezzo alert"
      autoFocus
      value={text}
      onFocus={(e) => {
        focused.current = true;
        onFocusStart();
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const v = parseFloat(text.replace(",", "."));
        onCommit(Number.isFinite(v) ? v : null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      style={{
        width: 44,
        fontSize: 10,
        padding: "1px 3px",
        textAlign: "right",
        background: "#fff",
        color: "#000",
        border: "1px solid #bbb",
        borderRadius: 3,
      }}
    />
  );
}

// Custom candlestick shape rendered inside a Recharts floating Bar (dataKey=[low, high]).
function Candle(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const { open, high, low, close } = payload;
  const g = computeCandleGeometry({ x, y, width, height, open, high, low, close });

  return (
    <g stroke={g.color} fill={g.color}>
      <line x1={g.centerX} y1={g.wickTop} x2={g.centerX} y2={g.wickBottom} strokeWidth={1} />
      <rect x={g.bodyX} y={g.bodyY} width={g.bodyWidth} height={g.bodyHeight} />
    </g>
  );
}

export default function StockChart({ symbol, currentPrice }: StockChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1Y");
  const [chartType, setChartType] = useState<"line" | "candlestick">("line");
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  // Tooltip + current-price level line. Can be hidden so they don't get in the
  // way while drawing a trend line.
  const [showPriceGuides, setShowPriceGuides] = useState(true);
  // Line whose controls (dots / editable price + delete) are currently shown.
  // Auto-hides after a few idle seconds to keep the chart clean.
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);

  // Drawing tools state.
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pendingAnchor, setPendingAnchor] = useState<Anchor | null>(null);
  const [hover, setHover] = useState<Anchor | null>(null);
  const [drag, setDrag] = useState<DragTarget>(null);

  const plotWrapRef = useRef<HTMLDivElement>(null);
  // Latest Recharts plot geometry, refreshed on every render of the draw layer.
  const geomRef = useRef<{ yScale: any; box: PlotBox; n: number } | null>(null);
  // Stable <Customized> component: it must keep the same identity across renders
  // so React reconciles (instead of remounting) the SVG overlay — otherwise the
  // editable price <input> would lose focus on every keystroke. It always calls
  // the latest render closure via a ref.
  const drawLayerRenderRef = useRef<(rc: any) => any>(() => null);
  const drawLayerComponentRef = useRef<((rc: any) => any) | null>(null);
  if (!drawLayerComponentRef.current) {
    drawLayerComponentRef.current = (rc: any) => drawLayerRenderRef.current(rc);
  }
  // Previous current price, to detect when it crosses an armed line.
  const prevPriceRef = useRef<number | null>(null);
  // Idle timer that hides a line's controls after a few seconds.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  };
  // Reveal a line's controls and (re)arm the auto-hide timer on any interaction.
  const pokeDrawing = (id: string) => {
    setActiveDrawingId(id);
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => setActiveDrawingId(null), 3000);
  };
  useEffect(() => () => clearIdleTimer(), []);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: chartData, isLoading } = useQuery({
    queryKey: [`/api/yahoo/chart/${symbol}`, selectedTimeframe],
    queryFn: async () => {
      const getYahooParams = (timeframe: string) => {
        switch (timeframe) {
          case '1m': return { interval: '1m', range: '1d' };
          case '5m': return { interval: '5m', range: '1d' };
          case '15m': return { interval: '15m', range: '1d' };
          case '30m': return { interval: '30m', range: '5d' };
          case '1h': return { interval: '60m', range: '5d' };
          case '1D': return { interval: '5m', range: '1d' };   // 1 giorno (intraday)
          case '1W': return { interval: '60m', range: '5d' };  // 1 settimana
          case '1Mo': return { interval: '1d', range: '1mo' }; // 1 mese
          case '1Y': return { interval: '1d', range: '1y' };   // 1 anno
          case '5Y': return { interval: '1wk', range: '5y' };  // 5 anni
          default: return { interval: '1d', range: '1y' };
        }
      };

      const { interval, range } = getYahooParams(selectedTimeframe);
      const response = await fetch(`/api/yahoo/chart/${symbol}?interval=${interval}&range=${range}`);
      if (!response.ok) throw new Error('Failed to fetch chart data');
      const data = await response.json();

      const result = data.chart?.result?.[0];
      if (!result?.timestamp || !result?.indicators?.quote?.[0]?.close) {
        throw new Error('Invalid chart data format');
      }

      const timestamps = result.timestamp;
      const closes = result.indicators.quote[0].close;
      const opens = result.indicators.quote[0].open;
      const highs = result.indicators.quote[0].high;
      const lows = result.indicators.quote[0].low;
      const volumes = result.indicators.quote[0].volume;

      return {
        data: timestamps.map((timestamp: number, index: number) => ({
          timestamp: timestamp * 1000,
          open: opens[index] || 0,
          high: highs[index] || 0,
          low: lows[index] || 0,
          close: closes[index] || 0,
          volume: volumes[index] || 0
        })).filter((item: any) => item.close > 0)
      };
    },
    enabled: !!symbol,
  });

  const formatChartData = (data: ChartData[]) => {
    return data.map(item => ({
      ...item,
      date: new Date(item.timestamp).toLocaleDateString(),
      time: new Date(item.timestamp).toLocaleTimeString(),
      highLow: [item.low, item.high] as [number, number],
    }));
  };

  const chartDataFormatted = chartData ? formatChartData(chartData.data) : [];
  const n = chartDataFormatted.length;

  // Shared Y domain from real highs/lows so candle wicks are never clipped.
  const priceExtent = chartDataFormatted.reduce(
    (acc, d) => ({ min: Math.min(acc.min, d.low), max: Math.max(acc.max, d.high) }),
    { min: Infinity, max: -Infinity }
  );
  const pad =
    priceExtent.max > priceExtent.min ? (priceExtent.max - priceExtent.min) * 0.05 : 1;
  const yDomain: [number, number] = [priceExtent.min - pad, priceExtent.max + pad];

  const lastClose = n > 0 ? chartDataFormatted[n - 1].close : undefined;
  const refPrice = currentPrice ?? lastClose ?? 0;

  // Compact, uncrowded X ticks chosen from the real timestamps.
  const timestamps = chartDataFormatted.map((d) => d.timestamp);
  const xTicks = selectTicks(timestamps, selectedTimeframe);

  const nextChartType = chartType === "line" ? "candlestick" : "line";

  // ---- Persistence: drawings live in the DB and survive reloads -------------
  const { data: savedDrawings } = useQuery<DrawingRow[]>({
    queryKey: ["/api/drawings", symbol],
    queryFn: () => fetchDrawings(symbol),
    enabled: !!symbol,
  });
  const hydratedSymbolRef = useRef<string | null>(null);
  const invalidateDrawings = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/drawings", symbol] });
  const invalidateAlerts = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    queryClient.invalidateQueries({ queryKey: [`/api/alerts/${symbol}`] });
  };

  // DB row → local drawing (times are canonical; indexes derive from the series).
  const rowToLocal = (row: DrawingRow): Drawing | null => {
    if (row.kind === "horizontal") {
      const price = row.aPrice ?? row.bPrice;
      if (price == null) return null;
      return {
        id: uid(),
        kind: "horizontal",
        price,
        armed: row.alertId != null,
        alertId: row.alertId ?? undefined,
        dbId: row.id,
      };
    }
    if (row.kind === "vertical") {
      if (row.aTime == null) return null;
      const time = new Date(row.aTime).getTime();
      return { id: uid(), kind: "vertical", index: timeToIndex(time, timestamps), time, dbId: row.id };
    }
    if (row.aTime == null || row.aPrice == null || row.bTime == null || row.bPrice == null) return null;
    const ta = new Date(row.aTime).getTime();
    const tb = new Date(row.bTime).getTime();
    return {
      id: uid(),
      kind: "trend",
      a: { index: timeToIndex(ta, timestamps), price: row.aPrice },
      b: { index: timeToIndex(tb, timestamps), price: row.bPrice },
      times: { a: ta, b: tb },
      armed: row.alertId != null,
      alertId: row.alertId ?? undefined,
      dbId: row.id,
    };
  };

  // Local drawing → anchor payload (prices rounded, times as ISO strings).
  const anchorsPayloadFor = (d: Drawing): DrawingAnchorsPayload => {
    const iso = (ms: number) => new Date(ms).toISOString();
    if (d.kind === "horizontal") {
      const price = Number(d.price.toFixed(4));
      return {
        aTime: iso(timestamps[0] ?? Date.now()),
        aPrice: price,
        bTime: iso(timestamps[n - 1] ?? Date.now()),
        bPrice: price,
      };
    }
    if (d.kind === "vertical") {
      return { aTime: iso(d.time ?? indexToTime(d.index, timestamps)) };
    }
    return {
      aTime: iso(d.times?.a ?? indexToTime(d.a.index, timestamps)),
      aPrice: Number(d.a.price.toFixed(4)),
      bTime: iso(d.times?.b ?? indexToTime(d.b.index, timestamps)),
      bPrice: Number(d.b.price.toFixed(4)),
    };
  };

  // Refresh a drawing's canonical times from its (just-moved) indexes.
  const withFreshTimes = (d: Drawing): Drawing => {
    if (d.kind === "trend") {
      return {
        ...d,
        times: { a: indexToTime(d.a.index, timestamps), b: indexToTime(d.b.index, timestamps) },
      };
    }
    if (d.kind === "vertical") return { ...d, time: indexToTime(d.index, timestamps) };
    return d;
  };

  // Reset local drawings when the symbol changes; they re-hydrate from the DB.
  useEffect(() => {
    setDrawings([]);
    hydratedSymbolRef.current = null;
    setDrawMode(null);
    setPendingAnchor(null);
    setHover(null);
    setActiveDrawingId(null);
  }, [symbol]);

  // Hydrate once per symbol, as soon as both the rows and the series are ready.
  useEffect(() => {
    if (!savedDrawings || n === 0) return;
    if (hydratedSymbolRef.current === symbol) return;
    hydratedSymbolRef.current = symbol;
    setDrawings(savedDrawings.map(rowToLocal).filter((d): d is Drawing => d !== null));
  }, [savedDrawings, n, symbol]);

  // When the loaded series changes (timeframe switch), recompute the indexes of
  // time-anchored drawings so they stay pinned to their instants.
  const seriesKey = n > 0 ? `${symbol}|${selectedTimeframe}|${timestamps[0]}|${timestamps[n - 1]}|${n}` : symbol;
  useEffect(() => {
    if (n === 0) return;
    setDrawings((prev) =>
      prev.map((d) => {
        if (d.kind === "trend" && d.times) {
          return {
            ...d,
            a: { index: timeToIndex(d.times.a, timestamps), price: d.a.price },
            b: { index: timeToIndex(d.times.b, timestamps), price: d.b.price },
          };
        }
        if (d.kind === "vertical" && d.time != null) {
          return { ...d, index: timeToIndex(d.time, timestamps) };
        }
        return d;
      }),
    );
  }, [seriesKey]);

  // Save a freshly drawn line; on success remember its DB id on the local copy.
  const persistNew = async (drawing: Drawing) => {
    try {
      const created = await apiCreateDrawing({ symbol, kind: drawing.kind, ...anchorsPayloadFor(drawing) });
      if (created?.id) {
        setDrawings((prev) => prev.map((d) => (d.id === drawing.id ? { ...d, dbId: created.id } : d)));
        invalidateDrawings();
      }
    } catch {
      toast({
        title: "Linea non salvata",
        description: "La linea resta visibile ma non è stata salvata sul server.",
        variant: "destructive",
      });
    }
  };

  // Push moved/edited anchors; the SERVER re-projects the linked alert (single
  // source of truth). Falls back to the client-side alert sync when the line
  // was never persisted.
  const persistAnchors = async (drawing: Drawing) => {
    if (!drawing.dbId) {
      syncAlertFor(drawing);
      return;
    }
    try {
      await apiUpdateDrawing(drawing.dbId, anchorsPayloadFor(drawing));
      invalidateDrawings();
      if (drawing.kind !== "vertical" && drawing.alertId) invalidateAlerts();
    } catch {
      /* non-fatal: the daily server reprojection will catch up */
    }
  };

  // Sound alert: when the current price crosses/touches an armed line, beep.
  useEffect(() => {
    const cur = currentPrice ?? null;
    const prev = prevPriceRef.current;
    if (cur != null && prev != null && prev !== cur && n > 0) {
      for (const d of drawings) {
        if (d.kind === "vertical" || !d.armed) continue;
        const val = d.kind === "horizontal" ? d.price : trendValueAt(d, n - 1);
        const touched = (prev < val && cur >= val) || (prev > val && cur <= val);
        if (touched) {
          playBeep();
          toast({
            title: "Alert prezzo",
            description: `${symbol}: $${cur.toFixed(2)} ha toccato la linea.`,
          });
        }
      }
    }
    prevPriceRef.current = cur ?? prev;
  }, [currentPrice, drawings, n, symbol, toast]);

  // ---- Alert wiring: the bell arms a line as a sound alert (price alert) ----
  const createAlertFor = async (drawing: HLine | TLine): Promise<number | undefined> => {
    try {
      const targetPrice = alertPriceFor(drawing, n);
      const res = await apiRequest("POST", "/api/alerts", {
        symbol,
        targetPrice: Number(targetPrice.toFixed(4)),
        alertType: alertTypeFor(targetPrice, refPrice),
      });
      const created = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/alerts/${symbol}`] });
      toast({
        title: "Alert impostato",
        description: `${drawing.kind === "horizontal" ? "Linea" : "Trend"} a $${targetPrice.toFixed(2)} su ${symbol}.`,
      });
      return created?.id;
    } catch {
      toast({ title: "Errore", description: "Impossibile creare l'alert.", variant: "destructive" });
      return undefined;
    }
  };

  const syncAlertFor = async (drawing: Drawing) => {
    if (drawing.kind === "vertical" || !drawing.alertId) return;
    try {
      const targetPrice = alertPriceFor(drawing, n);
      await apiRequest("PUT", `/api/alerts/${drawing.alertId}`, {
        targetPrice: Number(targetPrice.toFixed(4)),
        alertType: alertTypeFor(targetPrice, refPrice),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/alerts/${symbol}`] });
    } catch {
      /* non-fatal: the line stays, the alert just isn't re-synced */
    }
  };

  const removeDrawing = async (id: string) => {
    const target = drawings.find((d) => d.id === id);
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    if (!target) return;
    try {
      if (target.dbId) {
        // The server deletes the linked alert together with the drawing.
        await apiDeleteDrawing(target.dbId);
        invalidateDrawings();
      } else if (target.kind !== "vertical" && target.alertId) {
        await apiRequest("DELETE", `/api/alerts/${target.alertId}`, undefined);
      }
      if (target.kind !== "vertical" && target.alertId) invalidateAlerts();
    } catch {
      /* non-fatal */
    }
  };

  // A drawing is purely visual until the user arms it with the bell.
  const addDrawing = (drawing: Drawing) => {
    setDrawings((prev) => [...prev, drawing]);
  };

  // Bell toggle: arm the line as a sound alert (creates a backend price alert) or
  // disarm it (deletes the alert). Only horizontal/trend lines can be armed.
  const toggleArm = async (id: string) => {
    const target = drawings.find((d) => d.id === id);
    if (!target || target.kind === "vertical") return;
    if (target.armed) {
      setDrawings((prev) => prev.map((d) => (d.id === id ? { ...d, armed: false, alertId: undefined } : d)));
      if (target.alertId) {
        try {
          // Deleting the alert also disarms the persisted drawing (FK set null).
          await apiRequest("DELETE", `/api/alerts/${target.alertId}`, undefined);
          invalidateAlerts();
          invalidateDrawings();
        } catch {
          /* non-fatal */
        }
      }
    } else {
      setDrawings((prev) => prev.map((d) => (d.id === id ? { ...d, armed: true } : d)));
      const alertId = await createAlertFor(target);
      if (alertId) {
        setDrawings((prev) => prev.map((d) => (d.id === id ? { ...d, alertId } : d)));
        if (target.dbId) {
          try {
            // Link the alert to the drawing; the server re-projects the target
            // from the time anchors right away.
            await apiUpdateDrawing(target.dbId, { alertId });
            invalidateDrawings();
            invalidateAlerts();
          } catch {
            /* non-fatal */
          }
        }
      }
    }
    pokeDrawing(id);
  };

  // Set a horizontal line's level (from the editable field or the slider).
  const setHorizontalPrice = (id: string, price: number) => {
    if (!Number.isFinite(price)) return;
    setDrawings((prev) =>
      prev.map((d) => (d.id === id && d.kind === "horizontal" ? { ...d, price } : d)),
    );
  };

  // ---- Pointer helpers -------------------------------------------------------
  const pointerToAnchor = (clientX: number, clientY: number): Anchor | null => {
    const geom = geomRef.current;
    const wrap = plotWrapRef.current;
    if (!geom || !wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const svgX = clientX - rect.left;
    const svgY = clientY - rect.top;
    const rawPrice = geom.yScale.invert(svgY);
    const price = Math.max(yDomain[0], Math.min(yDomain[1], rawPrice));
    const index = xToIndex(svgX, geom.n, geom.box);
    return { index, price };
  };

  // Placement: click on the plot while a draw mode is active.
  const handlePlace = (clientX: number, clientY: number) => {
    const anchor = pointerToAnchor(clientX, clientY);
    if (!anchor) return;
    if (drawMode === "horizontal") {
      const line: HLine = { id: uid(), kind: "horizontal", price: anchor.price };
      addDrawing(line);
      persistNew(line);
      setDrawMode(null);
      setHover(null);
    } else if (drawMode === "vertical") {
      const line: VLine = {
        id: uid(),
        kind: "vertical",
        index: anchor.index,
        time: indexToTime(anchor.index, timestamps),
      };
      addDrawing(line);
      persistNew(line);
      setDrawMode(null);
      setHover(null);
    } else if (drawMode === "trend") {
      if (!pendingAnchor) {
        setPendingAnchor(anchor);
      } else {
        const line: TLine = {
          id: uid(),
          kind: "trend",
          a: pendingAnchor,
          b: anchor,
          times: {
            a: indexToTime(pendingAnchor.index, timestamps),
            b: indexToTime(anchor.index, timestamps),
          },
        };
        addDrawing(line);
        persistNew(line);
        setPendingAnchor(null);
        setHover(null);
        setDrawMode(null);
        pokeDrawing(line.id); // show dots briefly on the freshly drawn line
      }
    }
  };

  // Dragging an existing handle: window listeners while a drag is active.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const anchor = pointerToAnchor(e.clientX, e.clientY);
      if (!anchor) return;
      setDrawings((prev) =>
        prev.map((d) => {
          if (d.id !== drag.id) return d;
          if (d.kind === "horizontal") return { ...d, price: anchor.price };
          if (d.kind === "vertical") return { ...d, index: anchor.index };
          if (drag.handle === "a") return { ...d, a: anchor };
          if (drag.handle === "b") return { ...d, b: anchor };
          return d;
        }),
      );
    };
    const onUp = () => {
      const moved = drawings.find((d) => d.id === drag.id);
      if (moved) {
        // Refresh the canonical time anchors from the moved indexes, then let
        // the server persist them and re-project the linked alert.
        const fresh = withFreshTimes(moved);
        setDrawings((prev) => prev.map((d) => (d.id === fresh.id ? fresh : d)));
        persistAnchors(fresh);
        pokeDrawing(fresh.id); // keep controls alive briefly after drag
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, drawings]);

  // ---- SVG overlay drawn inside the chart via Recharts <Customized> ----------
  const renderDrawLayer = (rc: any) => {
    const yAxis = rc.yAxisMap ? (Object.values(rc.yAxisMap)[0] as any) : null;
    const offset = rc.offset;
    if (!yAxis || !offset) return null;
    const yScale = yAxis.scale;
    const box: PlotBox = {
      left: offset.left,
      top: offset.top,
      width: offset.width,
      height: offset.height,
    };
    // Publish geometry for pointer math (writing a ref during render is safe here).
    geomRef.current = { yScale, box, n };

    const right = box.left + box.width;
    const rightMargin = offset.right ?? 60;
    const clipId = "fw-plot-clip";

    // Small round × delete button (used on the trend line's left end).
    const deleteHandle = (cx: number, cy: number, id: string) => (
      <g
        style={{ cursor: "pointer" }}
        onPointerDown={(e) => {
          e.stopPropagation();
          removeDrawing(id);
        }}
      >
        <circle cx={cx} cy={cy} r={7} fill="var(--destructive)" />
        <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} stroke="white" strokeWidth={1.5} />
        <line x1={cx - 3} y1={cy + 3} x2={cx + 3} y2={cy - 3} stroke="white" strokeWidth={1.5} />
      </g>
    );

    // Bell that arms/disarms the line as a sound alert. `centered` on x means the
    // icon is drawn centred on (x, y); armed → filled primary, idle → outline.
    const bellHandle = (x: number, y: number, armed: boolean, id: string) => (
      <foreignObject x={x - 10} y={y - 10} width={20} height={20} style={{ overflow: "visible" }}>
        <button
          type="button"
          aria-label={armed ? "Disattiva alert sonoro" : "Attiva alert sonoro"}
          title={armed ? "Alert sonoro attivo — click per disattivare" : "Rendi questa linea un alert sonoro"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleArm(id);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            cursor: "pointer",
            background: "transparent",
            border: "none",
            padding: 0,
            color: armed ? "var(--primary)" : "#fff",
          }}
        >
          <Bell size={14} fill={armed ? "var(--primary)" : "none"} />
        </button>
      </foreignObject>
    );

    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect x={box.left} y={box.top} width={box.width} height={box.height} />
          </clipPath>
        </defs>

        {/* Current-price indicator pill on the right margin (see "Livello prezzo"). */}
        {showPriceGuides && lastClose !== undefined && (() => {
          const y = yScale(lastClose);
          const w = Math.min(Math.max(rightMargin - 2, 40), 56);
          return (
            <g>
              <rect x={right + 2} y={y - 9} width={w} height={18} rx={3} fill="var(--foreground)" />
              <text
                x={right + 2 + w / 2}
                y={y + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="var(--background)"
              >
                {lastClose.toFixed(2)}
              </text>
            </g>
          );
        })()}

        {/* Horizontal placement preview: line follows the cursor and the price
            level is shown on the LEFT already, before the click confirms it.
            pointerEvents:none so it never steals events from the capture layer. */}
        {drawMode === "horizontal" && hover && (
          <g style={{ pointerEvents: "none" }}>
            <line
              x1={box.left}
              y1={yScale(hover.price)}
              x2={right}
              y2={yScale(hover.price)}
              stroke={DRAW_COLOR}
              strokeDasharray="5 4"
              strokeWidth={1}
              opacity={0.85}
            />
            <text x={box.left - 6} y={yScale(hover.price) + 4} textAnchor="end" fontSize={11} fill={DRAW_COLOR}>
              {hover.price.toFixed(2)}
            </text>
          </g>
        )}

        {/* Vertical placement preview: line + day at base follow the cursor. */}
        {drawMode === "vertical" && hover && (() => {
          const x = indexToX(hover.index, n, box);
          const nearest = Math.max(0, Math.min(n - 1, Math.round(hover.index)));
          const ts = timestamps[nearest];
          const baseY = box.top + box.height;
          return (
            <g style={{ pointerEvents: "none" }}>
              <line x1={x} y1={box.top} x2={x} y2={baseY} stroke={DRAW_COLOR} strokeDasharray="5 4" strokeWidth={1} opacity={0.85} />
              {ts != null && (
                <text x={x} y={baseY + 14} textAnchor="middle" fontSize={9} fontWeight={600} fill={DRAW_COLOR}>
                  {formatTooltipLabel(ts, selectedTimeframe)}
                </text>
              )}
            </g>
          );
        })()}

        {/* Trend placement preview: after the first click, the line already runs
            through the first anchor and the moving cursor, extrapolated across the
            whole plot exactly like the final line — it "sets" on the second click.
            pointerEvents:none so it stays put (no flicker) and never blocks the
            second click on the capture layer. */}
        {drawMode === "trend" && pendingAnchor && (() => {
          const ax = indexToX(pendingAnchor.index, n, box);
          const ay = yScale(pendingAnchor.price);
          return (
            <g style={{ pointerEvents: "none" }}>
              {hover && (() => {
                const temp = { id: "preview", kind: "trend", a: pendingAnchor, b: hover } as TLine;
                const py0 = yScale(trendValueAt(temp, 0));
                const pyEnd = yScale(trendValueAt(temp, n - 1));
                return (
                  <>
                    <g clipPath={`url(#${clipId})`}>
                      <line
                        x1={box.left}
                        y1={py0}
                        x2={right}
                        y2={pyEnd}
                        stroke={DRAW_COLOR}
                        strokeWidth={1.25}
                        opacity={0.9}
                      />
                    </g>
                    <circle cx={indexToX(hover.index, n, box)} cy={yScale(hover.price)} r={5} fill={DRAW_COLOR} />
                  </>
                );
              })()}
              <circle cx={ax} cy={ay} r={5} fill={DRAW_COLOR} />
            </g>
          );
        })()}

        {drawings.map((d) => {
          const active = activeDrawingId === d.id;

          if (d.kind === "vertical") {
            const x = indexToX(d.index, n, box);
            const nearest = Math.max(0, Math.min(n - 1, Math.round(d.index)));
            const ts = timestamps[nearest];
            const label = ts != null ? formatTooltipLabel(ts, selectedTimeframe) : "";
            const baseY = box.top + box.height;
            return (
              <g key={d.id}>
                <line x1={x} y1={box.top} x2={x} y2={baseY} stroke={DRAW_COLOR} strokeWidth={1} />
                {/* Hit area: click to select, drag horizontally to move. */}
                <line
                  x1={x}
                  y1={box.top}
                  x2={x}
                  y2={baseY}
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: "ew-resize", pointerEvents: "stroke" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    pokeDrawing(d.id);
                    setDrag({ id: d.id, handle: "x" });
                  }}
                />
                {/* Day/date shown at the base of the vertical line. */}
                <g style={{ pointerEvents: "none" }}>
                  <rect x={x - 52} y={baseY + 2} width={104} height={16} rx={3} fill="var(--card)" opacity={0.9} />
                  <text x={x} y={baseY + 14} textAnchor="middle" fontSize={9} fontWeight={600} fill={DRAW_COLOR}>
                    {label}
                  </text>
                </g>
                {active && deleteHandle(x, box.top + 8, d.id)}
              </g>
            );
          }

          if (d.kind === "horizontal") {
            const y = yScale(d.price);
            return (
              <g key={d.id}>
                {/* White alert level line across the whole plot. */}
                <line x1={box.left} y1={y} x2={right} y2={y} stroke={DRAW_COLOR} strokeWidth={1} />
                {/* Invisible, wide hit area: click the line to reveal its controls. */}
                <line
                  x1={box.left}
                  y1={y}
                  x2={right}
                  y2={y}
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: "pointer", pointerEvents: "stroke" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    pokeDrawing(d.id);
                  }}
                />
                {active ? (
                  /* Full controls in the empty LEFT margin, outside the plot. */
                  <foreignObject x={0} y={y - 14} width={LEFT_MARGIN} height={28} style={{ overflow: "visible" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 1, height: 28, paddingRight: 2 }}
                      onPointerDown={() => pokeDrawing(d.id)}
                    >
                      <PriceInput
                        initial={d.price}
                        onFocusStart={clearIdleTimer}
                        onCommit={(v) => {
                          if (v != null) setHorizontalPrice(d.id, v);
                          const line = drawings.find((x) => x.id === d.id);
                          if (line && line.kind === "horizontal") {
                            persistAnchors({ ...line, price: v ?? line.price });
                          }
                          pokeDrawing(d.id);
                        }}
                      />
                      {/* Scroll selector: drag vertically to move the line. */}
                      <button
                        type="button"
                        aria-label="Scorri livello"
                        title="Trascina per scorrere il livello"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          pokeDrawing(d.id);
                          setDrag({ id: d.id, handle: "level" });
                        }}
                        style={{ display: "flex", cursor: "ns-resize", color: "#fff", background: "transparent", border: "none", padding: 0 }}
                      >
                        <GripHorizontal size={14} />
                      </button>
                      {/* Bell: arm/disarm as sound alert. */}
                      <button
                        type="button"
                        aria-label={d.armed ? "Disattiva alert sonoro" : "Attiva alert sonoro"}
                        title={d.armed ? "Alert sonoro attivo — click per disattivare" : "Rendi questa linea un alert sonoro"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleArm(d.id);
                        }}
                        style={{ display: "flex", cursor: "pointer", color: d.armed ? "var(--primary)" : "#fff", background: "transparent", border: "none", padding: 0 }}
                      >
                        <Bell size={14} fill={d.armed ? "currentColor" : "none"} />
                      </button>
                      {/* Delete */}
                      <button
                        type="button"
                        aria-label="Elimina linea"
                        title="Elimina linea"
                        onClick={() => removeDrawing(d.id)}
                        style={{ display: "flex", cursor: "pointer", color: "var(--destructive)", background: "transparent", border: "none", padding: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </foreignObject>
                ) : (
                  /* Idle: compact read-only price; persistent bell if armed. */
                  <>
                    <g
                      style={{ cursor: "pointer" }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        pokeDrawing(d.id);
                      }}
                    >
                      <text x={box.left - 6} y={y + 4} textAnchor="end" fontSize={11} fill={DRAW_COLOR}>
                        {d.price.toFixed(2)}
                      </text>
                    </g>
                    {d.armed && bellHandle(12, y, true, d.id)}
                  </>
                )}
              </g>
            );
          }

          // Trend line: the two anchors only set the inclination; the line is
          // extrapolated across the whole plot (clipped to the plot box).
          const ax = indexToX(d.a.index, n, box);
          const ay = yScale(d.a.price);
          const bx = indexToX(d.b.index, n, box);
          const by = yScale(d.b.price);
          const y0 = yScale(trendValueAt(d, 0));
          const yEnd = yScale(trendValueAt(d, n - 1));
          // Point where the line first becomes visible on the LEFT — that is where
          // the trend line "starts"; the × delete / bell go there.
          const leftPt = (() => {
            const top = box.top;
            const bot = box.top + box.height;
            if (y0 >= top && y0 <= bot) return { x: box.left, y: y0 };
            const yb = Math.max(top, Math.min(bot, y0));
            const dy = yEnd - y0;
            if (dy === 0) return { x: box.left, y: yb };
            let x = box.left + ((yb - y0) / dy) * (right - box.left);
            x = Math.max(box.left, Math.min(right, x));
            return { x, y: yb };
          })();
          return (
            <g key={d.id}>
              <g clipPath={`url(#${clipId})`}>
                <line x1={box.left} y1={y0} x2={right} y2={yEnd} stroke={DRAW_COLOR} strokeWidth={1.25} />
                {/* Invisible, wide hit area: click the line to reveal its dots. */}
                <line
                  x1={box.left}
                  y1={y0}
                  x2={right}
                  y2={yEnd}
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: "pointer", pointerEvents: "stroke" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    pokeDrawing(d.id);
                  }}
                />
              </g>
              {/* Persistent armed bell (also visible when idle). */}
              {!active && d.armed && bellHandle(leftPt.x, leftPt.y, true, d.id)}
              {/* Reposition dots + bell + delete: shown on select, auto-hide idle. */}
              {active && (
                <>
                  <circle
                    cx={ax}
                    cy={ay}
                    r={6}
                    fill={DRAW_COLOR}
                    stroke="rgba(0,0,0,0.4)"
                    style={{ cursor: "move" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      pokeDrawing(d.id);
                      setDrag({ id: d.id, handle: "a" });
                    }}
                  />
                  <circle
                    cx={bx}
                    cy={by}
                    r={6}
                    fill={DRAW_COLOR}
                    stroke="rgba(0,0,0,0.4)"
                    style={{ cursor: "move" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      pokeDrawing(d.id);
                      setDrag({ id: d.id, handle: "b" });
                    }}
                  />
                  {/* Bell (arm) above, delete at the LEFT start of the trend line. */}
                  {bellHandle(leftPt.x + 8, leftPt.y - 20, d.armed ?? false, d.id)}
                  {deleteHandle(leftPt.x + 8, leftPt.y, d.id)}
                </>
              )}
            </g>
          );
        })}

        {/* Placement capture layer — rendered LAST so it sits on top and reliably
            receives every move/click while placing (nothing else steals events). */}
        {drawMode && (
          <rect
            x={box.left}
            y={box.top}
            width={box.width}
            height={box.height}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePlace(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => setHover(pointerToAnchor(e.clientX, e.clientY))}
            onPointerLeave={() => setHover(null)}
          />
        )}
      </g>
    );
  };
  // Keep the stable <Customized> component pointing at the latest render closure.
  drawLayerRenderRef.current = renderDrawLayer;

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis
        dataKey="timestamp"
        type="category"
        ticks={xTicks}
        tickFormatter={(ts: number) => formatAxisTick(ts, selectedTimeframe)}
        stroke="var(--muted-foreground)"
        fontSize={11}
        axisLine={false}
        tickMargin={8}
        minTickGap={20}
      />
      <YAxis
        stroke="var(--muted-foreground)"
        fontSize={12}
        domain={yDomain}
        axisLine={false}
        orientation="right"
        tickFormatter={(value) => `$${value.toFixed(2)}`}
        tick={{ fontSize: 11 }}
      />
      {showPriceGuides && lastClose !== undefined && (
        <ReferenceLine
          y={lastClose}
          stroke="var(--muted-foreground)"
          strokeDasharray="6 4"
          strokeWidth={1}
        />
      )}
    </>
  );

  return (
    <>
      <div className="space-y-4">
        {/* Chart Toolbar */}
        <div className="bg-card border border-border rounded-lg p-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Timeframes */}
            <div className="flex items-center space-x-2">
              {quickTimeframes.map((timeframe) => (
                <Button
                  key={timeframe.value}
                  variant={selectedTimeframe === timeframe.value ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-sm font-medium",
                    selectedTimeframe === timeframe.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setSelectedTimeframe(timeframe.value)}
                >
                  {timeframe.label}
                </Button>
              ))}

              {/* More Timeframes Dropdown */}
              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger className="h-8 w-12 bg-background border-border text-muted-foreground">
                  <ChevronDown className="w-4 h-4" />
                </SelectTrigger>
                <SelectContent>
                  {allTimeframes.map((timeframe) => (
                    <SelectItem key={timeframe.value} value={timeframe.value}>
                      {timeframe.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right Side - Chart Type, Volume, Draw, Alert */}
            <div className="flex items-center space-x-2">
              {/* Single toggle: switches Line <-> Candles. Shows the view you'll switch TO. */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-sm bg-background border border-border text-foreground hover:text-primary"
                onClick={() => setChartType(nextChartType)}
                aria-label={nextChartType === "candlestick" ? "Passa a candele" : "Passa a linea"}
                title={nextChartType === "candlestick" ? "Passa a candele" : "Passa a linea"}
              >
                {nextChartType === "candlestick" ? (
                  <>
                    <CandlestickChart className="w-3 h-3 mr-1" />
                    Candele
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Linea
                  </>
                )}
              </Button>

              {/* Volume Toggle */}
              <Button
                variant={showVolume ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 px-3 text-sm",
                  showVolume
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setShowVolume((v) => !v)}
              >
                Volume
              </Button>

              {/* Toggle tooltip + current-price line (get out of the way while drawing) */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  showPriceGuides
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-primary bg-primary/10"
                )}
                onClick={() => setShowPriceGuides((v) => !v)}
                aria-label={showPriceGuides ? "Nascondi tooltip e linea prezzo" : "Mostra tooltip e linea prezzo"}
                title={showPriceGuides ? "Nascondi tooltip e linea prezzo" : "Mostra tooltip e linea prezzo"}
              >
                {showPriceGuides ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>

              {/* Drawing tools: linea orizzontale / linea inclinata (trend) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0",
                      drawMode
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-primary"
                    )}
                    aria-label="Strumenti di disegno linee"
                    title="Disegna linee (orizzontale / trend / verticale)"
                  >
                    <PencilRuler className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Linee alert</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingAnchor(null);
                      setDrawMode("horizontal");
                    }}
                  >
                    <Minus className="w-4 h-4 mr-2" />
                    Linea orizzontale
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingAnchor(null);
                      setDrawMode("trend");
                    }}
                  >
                    <Slash className="w-4 h-4 mr-2" />
                    Linea inclinata (trend)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setPendingAnchor(null);
                      setDrawMode("vertical");
                    }}
                  >
                    <Minus className="w-4 h-4 mr-2 rotate-90" />
                    Linea verticale (data)
                  </DropdownMenuItem>
                  {(drawMode || drawings.length > 0) && <DropdownMenuSeparator />}
                  {drawMode && (
                    <DropdownMenuItem
                      onClick={() => {
                        setDrawMode(null);
                        setPendingAnchor(null);
                        setHover(null);
                      }}
                    >
                      Annulla disegno
                    </DropdownMenuItem>
                  )}
                  {drawings.length > 0 && (
                    <DropdownMenuItem onClick={() => drawings.forEach((d) => removeDrawing(d.id))}>
                      Rimuovi tutte le linee
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Alert Button (modal classico) */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                onClick={() => setShowAlertModal(true)}
                aria-label="Crea alert di prezzo"
              >
                <Bell className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {drawMode && (
            <div className="mt-2 text-xs text-primary">
              {drawMode === "horizontal"
                ? "Tocca il grafico per posizionare la linea orizzontale."
                : drawMode === "vertical"
                  ? "Tocca il grafico per posizionare la linea verticale (mostra la data)."
                  : pendingAnchor
                    ? "Tocca il secondo punto per completare la linea di trend."
                    : "Tocca il primo punto della linea di trend."}
            </div>
          )}
        </div>

        {/* Main Chart */}
        <div className="chart-container relative">
          <div className="h-80 relative" ref={plotWrapRef}>
            {isLoading && (
              <div className="w-full h-full bg-gradient-to-br from-muted to-background flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                  <p className="text-lg">Loading chart...</p>
                </div>
              </div>
            )}

            {!isLoading && chartDataFormatted.length === 0 && (
              <div className="w-full h-full bg-gradient-to-br from-muted to-background flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-lg">No chart data available</p>
                  <p className="text-sm">Try a different timeframe</p>
                </div>
              </div>
            )}

            {!isLoading && chartDataFormatted.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <AreaChart data={chartDataFormatted} margin={{ top: 8, right: 12, bottom: 0, left: LEFT_MARGIN }}>
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {commonAxes}
                    {showPriceGuides && (
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--popover, var(--card))',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                      itemStyle={{ color: 'var(--foreground)' }}
                      labelFormatter={(ts: number) => formatTooltipLabel(Number(ts), selectedTimeframe)}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                      cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                    />
                    )}
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#areaFill)"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Customized component={drawLayerComponentRef.current!} />
                  </AreaChart>
                ) : (
                  <ComposedChart data={chartDataFormatted} margin={{ top: 8, right: 12, bottom: 0, left: LEFT_MARGIN }}>
                    {commonAxes}
                    {showPriceGuides && (
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--popover, var(--card))',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                      itemStyle={{ color: 'var(--foreground)' }}
                      labelFormatter={(ts: number) => formatTooltipLabel(Number(ts), selectedTimeframe)}
                      formatter={(value: number | number[], name: string) => {
                        if (name === 'highLow' && Array.isArray(value)) {
                          return [`$${value[1].toFixed(2)} / $${value[0].toFixed(2)}`, 'High / Low'];
                        }
                        return [`$${Number(value).toFixed(2)}`, name];
                      }}
                      cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                    />
                    )}
                    <Bar dataKey="highLow" shape={<Candle />} isAnimationActive={false} />
                    <Customized component={drawLayerComponentRef.current!} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          {/* Volume Indicator */}
          {showVolume && !isLoading && chartDataFormatted.length > 0 && (
            <div className="h-24 border-t border-border">
              <div className="flex items-center px-2 py-1 bg-muted">
                <span className="text-xs font-medium text-foreground">Volume</span>
              </div>
              <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                <BarChart data={chartDataFormatted} margin={{ top: 0, right: 12, bottom: 0, left: LEFT_MARGIN }}>
                  <XAxis
                    dataKey="timestamp"
                    type="category"
                    ticks={xTicks}
                    tickFormatter={(ts: number) => formatAxisTick(ts, selectedTimeframe)}
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    orientation="right"
                    axisLine={false}
                  />
                  <Bar
                    dataKey="volume"
                    fill="var(--muted-foreground)"
                    opacity={0.6}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        symbol={symbol}
        currentPrice={currentPrice}
      />
    </>
  );
}
