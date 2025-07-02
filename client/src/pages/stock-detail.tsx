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
        {/* Header */}
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Search
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                <Star className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                {profile && (
                  <>
                    <h1 className="text-3xl font-bold text-foreground">{profile.name}</h1>
                    <p className="text-muted-foreground text-lg">{profile.exchange}: {symbol}</p>
                  </>
                )}
                {!profile && !isLoading && (
                  <>
                    <h1 className="text-3xl font-bold text-foreground">{symbol}</h1>
                    <p className="text-muted-foreground text-lg">Stock Symbol</p>
                  </>
                )}
              </div>
              
              {quote && (
                <div className="text-right">
                  <div className="text-3xl font-bold text-foreground">${quote.currentPrice.toFixed(2)}</div>
                  <div className="flex items-center justify-end space-x-2">
                    <span className={cn("text-lg font-medium", quote.change >= 0 ? "gain" : "loss")}>
                      {quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)}
                    </span>
                    <span className={cn("text-lg font-medium", quote.changePercent >= 0 ? "gain" : "loss")}>
                      ({quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Real-time • USD</div>
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
