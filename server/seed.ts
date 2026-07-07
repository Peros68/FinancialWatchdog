// Idempotent seed for PostgreSQL (DatabaseStorage).
//
// Unlike MemStorage, DatabaseStorage does NOT auto-create demo data. The API routes
// use a hardcoded `defaultUserId = 1` (server/routes.ts), so a fresh database needs
// a "default" user (id=1) plus the three demo watchlists to exist — otherwise
// getWatchlists(1) returns nothing and creating a watchlist would violate the
// users FK. This script creates them only if missing, so it is safe to re-run.
//
// Usage: set DATABASE_URL, then `npm run db:push` (creates tables) and `npm run db:seed`.
import "./loadEnv";
import { db, pool } from "./db";
import { users, watchlists } from "@shared/schema";
import { and, eq } from "drizzle-orm";

const DEMO_WATCHLISTS = ["Tech Stocks", "Blue Chips", "Growth"];

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("[seed] DATABASE_URL is not set. Provision PostgreSQL and set DATABASE_URL first.");
    process.exit(1);
  }

  // Ensure the default user (used by routes as defaultUserId=1). On a fresh DB the
  // serial id starts at 1, matching the hardcoded default.
  let [user] = await db.select().from(users).where(eq(users.username, "default"));
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ username: "default", password: "password" })
      .returning();
    console.log(`[seed] created user "default" (id=${user.id})`);
  } else {
    console.log(`[seed] user "default" already exists (id=${user.id})`);
  }

  // Ensure the demo watchlists exist for that user (create only the missing ones).
  for (const name of DEMO_WATCHLISTS) {
    const [existing] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.userId, user.id), eq(watchlists.name, name)));
    if (existing) {
      console.log(`[seed] watchlist "${name}" already exists (id=${existing.id})`);
    } else {
      const [created] = await db
        .insert(watchlists)
        .values({ name, userId: user.id })
        .returning();
      console.log(`[seed] created watchlist "${name}" (id=${created.id})`);
    }
  }

  await pool.end();
  console.log("[seed] done.");
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
