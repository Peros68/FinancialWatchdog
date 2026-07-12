import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link } from "wouter";
import { Star, Briefcase, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel } from "@/components/ui/resizable";
import { PanelResizeHandle } from "react-resizable-panels";
import StockChart from "@/components/stock-chart";
import AlertModal from "@/components/alert-modal";
import type { Watchlist, WatchlistItem, Portfolio, PortfolioHolding, StockQuote } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { orderTabs, moveKey, tabKey, type TradingTab } from "@/lib/trading";
import { cn } from "@/lib/utils";

const num2 = (n?: number | null) =>
  typeof n === "number" && !Number.isNaN(n)
    ? n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

const signClass = (n?: number | null) =>
  typeof n === "number" && !Number.isNaN(n) ? (n >= 0 ? "gain" : "loss") : "text-muted-foreground";

const fmtPct = (n?: number | null) =>
  typeof n === "number" && !Number.isNaN(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—";

type AlertTarget = { symbol: string; price?: number } | null;

export default function TradingPage() {
  const isMobile = useIsMobile();

  const { data: watchlists = [] } = useQuery<Watchlist[]>({ queryKey: ["/api/watchlists"] });
  const { data: portfolios = [] } = useQuery<Portfolio[]>({ queryKey: ["/api/portfolios"] });

  const [order, setOrder] = useLocalStorage<string[]>("trading:tabOrder", []);
  const [activeKey, setActiveKey] = useLocalStorage<string | null>("trading:activeTab", null);
  const [listCollapsed, setListCollapsed] = useLocalStorage<boolean>("trading:listCollapsed", false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const dragKey = useRef<string | null>(null);

  const allTabs: TradingTab[] = useMemo(
    () => [
      ...watchlists.map((w) => ({ key: tabKey("watchlist", w.id), kind: "watchlist" as const, id: w.id, name: w.name })),
      ...portfolios.map((p) => ({ key: tabKey("portfolio", p.id), kind: "portfolio" as const, id: p.id, name: p.name })),
    ],
    [watchlists, portfolios],
  );

  const orderedTabs = useMemo(() => orderTabs(allTabs, order), [allTabs, order]);
  const active = orderedTabs.find((t) => t.key === activeKey) ?? orderedTabs[0] ?? null;

  // Reset the chart selection when the active collection changes; each list
  // auto-selects its first row on load.
  useEffect(() => {
    setSelectedSymbol(null);
  }, [active?.key]);

  const handleDrop = (targetKey: string) => {
    const from = dragKey.current;
    dragKey.current = null;
    if (from) setOrder(moveKey(orderedTabs.map((t) => t.key), from, targetKey));
  };

  // Desktop-only view: on mobile point to the existing pages (left untouched).
  if (isMobile) {
    return (
      <main className="max-w-md mx-auto px-4 py-10 text-center space-y-4">
        <h2 className="text-xl font-semibold">Vista trading solo desktop</h2>
        <p className="text-sm text-muted-foreground">
          La vista trading è ottimizzata per desktop. Su mobile usa le pagine dedicate:
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/watchlist"><Button variant="outline">Watchlist</Button></Link>
          <Link href="/portfolios"><Button variant="outline">Portafogli</Button></Link>
        </div>
      </main>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Draggable, persistent tabs */}
      <div className="flex items-stretch gap-1 overflow-x-auto border-b border-border bg-card px-2">
        {orderedTabs.map((tab) => (
          <button
            key={tab.key}
            draggable
            onDragStart={() => (dragKey.current = tab.key)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(tab.key)}
            onClick={() => setActiveKey(tab.key)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px cursor-grab active:cursor-grabbing transition-colors",
              active?.key === tab.key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            title="Trascina per riordinare"
          >
            {tab.kind === "portfolio" ? <Briefcase className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
            {tab.name}
          </button>
        ))}
        {orderedTabs.length === 0 && (
          <span className="px-3 py-2 text-sm text-muted-foreground">
            Nessuna watchlist o portafoglio. Creane dalle pagine dedicate.
          </span>
        )}
      </div>

      {/* Resizable list + chart */}
      <div className="flex-1 min-h-0">
        {!active ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Seleziona o crea una collezione.
          </div>
        ) : listCollapsed ? (
          <div className="h-full flex">
            <CollapsedRail onExpand={() => setListCollapsed(false)} />
            <div className="flex-1 min-w-0">
              <ChartPanel symbol={selectedSymbol} />
            </div>
          </div>
        ) : (
          <ResizablePanelGroup
            key={active.kind}
            direction="horizontal"
            autoSaveId={`trading-split-${active.kind}`}
            className="h-full"
          >
            <ResizablePanel id="list" order={1} defaultSize={active.kind === "portfolio" ? 40 : 26} minSize={16}>
              {active.kind === "portfolio" ? (
                <PortfolioList
                  key={active.key}
                  portfolio={portfolios.find((p) => p.id === active.id)!}
                  selectedSymbol={selectedSymbol}
                  onSelect={setSelectedSymbol}
                />
              ) : (
                <WatchlistList
                  key={active.key}
                  watchlistId={active.id}
                  selectedSymbol={selectedSymbol}
                  onSelect={setSelectedSymbol}
                />
              )}
            </ResizablePanel>
            <DividerHandle onCollapse={() => setListCollapsed(true)} />
            <ResizablePanel id="chart" order={2} defaultSize={active.kind === "portfolio" ? 60 : 74} minSize={30}>
              <ChartPanel symbol={selectedSymbol} />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}

function useQuoteMap(symbols: string[]) {
  const results = useQueries({
    queries: symbols.map((s) => ({ queryKey: [`/api/stocks/quote/${s}`], staleTime: 60_000 })),
  });
  const map = new Map<string, StockQuote | undefined>();
  symbols.forEach((s, i) => map.set(s, results[i]?.data as StockQuote | undefined));
  return map;
}

function RowShell({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <tr
      onClick={onSelect}
      className={cn(
        "cursor-pointer border-b border-border/50 hover:bg-muted/40",
        selected && "bg-primary/10",
      )}
    >
      {children}
    </tr>
  );
}

function BellButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
      onClick={onClick}
      aria-label="Crea alert"
    >
      <Bell className="w-3.5 h-3.5" />
    </Button>
  );
}

function PortfolioList({
  portfolio,
  selectedSymbol,
  onSelect,
}: {
  portfolio: Portfolio;
  selectedSymbol: string | null;
  onSelect: (s: string) => void;
}) {
  const { data: holdings = [] } = useQuery<PortfolioHolding[]>({
    queryKey: [`/api/portfolios/${portfolio.id}/holdings`],
  });
  const quotes = useQuoteMap(holdings.map((h) => h.symbol));
  const [alertFor, setAlertFor] = useState<AlertTarget>(null);

  useEffect(() => {
    if (holdings.length > 0 && (!selectedSymbol || !holdings.some((h) => h.symbol === selectedSymbol))) {
      onSelect(holdings[0].symbol);
    }
  }, [holdings, selectedSymbol, onSelect]);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card z-10 text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left font-medium px-3 py-2">Descrizione</th>
            <th className="text-right font-medium px-2 py-2">Prezzo</th>
            <th className="text-right font-medium px-2 py-2">P&amp;L oggi</th>
            <th className="text-right font-medium px-2 py-2">P&amp;L %</th>
            <th className="text-right font-medium px-2 py-2">Prezzo medio</th>
            <th className="text-right font-medium px-2 py-2">Quantità</th>
            <th className="text-right font-medium px-2 py-2">Valore di carico</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const q = quotes.get(h.symbol);
            const pnlToday = q ? q.change * h.quantity : undefined;
            return (
              <RowShell key={h.id} selected={h.symbol === selectedSymbol} onSelect={() => onSelect(h.symbol)}>
                <td className="px-3 py-1">
                  <div className="font-medium truncate max-w-[220px]">{h.name}</div>
                  <div className="text-xs text-muted-foreground">{h.symbol} · {h.exchange}</div>
                </td>
                <td className="text-right px-2 py-1">{num2(q?.currentPrice)}</td>
                <td className={cn("text-right px-2 py-1", signClass(pnlToday))}>{num2(pnlToday)}</td>
                <td className={cn("text-right px-2 py-1", signClass(q?.changePercent))}>{fmtPct(q?.changePercent)}</td>
                <td className="text-right px-2 py-1">{num2(h.avgPrice)}</td>
                <td className="text-right px-2 py-1">{num2(h.quantity)}</td>
                <td className="text-right px-2 py-1">{num2(h.totalCost)}</td>
                <td className="text-center px-2 py-1">
                  <BellButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlertFor({ symbol: h.symbol, price: q?.currentPrice });
                    }}
                  />
                </td>
              </RowShell>
            );
          })}
          {holdings.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-8 text-muted-foreground">
                Nessuna posizione in "{portfolio.name}".
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {alertFor && (
        <AlertModal
          isOpen={!!alertFor}
          onClose={() => setAlertFor(null)}
          symbol={alertFor.symbol}
          currentPrice={alertFor.price}
        />
      )}
    </div>
  );
}

function WatchlistList({
  watchlistId,
  selectedSymbol,
  onSelect,
}: {
  watchlistId: number;
  selectedSymbol: string | null;
  onSelect: (s: string) => void;
}) {
  const { data: items = [] } = useQuery<WatchlistItem[]>({
    queryKey: [`/api/watchlists/${watchlistId}/items`],
  });
  const quotes = useQuoteMap(items.map((i) => i.symbol));
  const [alertFor, setAlertFor] = useState<AlertTarget>(null);

  useEffect(() => {
    if (items.length > 0 && (!selectedSymbol || !items.some((i) => i.symbol === selectedSymbol))) {
      onSelect(items[0].symbol);
    }
  }, [items, selectedSymbol, onSelect]);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card z-10 text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left font-medium px-3 py-2">Descrizione</th>
            <th className="text-right font-medium px-2 py-2">Prezzo</th>
            <th className="text-right font-medium px-2 py-2">P&amp;L %</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const q = quotes.get(it.symbol);
            return (
              <RowShell key={it.id} selected={it.symbol === selectedSymbol} onSelect={() => onSelect(it.symbol)}>
                <td className="px-3 py-1">
                  <div className="font-medium truncate max-w-[200px]">{it.name}</div>
                  <div className="text-xs text-muted-foreground">{it.symbol} · {it.exchange}</div>
                </td>
                <td className="text-right px-2 py-1">{num2(q?.currentPrice)}</td>
                <td className={cn("text-right px-2 py-1", signClass(q?.changePercent))}>{fmtPct(q?.changePercent)}</td>
                <td className="text-center px-2 py-1">
                  <BellButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlertFor({ symbol: it.symbol, price: q?.currentPrice });
                    }}
                  />
                </td>
              </RowShell>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center py-8 text-muted-foreground">
                Nessun titolo in questa watchlist.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {alertFor && (
        <AlertModal
          isOpen={!!alertFor}
          onClose={() => setAlertFor(null)}
          symbol={alertFor.symbol}
          currentPrice={alertFor.price}
        />
      )}
    </div>
  );
}

// Lateral arrow control on the list/chart divider. Stays visible on the border
// even when the list is hidden, so the user can always bring the list back.
function DividerHandle({ onCollapse }: { onCollapse: () => void }) {
  return (
    <PanelResizeHandle className="relative w-1.5 bg-border transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary">
      <button
        onPointerDown={(e) => e.stopPropagation()} // don't start a resize drag
        onClick={(e) => {
          e.stopPropagation();
          onCollapse();
        }}
        title="Nascondi la lista (grafico a tutta larghezza)"
        aria-label="Nascondi la lista"
        className="absolute top-1/2 -left-2 z-20 flex h-9 w-4 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow hover:text-foreground"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>
    </PanelResizeHandle>
  );
}

function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="relative w-1.5 shrink-0 bg-border">
      <button
        onClick={onExpand}
        title="Mostra la lista"
        aria-label="Mostra la lista"
        className="absolute top-1/2 left-0 z-20 flex h-9 w-4 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow hover:text-foreground"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

function ChartPanel({ symbol }: { symbol: string | null }) {
  const { data: quote } = useQuery<StockQuote>({
    queryKey: [`/api/stocks/quote/${symbol}`],
    enabled: !!symbol,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline gap-3 px-3 py-2 border-b border-border bg-card min-w-0">
        <span className="font-semibold truncate">{symbol ?? "—"}</span>
        {quote && (
          <>
            <span className="text-sm">{num2(quote.currentPrice)}</span>
            <span className={cn("text-sm", signClass(quote.changePercent))}>{fmtPct(quote.changePercent)}</span>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0 p-2">
        {symbol ? (
          <StockChart symbol={symbol} currentPrice={quote?.currentPrice} fillHeight />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Seleziona un titolo dalla lista.
          </div>
        )}
      </div>
    </div>
  );
}
