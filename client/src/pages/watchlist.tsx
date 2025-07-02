import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Star } from "lucide-react";
import { Link } from "wouter";
import { Watchlist, WatchlistItem } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function WatchlistPage() {
  const [activeWatchlist, setActiveWatchlist] = useState<number | null>(null);

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  const { data: watchlistItems } = useQuery<WatchlistItem[]>({
    queryKey: [`/api/watchlists/${activeWatchlist}/items`],
    enabled: activeWatchlist !== null,
  });

  // Set first watchlist as active by default
  if (watchlists && watchlists.length > 0 && activeWatchlist === null) {
    setActiveWatchlist(watchlists[0].id);
  }

  const activeWatchlistData = watchlists?.find(wl => wl.id === activeWatchlist);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="space-y-6">
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">My Watchlists</h2>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                New Watchlist
              </Button>
            </div>

            {/* Watchlist Tabs */}
            {watchlists && watchlists.length > 0 && (
              <div className="flex space-x-4 mb-6 overflow-x-auto">
                {watchlists.map((watchlist) => (
                  <Button
                    key={watchlist.id}
                    variant={activeWatchlist === watchlist.id ? "default" : "ghost"}
                    className={cn(
                      "whitespace-nowrap",
                      activeWatchlist === watchlist.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveWatchlist(watchlist.id)}
                  >
                    {watchlist.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Watchlist Items */}
            {watchlistItems && watchlistItems.length > 0 && (
              <div className="space-y-3">
                {watchlistItems.map((item) => (
                  <WatchlistItemCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {watchlistItems && watchlistItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No stocks in {activeWatchlistData?.name || "this watchlist"}
              </div>
            )}

            {!watchlists || watchlists.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No watchlists found</p>
                <p className="text-sm mt-2">Create your first watchlist to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function WatchlistItemCard({ item }: { item: WatchlistItem }) {
  return (
    <Card className="bg-background border-border hover:border-muted-foreground transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Link href={`/stock/${item.symbol}`} className="flex items-center space-x-3 cursor-pointer flex-1">
            <div>
              <h3 className="font-semibold text-foreground">{item.name}</h3>
              <p className="text-sm text-muted-foreground">{item.symbol} • {item.exchange}</p>
            </div>
          </Link>
          
          <div className="text-right">
            <div className="font-semibold text-foreground">--</div>
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <span>--</span>
              <span>--</span>
            </div>
          </div>
          
          <Button variant="ghost" size="sm" className="ml-4 text-primary hover:text-primary/80">
            <Star className="w-4 h-4 fill-current" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
