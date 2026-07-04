// Loads variables from a local .env file into process.env using Node's built-in
// loader (no dependency). Imported FIRST in server/index.ts so that provider modules
// (which read process.env at import time) see the values. Best-effort: if no .env
// exists, real environment variables are used as-is.
//
// Secrets (e.g. FINNHUB_API_KEY) stay server-side and are never logged.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file present (or unreadable) — fall back to the existing environment.
}
