// Pure helpers for the desktop trading view's draggable, persistent tabs.
// Kept side-effect free so they are unit-testable without a DOM.

export type TabKind = "watchlist" | "portfolio";

export interface TradingTab {
  key: string; // stable id: `w:<id>` (watchlist) | `p:<id>` (portfolio)
  kind: TabKind;
  id: number;
  name: string;
}

export const tabKey = (kind: TabKind, id: number): string =>
  `${kind === "watchlist" ? "w" : "p"}:${id}`;

/**
 * Order the available tabs by a persisted key order: known keys first (in the
 * stored order), then any new tabs not yet in the stored order (appended in
 * their natural order). Stored keys that no longer exist are dropped.
 */
export function orderTabs(all: TradingTab[], storedOrder: string[]): TradingTab[] {
  const byKey = new Map(all.map((t) => [t.key, t]));
  const seen = new Set<string>();
  const result: TradingTab[] = [];
  for (const k of storedOrder) {
    const t = byKey.get(k);
    if (t && !seen.has(k)) {
      result.push(t);
      seen.add(k);
    }
  }
  for (const t of all) {
    if (!seen.has(t.key)) result.push(t);
  }
  return result;
}

/**
 * Move `from` so it sits at the current position of `to` (drag-and-drop reorder).
 * Returns a new array; unchanged if either key is missing or they are equal.
 */
export function moveKey(keys: string[], from: string, to: string): string[] {
  if (from === to) return keys;
  const fromIdx = keys.indexOf(from);
  const toIdx = keys.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return keys;
  const next = keys.slice();
  next.splice(fromIdx, 1);
  next.splice(toIdx, 0, from);
  return next;
}
