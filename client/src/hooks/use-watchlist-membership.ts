import { useQuery, useQueries } from "@tanstack/react-query";
import type { Watchlist, WatchlistItem } from "@shared/schema";

export interface WatchlistMembershipEntry {
  watchlist: Watchlist;
  /** The item row for this symbol in this watchlist, or null if not present. */
  item: WatchlistItem | null;
}

/**
 * For a given symbol, reuses the existing GET /api/watchlists and
 * GET /api/watchlists/:id/items endpoints (no new API, no new dependency) to tell,
 * per watchlist, whether the symbol is already saved there (and the item id needed
 * to remove it). Powers both the star color on the stock detail page and the
 * selected/unselected list in WatchlistModal.
 */
export function useWatchlistMembership(symbol: string, enabled = true) {
  const { data: watchlists = [], isLoading: watchlistsLoading } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
    enabled,
  });

  const itemQueries = useQueries({
    queries: watchlists.map((w) => ({
      queryKey: [`/api/watchlists/${w.id}/items`],
      enabled,
    })),
  });

  const entries: WatchlistMembershipEntry[] = watchlists.map((watchlist, i) => {
    const items = (itemQueries[i]?.data as WatchlistItem[] | undefined) ?? [];
    const item = items.find((it) => it.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
    return { watchlist, item };
  });

  const isInAnyWatchlist = entries.some((e) => e.item != null);
  const isLoading = watchlistsLoading || itemQueries.some((q) => q.isLoading);

  return { entries, isInAnyWatchlist, isLoading };
}
