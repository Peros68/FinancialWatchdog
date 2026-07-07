import { pgTable, text, serial, integer, boolean, timestamp, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const watchlists = pgTable("watchlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: serial("id").primaryKey(),
    watchlistId: integer("watchlist_id").references(() => watchlists.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    exchange: text("exchange").notNull(),
    currency: text("currency"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    watchlistSymbolUnique: unique("watchlist_symbol_unique").on(table.watchlistId, table.symbol),
  }),
);

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  targetPrice: real("target_price").notNull(),
  alertType: text("alert_type").notNull(), // 'above' | 'below'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  triggeredAt: timestamp("triggered_at"),
});

// Persistent chart drawings (every drawn line survives reloads, armed or not).
// Uniform two-anchor model: each anchor is an instant + a price, so the server
// can re-project a trend line over time without knowing the chart.
//   - horizontal: two anchors with the same price (the level).
//   - trend: two full anchors; the line through them, extrapolated in TIME.
//   - vertical: only aTime (a date marker); prices stay null, never armable.
// A drawing is "armed" iff alertId is set; deleting the alert disarms it
// (FK on delete: set null). The alert row itself stays the single static
// targetPrice the scheduler checks — the daily reprojector keeps it fresh.
export const drawings = pgTable("drawings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  kind: text("kind").notNull(), // 'horizontal' | 'trend' | 'vertical'
  aTime: timestamp("a_time"),
  aPrice: real("a_price"),
  bTime: timestamp("b_time"),
  bPrice: real("b_price"),
  alertId: integer("alert_id").references(() => alerts.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).pick({
  name: true,
  userId: true,
});

export const insertWatchlistItemSchema = createInsertSchema(watchlistItems).pick({
  watchlistId: true,
  symbol: true,
  name: true,
  exchange: true,
  currency: true,
});

export const insertAlertSchema = createInsertSchema(alerts).pick({
  userId: true,
  symbol: true,
  targetPrice: true,
  alertType: true,
});

// Anchor times arrive from the client as ISO strings (JSON) → coerce to Date.
const drawingFieldsSchema = createInsertSchema(drawings, {
  kind: z.enum(["horizontal", "trend", "vertical"]),
  aTime: z.coerce.date().nullish(),
  bTime: z.coerce.date().nullish(),
}).pick({
  userId: true,
  symbol: true,
  kind: true,
  aTime: true,
  aPrice: true,
  bTime: true,
  bPrice: true,
});

export const insertDrawingSchema = drawingFieldsSchema.superRefine((d, ctx) => {
  if (d.kind === "vertical") {
    if (d.aTime == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "vertical drawing requires aTime" });
    }
  } else if (d.aTime == null || d.aPrice == null || d.bTime == null || d.bPrice == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${d.kind} drawing requires both anchors (aTime/aPrice/bTime/bPrice)`,
    });
  }
});

// Updatable fields: anchors (drag/edit) and the alert linkage (arm/disarm).
export const updateDrawingSchema = z.object({
  aTime: z.coerce.date().optional(),
  aPrice: z.number().optional(),
  bTime: z.coerce.date().optional(),
  bPrice: z.number().optional(),
  alertId: z.number().int().nullable().optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type ChartDrawing = typeof drawings.$inferSelect;
export type InsertDrawing = z.infer<typeof insertDrawingSchema>;
export type UpdateDrawing = z.infer<typeof updateDrawingSchema>;

// API Types
export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export interface StockQuote {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface StockProfile {
  name: string;
  symbol: string;
  exchange: string;
  currency: string;
  country: string;
  marketCapitalization: number;
}

export interface ChartData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DividendEntry {
  date: string; // ISO date (YYYY-MM-DD)
  amount: number;
}

// Normalized "simple & reliable" fundamentals. All fields nullable: providers fill
// what they can (Yahoo: sector/industry/dividends; Finnhub: market cap/EPS/multiples).
// Full statements (income/balance/cash flow) are intentionally NOT included here.
export interface Fundamentals {
  symbol: string;
  sector: string | null;
  industry: string | null;
  marketCapitalization: number | null; // source-dependent unit (Finnhub: millions)
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  eps: number | null;
  dividendYield: number | null; // percent
  dividends: DividendEntry[] | null; // recent cash dividends (Yahoo chart events)
  sources: string[]; // providers that contributed (e.g. ["yahoo","finnhub"])
}
