import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link } from "wouter";
import { Star, Briefcase, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel } from "@/components/ui/resizable";
import { PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import StockChart from "@/components/stock-chart";
import AlertModal from "@/components/alert-modal";
import type { Watchlist, WatchlistItem, Portfolio, PortfolioHolding, StockQuote, Alert } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { orderTabs, moveKey, tabKey, resolveSelectedSymbol, type TradingTab } from "@/lib/trading";
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

  // Alerts drive the bell state in the list. The chart invalidates ["/api/alerts"]
  // whenever an alert is created/removed, so the list bell updates immediately.
  const { data: alerts = [] } = useQuery<Alert[]>({ queryKey: ["/api/alerts"] });
  const alertSymbols = useMemo(
    () =>
      new Set(
        alerts
          .filter((a) => a.isActive !== false && !a.triggeredAt)
          .map((a) => a.symbol.toUpperCase()),
      ),
    [alerts],
  );

  const [order, setOrder] = useLocalStorage<string[]>("trading:tabOrder", []);
  const [activeKey, setActiveKey] = useLocalStorage<string | null>("trading:activeTab", null);
  const [listCollapsed, setListCollapsed] = useLocalStorage<boolean>("trading:listCollapsed", false);
  const [selectedSymbol, setSelectedSymbol] = useLocalStorage<string | null>("trading:selectedSymbol", null);
  const dragKey = useRef<string | null>(null);
  const listPanelRef = useRef<ImperativePanelHandle>(null);

  const allTabs: TradingTab[] = useMemo(
    () => [
      ...watchlists.map((w) => ({ key: tabKey("watchlist", w.id), kind: "watchlist" as const, id: w.id, name: w.name })),
      ...portfolios.map((p) => ({ key: tabKey("portfolio", p.id), kind: "portfolio" as const, id: p.id, name: p.name })),
    ],
    [watchlists, portfolios],
  );

  const orderedTabs = useMemo(() => orderTabs(allTabs, order), [allTabs, order]);
  const active = orderedTabs.find((t) => t.key === activeKey) ?? orderedTabs[0] ?? null;

  // Symbols of the active collection are fetched HERE (page level), not only
  // inside the list, so a valid chart symbol can be resolved even when the list
  // is hidden (collapsed). React Query dedupes these against the list's queries.
  const activePortfolioId = active?.kind === "portfolio" ? active.id : null;
  const activeWatchlistId = active?.kind === "watchlist" ? active.id : null;
  const { data: activeHoldings } = useQuery<PortfolioHolding[]>({
    queryKey: [`/api/portfolios/${activePortfolioId}/holdings`],
    enabled: activePortfolioId != null,
  });
  const { data: activeItems } = useQuery<WatchlistItem[]>({
    queryKey: [`/api/watchlists/${activeWatchlistId}/items`],
    enabled: activeWatchlistId != null,
  });
  const activeSymbols = useMemo(
    () =>
      active?.kind === "portfolio"
        ? (activeHoldings ?? []).map((h) => h.symbol)
        : active?.kind === "watchlist"
          ? (activeItems ?? []).map((i) => i.symbol)
          : [],
    [active?.kind, activeHoldings, activeItems],
  );

  // Keep a valid chart symbol: restore the persisted one if it still belongs to
  // the active collection, otherwise fall back to the first row. Runs regardless
  // of list visibility, so returning to /trading with the list hidden — or after
  // the persisted symbol was dropped — never leaves the chart empty.
  useEffect(() => {
    const next = resolveSelectedSymbol(activeSymbols, selectedSymbol);
    if (next !== selectedSymbol) setSelectedSymbol(next);
  }, [activeSymbols, selectedSymbol, setSelectedSymbol]);

  const handleDrop = (targetKey: string) => {
    const from = dragKey.current;
    dragKey.current = null;
    if (from) setOrder(moveKey(orderedTabs.map((t) => t.key), from, targetKey));
  };

  const toggleList = () => {
    const p = listPanelRef.current;
    if (!p) return;
    if (p.isCollapsed()) p.expand();
    else p.collapse();
  };

  // Keep the single (never-remounted) panel group in sync with the persisted
  // collapsed state — applied when the panel first mounts and whenever the active
  // tab changes — but only on an actual mismatch, so switching Watchlist/Portafoglio
  // never jolts the split width or breaks the resize handle.
  useEffect(() => {
    const p = listPanelRef.current;
    if (!p) return;
    const isCol = p.isCollapsed();
    if (listCollapsed && !isCol) p.collapse();
    else if (!listCollapsed && isCol) p.expand();
  }, [active?.key, listCollapsed]);

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

      {/* Resizable list + chart. One PanelGroup, never remounted on tab change:
          the list panel collapses/expands in place so the resize handle and its
          cursor stay consistent after hide/restore and after switching tab. */}
      <div className="flex-1 min-h-0">
        {!active ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Seleziona o crea una collezione.
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" autoSaveId="trading-split" className="h-full">
            <ResizablePanel
              id="list"
              order={1}
              ref={listPanelRef}
              collapsible
              collapsedSize={0}
              minSize={12}
              defaultSize={26}
              onCollapse={() => setListCollapsed(true)}
              onExpand={() => setListCollapsed(false)}
            >
              {active.kind === "portfolio" ? (
                <PortfolioList
                  key={active.key}
                  portfolio={portfolios.find((p) => p.id === active.id)!}
                  selectedSymbol={selectedSymbol}
                  onSelect={setSelectedSymbol}
                  alertSymbols={alertSymbols}
                />
              ) : (
                <WatchlistList
                  key={active.key}
                  watchlistId={active.id}
                  selectedSymbol={selectedSymbol}
                  onSelect={setSelectedSymbol}
                  alertSymbols={alertSymbols}
                />
              )}
            </ResizablePanel>
            <DividerHandle collapsed={listCollapsed} onToggle={toggleList} />
            <ResizablePanel id="chart" order={2} minSize={30}>
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

function BellButton({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
      onClick={onClick}
      aria-label={active ? "Alert attivo su questo titolo" : "Crea alert"}
      title={active ? "Alert attivo" : "Crea alert"}
    >
      <Bell className={cn("w-3.5 h-3.5", active && "fill-yellow-400 text-yellow-400")} />
    </Button>
  );
}

function PortfolioList({
  portfolio,
  selectedSymbol,
  onSelect,
  alertSymbols,
}: {
  portfolio: Portfolio;
  selectedSymbol: string | null;
  onSelect: (s: string) => void;
  alertSymbols: Set<string>;
}) {
  const { data: holdings = [] } = useQuery<PortfolioHolding[]>({
    queryKey: [`/api/portfolios/${portfolio.id}/holdings`],
  });
  const quotes = useQuoteMap(holdings.map((h) => h.symbol));
  const [alertFor, setAlertFor] = useState<AlertTarget>(null);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card z-10 text-[11px] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left font-medium px-2 py-1.5">Titolo</th>
            <th className="text-right font-medium px-1.5 py-1.5 whitespace-nowrap">Prezzo</th>
            <th className="text-right font-medium px-1.5 py-1.5 whitespace-nowrap">P&amp;L</th>
            <th className="text-right font-medium px-1.5 py-1.5 whitespace-nowrap">P&amp;L%</th>
            <th className="text-right font-medium px-1.5 py-1.5 whitespace-nowrap">P.medio</th>
            <th className="text-right font-medium px-1.5 py-1.5 whitespace-nowrap">Qtà</th>
            <th className="text-right font-medium px-1.5 py-1.5 whitespace-nowrap">Carico</th>
            <th className="px-1 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const q = quotes.get(h.symbol);
            const pnlToday = q ? q.change * h.quantity : undefined;
            return (
              <RowShell key={h.id} selected={h.symbol === selectedSymbol} onSelect={() => onSelect(h.symbol)}>
                <td className="px-2 py-1">
                  <div className="font-medium truncate max-w-[130px]">{h.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[130px]">{h.symbol} · {h.exchange}</div>
                </td>
                <td className="text-right px-1.5 py-1 whitespace-nowrap">{num2(q?.currentPrice)}</td>
                <td className={cn("text-right px-1.5 py-1 whitespace-nowrap", signClass(pnlToday))}>{num2(pnlToday)}</td>
                <td className={cn("text-right px-1.5 py-1 whitespace-nowrap", signClass(q?.changePercent))}>{fmtPct(q?.changePercent)}</td>
                <td className="text-right px-1.5 py-1 whitespace-nowrap">{num2(h.avgPrice)}</td>
                <td className="text-right px-1.5 py-1 whitespace-nowrap">{num2(h.quantity)}</td>
                <td className="text-right px-1.5 py-1 whitespace-nowrap">{num2(h.totalCost)}</td>
                <td className="text-center px-1 py-1">
                  <BellButton
                    active={alertSymbols.has(h.symbol.toUpperCase())}
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
  alertSymbols,
}: {
  watchlistId: number;
  selectedSymbol: string | null;
  onSelect: (s: string) => void;
  alertSymbols: Set<string>;
}) {
  const { data: items = [] } = useQuery<WatchlistItem[]>({
    queryKey: [`/api/watchlists/${watchlistId}/items`],
  });
  const quotes = useQuoteMap(items.map((i) => i.symbol));
  const [alertFor, setAlertFor] = useState<AlertTarget>(null);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card z-10 text-[11px] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left font-medium px-2 py-1.5">Titolo</th>
            <th className="text-right font-medium px-1.5 py-1.5 whitespace-nowrap">Prezzo</th>
            <th className="text-right font-medium px-1.5 py-1.5 whitespace-nowrap">P&amp;L%</th>
            <th className="px-1 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const q = quotes.get(it.symbol);
            return (
              <RowShell key={it.id} selected={it.symbol === selectedSymbol} onSelect={() => onSelect(it.symbol)}>
                <td className="px-2 py-1">
                  <div className="font-medium truncate max-w-[130px]">{it.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[130px]">{it.symbol} · {it.exchange}</div>
                </td>
                <td className="text-right px-1.5 py-1 whitespace-nowrap">{num2(q?.currentPrice)}</td>
                <td className={cn("text-right px-1.5 py-1 whitespace-nowrap", signClass(q?.changePercent))}>{fmtPct(q?.changePercent)}</td>
                <td className="text-center px-1 py-1">
                  <BellButton
                    active={alertSymbols.has(it.symbol.toUpperCase())}
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
// Resize handle between list and chart. The bar itself carries the resize cursor
// (col-resize); the arrow tab keeps the normal pointer and toggles the list. The
// tab stays on the divider even when the list is collapsed (handle at far left).
function DividerHandle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <PanelResizeHandle className="relative w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary">
      <button
        onPointerDown={(e) => e.stopPropagation()} // don't start a resize drag
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title={collapsed ? "Mostra la lista titoli" : "Nascondi la lista titoli"}
        aria-label={collapsed ? "Mostra la lista titoli" : "Nascondi la lista titoli"}
        className="absolute top-1/2 left-1/2 z-20 flex h-10 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow hover:text-foreground"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </PanelResizeHandle>
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
