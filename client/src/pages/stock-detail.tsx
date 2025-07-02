import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, Bell, Expand } from "lucide-react";
import { Link } from "wouter";
import StockChart from "@/components/stock-chart";
import { StockQuote, StockProfile } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();

  const { data: quote, isLoading: quoteLoading } = useQuery<StockQuote>({
    queryKey: [`/api/stocks/quote/${symbol}`],
    enabled: !!symbol,
  });

  const { data: profile, isLoading: profileLoading } = useQuery<StockProfile>({
    queryKey: [`/api/stocks/profile/${symbol}`],
    enabled: !!symbol,
  });

  if (!symbol) {
    return <div className="text-center py-8">Stock not found</div>;
  }

  const isLoading = quoteLoading || profileLoading;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Compact Header - 50% smaller */}
        <Card className="bg-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-7 px-2">
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Back
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary h-7 px-2">
                <Star className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="min-w-0 flex-1">
                {profile && (
                  <>
                    <h1 className="text-lg font-bold text-foreground truncate">{profile.name}</h1>
                    <p className="text-muted-foreground text-sm">{profile.exchange}: {symbol}</p>
                  </>
                )}
                {!profile && !isLoading && (
                  <>
                    <h1 className="text-lg font-bold text-foreground">{symbol}</h1>
                    <p className="text-muted-foreground text-sm">Stock Symbol</p>
                  </>
                )}
              </div>
              
              {quote && (
                <div className="text-right flex-shrink-0">
                  <div className="text-xl font-bold text-foreground">${quote.currentPrice.toFixed(2)}</div>
                  <div className="flex items-center justify-end space-x-1 text-sm">
                    <span className={cn("font-medium", quote.change >= 0 ? "gain" : "loss")}>
                      {quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}
                    </span>
                    <span className={cn("font-medium", quote.changePercent >= 0 ? "gain" : "loss")}>
                      ({quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Real-time • USD</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="bg-card">
          <CardContent className="p-6">
            <StockChart symbol={symbol} currentPrice={quote?.currentPrice} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
