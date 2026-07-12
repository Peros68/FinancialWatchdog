import { pgTable, text, serial, integer, boolean, timestamp, real, unique, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Exact-decimal money/quantity column: stored as PostgreSQL `numeric(p, s)`
// (no binary-float rounding) but surfaced to the app as a plain `number`, so
// arithmetic (average price, commissions) stays ergonomic. node-postgres returns
// numeric as string → parsed on read; written back as a string to the driver.
const decimalNumber = (precision: number, scale: number) =>
  customType<{ data: number; driverData: string }>({
    dataType() {
      return `numeric(${precision}, ${scale})`;
    },
    fromDriver(value) {
      return typeof value === "number" ? value : Number(value);
    },
    toDriver(value) {
      return String(value);
    },
  });

// Money to 4 decimals, quantities/prices to 8, percentages to 6.
const money = decimalNumber(20, 4);
const price = decimalNumber(20, 8);
const qty = decimalNumber(20, 8);
const pct = decimalNumber(10, 6);

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

// Virtual portfolios: like watchlists, but positions carry quantity, average
// price (fees included) and total cost. A portfolio declares its base currency
// and whether it is multi-currency (multiCurrency=false ⇒ positions in a
// different currency are rejected). Commissions are configured per market
// (EU/USA) as percentage + fixed; defaults are 0 (no broker value is hardcoded).
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  baseCurrency: text("base_currency").notNull(),
  multiCurrency: boolean("multi_currency").notNull().default(false),
  feeEuPct: pct("fee_eu_pct").notNull().default(0), // percent, e.g. 0.19 = 0.19%
  feeEuFixed: money("fee_eu_fixed").notNull().default(0), // in base currency, per trade
  feeUsaPct: pct("fee_usa_pct").notNull().default(0),
  feeUsaFixed: money("fee_usa_fixed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Aggregated position (one row per symbol per portfolio). avgPrice is always the
// weighted average cost per share INCLUDING fees; totalCost = quantity * avgPrice.
// Adding to an existing symbol recomputes both (see shared/portfolio.ts:applyBuy).
export const portfolioHoldings = pgTable(
  "portfolio_holdings",
  {
    id: serial("id").primaryKey(),
    portfolioId: integer("portfolio_id").notNull().references(() => portfolios.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    exchange: text("exchange").notNull(),
    currency: text("currency"),
    quantity: qty("quantity").notNull(),
    avgPrice: price("avg_price").notNull(),
    totalCost: money("total_cost").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    portfolioSymbolUnique: unique("portfolio_symbol_unique").on(table.portfolioId, table.symbol),
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

export const insertPortfolioSchema = createInsertSchema(portfolios, {
  baseCurrency: z.string().trim().min(1).max(8),
  name: z.string().trim().min(1),
}).pick({
  name: true,
  userId: true,
  baseCurrency: true,
  multiCurrency: true,
  feeEuPct: true,
  feeEuFixed: true,
  feeUsaPct: true,
  feeUsaFixed: true,
});

// Persisted holding row (used by storage.createHolding / updateHolding). The
// route computes quantity/avgPrice/totalCost via shared/portfolio.ts, not the client.
export const insertHoldingSchema = createInsertSchema(portfolioHoldings).pick({
  portfolioId: true,
  symbol: true,
  name: true,
  exchange: true,
  currency: true,
  quantity: true,
  avgPrice: true,
  totalCost: true,
});

// Editable portfolio fields (name, base currency, multi-currency flag and the
// EU/USA commission config). userId is intentionally not editable.
export const updatePortfolioSchema = z.object({
  name: z.string().trim().min(1).optional(),
  baseCurrency: z.string().trim().min(1).max(8).optional(),
  multiCurrency: z.boolean().optional(),
  feeEuPct: z.number().nonnegative().optional(),
  feeEuFixed: z.number().nonnegative().optional(),
  feeUsaPct: z.number().nonnegative().optional(),
  feeUsaFixed: z.number().nonnegative().optional(),
});

// Buy instruction from the client (add-to-portfolio popup). When feesIncluded is
// true (importing an existing real position whose average already includes costs)
// the server forces commission to 0 and treats `price` as the all-in average.
export const addHoldingSchema = z.object({
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1),
  exchange: z.string().trim().min(1),
  currency: z.string().trim().min(1).nullish(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  commission: z.number().nonnegative().optional(),
  feesIncluded: z.boolean().optional().default(false),
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

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type UpdatePortfolio = z.infer<typeof updatePortfolioSchema>;

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type AddHolding = z.infer<typeof addHoldingSchema>;

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
