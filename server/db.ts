import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Lazy initialization: importing this module must NOT crash when DATABASE_URL is
// absent. The app currently runs with in-memory storage (MemStorage), so the DB
// connection is only needed if/when DatabaseStorage is actually used. The pool and
// drizzle client are created on first access; a missing DATABASE_URL throws only
// then, with a clear message — keeping the door open for a future DATABASE_URL
// without choosing or provisioning a database now.
function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set to use the database. The app runs with in-memory storage by default; set DATABASE_URL only when enabling persistent storage (see .env.example).",
    );
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return { pool, db: drizzle({ client: pool, schema }) };
}

type DbBundle = ReturnType<typeof createDb>;

let _bundle: DbBundle | undefined;
function getBundle(): DbBundle {
  if (!_bundle) _bundle = createDb();
  return _bundle;
}

export const pool = new Proxy({} as DbBundle["pool"], {
  get(_target, prop) {
    const real = getBundle().pool as any;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export const db = new Proxy({} as DbBundle["db"], {
  get(_target, prop) {
    const real = getBundle().db as any;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
