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
    const item: WatchlistItem = { ...insertItem, id };
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

export const storage = new MemStorage();
