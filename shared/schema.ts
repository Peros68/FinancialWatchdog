import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
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
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const watchlistItems = pgTable("watchlist_items", {
  id: serial("id").primaryKey(),
  watchlistId: integer("watchlist_id").references(() => watchlists.id),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  exchange: text("exchange").notNull(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  symbol: text("symbol").notNull(),
  targetPrice: real("target_price").notNull(),
  alertType: text("alert_type").notNull(), // 'above' | 'below'
  isActive: boolean("is_active").default(true),
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
});

export const insertAlertSchema = createInsertSchema(alerts).pick({
  userId: true,
  symbol: true,
  targetPrice: true,
  alertType: true,
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
