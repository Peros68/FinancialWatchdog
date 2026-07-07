import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

// `pg` is a CommonJS module: under Node's ESM loader a named `{ Pool }` import is not
// reliably resolved, so destructure from the default export instead.
const { Pool } = pg;
import * as schema from "@shared/schema";

// Lazy initialization: importing this module must NOT crash when DATABASE_URL is
// absent. The app can run with in-memory storage (MemStorage), so the DB
// connection is only needed if/when DatabaseStorage is actually used. The pool and
// drizzle client are created on first access; a missing DATABASE_URL throws only
// then, with a clear message.
//
// Driver: node-postgres (`pg`), for a self-hosted/local PostgreSQL (e.g. Docker).
// `@neondatabase/serverless` stays in package.json for a possible future Neon
// cloud deploy (decision D4), but is not used here.
function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set to use the database. The app runs with in-memory storage by default; set DATABASE_URL only when enabling persistent storage (see .env.example).",
    );
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return { pool, db: drizzle(pool, { schema }) };
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
