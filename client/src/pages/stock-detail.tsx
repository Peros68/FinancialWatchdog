import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star } from "lucide-react";
import { Link } from "wouter";
import StockChart from "@/components/stock-chart";
import WatchlistModal from "@/components/watchlist-modal";
import { StockQuote, StockProfile, StockSearchResult, Fundamentals } from "@shared/schema";
import { cn } from "@/lib/utils";

// Safe numeric formatter: tolerates missing/partial quote fields (e.g. when the
// market-data provider key is absent) without throwing.
const fmt = (n?: number | null) =>
  typeof n === "number" && !Number.isNaN(n) ? n.toFixed(2) : "—";

const fmtPct = (n?: number | null) =>
  typeof n === "number" && !Number.isNaN(n) ? `${n.toFixed(2)}%` : "—";

const fmtText = (s?: string | null) => (s && s.trim() ? s : "—");

// Finnhub reports market cap in millions of the listing currency.
const fmtMarketCapMillions = (m?: number | null) => {
  if (typeof m !== "number" || Number.isNaN(m) || m <= 0) return "—";
  if (m >= 1_000_000) return `$${(m / 1_000_000).toFixed(2)}T`;
  if (m >= 1_000) return `$${(m / 1_000).toFixed(2)}B`;
  return `$${m.toFixed(0)}M`;
};

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

  const { data: quote, isLoading: quoteLoading } = useQuery<StockQuote>({
    queryKey: [`/api/stocks/quote/${symbol}`],
    enabled: !!symbol,
  });

  const { data: profile, isLoading: profileLoading } = useQuery<StockProfile>({
    queryKey: [`/api/stocks/profile/${symbol}`],
    enabled: !!symbol,
  });

  const { data: fundamentals } = useQuery<Fundamentals>({
    queryKey: [`/api/stocks/fundamentals/${symbol}`],
    enabled: !!symbol,
  });

  if (!symbol) {
    return <div className="text-center py-8">Stock not found</div>;
  }

  const isLoading = quoteLoading || profileLoading;
  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;

  const watchlistStock: StockSearchResult = {
    symbol,
    name: profile?.name || symbol,
    type: "Stock",
    exchange: profile?.exchange || "N/A",
  };

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
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-primary h-7 px-2"
                onClick={() => setShowWatchlistModal(true)}
                aria-label="Aggiungi a una watchlist"
              >
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
                  <div className="text-xl font-bold text-foreground">${fmt(quote.currentPrice)}</div>
                  <div className="flex items-center justify-end space-x-1 text-sm">
                    <span className={cn("font-medium", change >= 0 ? "gain" : "loss")}>
                      {change >= 0 ? "+" : ""}${fmt(change)}
                    </span>
                    <span className={cn("font-medium", changePercent >= 0 ? "gain" : "loss")}>
                      ({changePercent >= 0 ? "+" : ""}{fmt(changePercent)}%)
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

        {/* Fundamentals */}
        <Card className="bg-card">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Dati fondamentali</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Settore", value: fmtText(fundamentals?.sector) },
                { label: "Industria", value: fmtText(fundamentals?.industry) },
                { label: "Market Cap", value: fmtMarketCapMillions(fundamentals?.marketCapitalization) },
                { label: "P/E", value: fmt(fundamentals?.peRatio) },
                { label: "P/B", value: fmt(fundamentals?.pbRatio) },
                { label: "P/S", value: fmt(fundamentals?.psRatio) },
                { label: "EPS", value: fmt(fundamentals?.eps) },
                { label: "Dividend Yield", value: fmtPct(fundamentals?.dividendYield) },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-sm font-semibold text-foreground">{f.value}</p>
                </div>
              ))}
            </div>

            {fundamentals?.dividends && fundamentals.dividends.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-1">Dividendi recenti</p>
                <div className="flex flex-wrap gap-2">
                  {fundamentals.dividends.slice(-6).map((d) => (
                    <span key={d.date} className="text-xs bg-muted px-2 py-0.5 rounded">
                      {d.date}: ${d.amount.toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              {fundamentals?.sources && fundamentals.sources.length > 0
                ? `Fonti: ${fundamentals.sources.join(", ")}`
                : "Dati non disponibili dai provider configurati."}
            </p>
          </CardContent>
        </Card>
      </div>

      <WatchlistModal
        isOpen={showWatchlistModal}
        onClose={() => setShowWatchlistModal(false)}
        stock={watchlistStock}
      />
    </main>
  );
}
