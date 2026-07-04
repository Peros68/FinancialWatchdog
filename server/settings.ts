import type { ProviderPreference } from "./marketData/types";

// In-memory app settings (no DB schema). Resets on restart, consistent with the
// current MemStorage approach. Default market-data provider is Yahoo.
let preferredProvider: ProviderPreference = "yahoo";

export const PROVIDER_PREFERENCES: ProviderPreference[] = ["yahoo", "finnhub", "auto"];

export function getPreferredProvider(): ProviderPreference {
  return preferredProvider;
}

export function setPreferredProvider(p: ProviderPreference): void {
  preferredProvider = p;
}

export function isValidPreference(value: unknown): value is ProviderPreference {
  return typeof value === "string" && (PROVIDER_PREFERENCES as string[]).includes(value);
}
