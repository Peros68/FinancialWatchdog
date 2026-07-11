import { Star } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockSearchResult } from "@shared/schema";
import WatchlistModal from "./watchlist-modal";
import { useState } from "react";
import { useWatchlistMembership } from "@/hooks/use-watchlist-membership";
import { cn } from "@/lib/utils";

interface StockItemProps {
  stock: StockSearchResult;
}

export default function StockItem({ stock }: StockItemProps) {
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const { isInAnyWatchlist } = useWatchlistMembership(stock.symbol);

  const handleStarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowWatchlistModal(true);
  };

  return (
    <>
      <Card className="bg-background border-border hover:border-muted-foreground transition-colors cursor-pointer group">
        <CardContent className="p-4">
          <Link href={`/stock/${stock.symbol}`} className="block">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{stock.name}</h3>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>{stock.symbol}</span>
                      <span>•</span>
                      <Badge variant="secondary" className="text-xs">
                        {stock.type}
                      </Badge>
                      <span>•</span>
                      <span>{stock.exchange}</span>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary transition-colors p-2"
                onClick={handleStarClick}
              >
                <Star className={cn("w-4 h-4", isInAnyWatchlist && "fill-yellow-400 text-yellow-400")} />
              </Button>
            </div>
          </Link>
        </CardContent>
      </Card>

      <WatchlistModal
        isOpen={showWatchlistModal}
        onClose={() => setShowWatchlistModal(false)}
        stock={stock}
      />
    </>
  );
}
