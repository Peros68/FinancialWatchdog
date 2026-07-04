import { 
  users, watchlists, watchlistItems, alerts,
  type User, type InsertUser,
  type Watchlist, type InsertWatchlist,
  type WatchlistItem, type InsertWatchlistItem,
  type Alert, type InsertAlert
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Watchlist operations
  getWatchlists(userId: number): Promise<Watchlist[]>;
  getWatchlist(id: number): Promise<Watchlist | undefined>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  deleteWatchlist(id: number): Promise<void>;

  // Watchlist item operations
  getWatchlistItems(watchlistId: number): Promise<WatchlistItem[]>;
  addWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeWatchlistItem(id: number): Promise<void>;
  getWatchlistItemBySymbol(watchlistId: number, symbol: string): Promise<WatchlistItem | undefined>;

  // Alert operations
  getAlerts(userId: number): Promise<Alert[]>;
  getAlertsBySymbol(userId: number, symbol: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private watchlists: Map<number, Watchlist>;
  private watchlistItems: Map<number, WatchlistItem>;
  private alerts: Map<number, Alert>;
  private currentUserId: number;
  private currentWatchlistId: number;
  private currentWatchlistItemId: number;
  private currentAlertId: number;

  constructor() {
    this.users = new Map();
    this.watchlists = new Map();
    this.watchlistItems = new Map();
    this.alerts = new Map();
    this.currentUserId = 1;
    this.currentWatchlistId = 1;
    this.currentWatchlistItemId = 1;
    this.currentAlertId = 1;

    // Create default user and watchlists
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    const defaultUser = await this.createUser({ username: "default", password: "password" });
    await this.createWatchlist({ name: "Tech Stocks", userId: defaultUser.id });
    await this.createWatchlist({ name: "Blue Chips", userId: defaultUser.id });
    await this.createWatchlist({ name: "Growth", userId: defaultUser.id });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getWatchlists(userId: number): Promise<Watchlist[]> {
    return Array.from(this.watchlists.values()).filter(wl => wl.userId === userId);
  }

  async getWatchlist(id: number): Promise<Watchlist | undefined> {
    return this.watchlists.get(id);
  }

  async createWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const id = this.currentWatchlistId++;
    const watchlist: Watchlist = {
      ...insertWatchlist,
      id,
      userId: insertWatchlist.userId ?? null,
      createdAt: new Date()
    };
    this.watchlists.set(id, watchlist);
    return watchlist;
  }

  async deleteWatchlist(id: number): Promise<void> {
    this.watchlists.delete(id);
    // Also remove all items in this watchlist
    Array.from(this.watchlistItems.entries()).forEach(([itemId, item]) => {
      if (item.watchlistId === id) {
        this.watchlistItems.delete(itemId);
      }
    });
  }

  async getWatchlistItems(watchlistId: number): Promise<WatchlistItem[]> {
    return Array.from(this.watchlistItems.values()).filter(item => item.watchlistId === watchlistId);
  }

  async addWatchlistItem(insertItem: InsertWatchlistItem): Promise<WatchlistItem> {
    const id = this.currentWatchlistItemId++;
    const item: WatchlistItem = { ...insertItem, id, watchlistId: insertItem.watchlistId ?? null };
    this.watchlistItems.set(id, item);
    return item;
  }

  async removeWatchlistItem(id: number): Promise<void> {
    this.watchlistItems.delete(id);
  }

  async getWatchlistItemBySymbol(watchlistId: number, symbol: string): Promise<WatchlistItem | undefined> {
    return Array.from(this.watchlistItems.values()).find(
      item => item.watchlistId === watchlistId && item.symbol === symbol
    );
  }

  async getAlerts(userId: number): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(alert => alert.userId === userId);
  }

  async getAlertsBySymbol(userId: number, symbol: string): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      alert => alert.userId === userId && alert.symbol === symbol
    );
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = this.currentAlertId++;
    const alert: Alert = {
      ...insertAlert,
      id,
      userId: insertAlert.userId ?? null,
      isActive: true,
      createdAt: new Date()
    };
    this.alerts.set(id, alert);
    return alert;
  }

  async updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined> {
    const alert = this.alerts.get(id);
    if (!alert) return undefined;
    
    const updatedAlert = { ...alert, ...updates };
    this.alerts.set(id, updatedAlert);
    return updatedAlert;
  }

  async deleteAlert(id: number): Promise<void> {
    this.alerts.delete(id);
  }
}

import { db } from "./db";
import { eq, and } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getWatchlists(userId: number): Promise<Watchlist[]> {
    return await db.select().from(watchlists).where(eq(watchlists.userId, userId));
  }

  async getWatchlist(id: number): Promise<Watchlist | undefined> {
    const [watchlist] = await db.select().from(watchlists).where(eq(watchlists.id, id));
    return watchlist || undefined;
  }

  async createWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const [watchlist] = await db
      .insert(watchlists)
      .values(insertWatchlist)
      .returning();
    return watchlist;
  }

  async deleteWatchlist(id: number): Promise<void> {
    // Remove child items first to avoid orphaned rows / FK violations,
    // mirroring MemStorage's cascade behavior.
    await db.delete(watchlistItems).where(eq(watchlistItems.watchlistId, id));
    await db.delete(watchlists).where(eq(watchlists.id, id));
  }

  async getWatchlistItems(watchlistId: number): Promise<WatchlistItem[]> {
    return await db.select().from(watchlistItems).where(eq(watchlistItems.watchlistId, watchlistId));
  }

  async addWatchlistItem(insertItem: InsertWatchlistItem): Promise<WatchlistItem> {
    const [item] = await db
      .insert(watchlistItems)
      .values(insertItem)
      .returning();
    return item;
  }

  async removeWatchlistItem(id: number): Promise<void> {
    await db.delete(watchlistItems).where(eq(watchlistItems.id, id));
  }

  async getWatchlistItemBySymbol(watchlistId: number, symbol: string): Promise<WatchlistItem | undefined> {
    const [item] = await db
      .select()
      .from(watchlistItems)
      .where(and(eq(watchlistItems.watchlistId, watchlistId), eq(watchlistItems.symbol, symbol)));
    return item || undefined;
  }

  async getAlerts(userId: number): Promise<Alert[]> {
    return await db.select().from(alerts).where(eq(alerts.userId, userId));
  }

  async getAlertsBySymbol(userId: number, symbol: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.userId, userId), eq(alerts.symbol, symbol)));
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const [alert] = await db
      .insert(alerts)
      .values(insertAlert)
      .returning();
    return alert;
  }

  async updateAlert(id: number, updates: Partial<Alert>): Promise<Alert | undefined> {
    const [alert] = await db
      .update(alerts)
      .set(updates)
      .where(eq(alerts.id, id))
      .returning();
    return alert || undefined;
  }

  async deleteAlert(id: number): Promise<void> {
    await db.delete(alerts).where(eq(alerts.id, id));
  }
}

// Storage selection (groundwork for decisions D1/D4):
// - No DATABASE_URL  -> in-memory storage (current local default; data not persisted).
// - DATABASE_URL set -> PostgreSQL-backed storage (DatabaseStorage).
// This keeps local behavior unchanged until a DATABASE_URL is provided, while
// preparing the app to use a database without further code changes.
function createStorage(): IStorage {
  if (process.env.DATABASE_URL) {
    console.log("[storage] DATABASE_URL detected — using DatabaseStorage (PostgreSQL).");
    return new DatabaseStorage();
  }
  console.log(
    "[storage] No DATABASE_URL — using in-memory storage (MemStorage). Data is NOT persisted across restarts.",
  );
  return new MemStorage();
}

export const storage: IStorage = createStorage();
