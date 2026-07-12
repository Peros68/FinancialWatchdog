import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Briefcase } from "lucide-react";
import { Link } from "wouter";
import type { Portfolio, PortfolioHolding, StockSearchResult } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import SearchInput from "@/components/search-input";
import PortfolioBuyForm, { type BuyStock } from "@/components/portfolio-buy-form";

export default function PortfoliosPage() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: portfolios } = useQuery<Portfolio[]>({ queryKey: ["/api/portfolios"] });

  const { data: holdings } = useQuery<PortfolioHolding[]>({
    queryKey: [`/api/portfolios/${activeId}/holdings`],
    enabled: activeId !== null,
  });

  useEffect(() => {
    if (portfolios && portfolios.length > 0 && activeId === null) {
      setActiveId(portfolios[0].id);
    }
  }, [portfolios, activeId]);

  const active = portfolios?.find((p) => p.id === activeId) ?? null;

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/portfolios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setActiveId(null);
      toast({ title: "Portafoglio eliminato" });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile eliminare il portafoglio.", variant: "destructive" }),
  });

  const removeHoldingMutation = useMutation({
    mutationFn: async (holdingId: number) => {
      await apiRequest("DELETE", `/api/portfolios/holdings/${holdingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/portfolios/${activeId}/holdings`] });
      toast({ title: "Posizione rimossa" });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile rimuovere la posizione.", variant: "destructive" }),
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <Card className="bg-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">I miei portafogli</h2>
            <div className="flex items-center gap-2">
              {active && (
                <>
                  <Button variant="outline" onClick={() => setShowAddPosition(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Aggiungi posizione
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="text-muted-foreground hover:text-red-500"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Elimina
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminare "{active.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Il portafoglio e tutte le sue posizioni saranno eliminati. L'azione non è reversibile.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(active.id)}>
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo portafoglio
              </Button>
            </div>
          </div>

          {portfolios && portfolios.length > 0 && (
            <div className="flex space-x-4 mb-6 overflow-x-auto">
              {portfolios.map((p) => (
                <Button
                  key={p.id}
                  variant={activeId === p.id ? "default" : "ghost"}
                  className={cn(
                    "whitespace-nowrap",
                    activeId === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveId(p.id)}
                >
                  {p.name}
                  <span className="ml-2 text-xs opacity-70">
                    {p.baseCurrency}
                    {p.multiCurrency ? " · multi" : ""}
                  </span>
                </Button>
              ))}
            </div>
          )}

          {active && (
            <div className="mb-4 text-xs text-muted-foreground">
              Commissioni EU: {active.feeEuPct}% + {active.feeEuFixed} · USA: {active.feeUsaPct}% + {active.feeUsaFixed} ({active.baseCurrency})
            </div>
          )}

          {holdings && holdings.length > 0 && (
            <div className="space-y-3">
              {holdings.map((h) => (
                <HoldingCard
                  key={h.id}
                  holding={h}
                  onRemove={() => removeHoldingMutation.mutate(h.id)}
                  removing={removeHoldingMutation.isPending}
                />
              ))}
            </div>
          )}

          {active && holdings && holdings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nessuna posizione in "{active.name}". Usa "Aggiungi posizione".
            </div>
          )}

          {(!portfolios || portfolios.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nessun portafoglio</p>
              <p className="text-sm mt-2">Crea il tuo primo portafoglio per iniziare</p>
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePortfolioDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(p) => setActiveId(p.id)}
      />

      {active && (
        <AddPositionDialog
          open={showAddPosition}
          onOpenChange={setShowAddPosition}
          portfolio={active}
        />
      )}
    </main>
  );
}

function HoldingCard({
  holding,
  onRemove,
  removing,
}: {
  holding: PortfolioHolding;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <Card className="bg-background border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Link href={`/stock/${holding.symbol}`} className="flex-1 cursor-pointer">
            <h3 className="font-semibold text-foreground">{holding.name}</h3>
            <p className="text-sm text-muted-foreground">
              {holding.symbol} • {holding.exchange}
              {holding.currency ? ` • ${holding.currency}` : ""}
            </p>
          </Link>
          <div className="text-right mr-4">
            <div className="font-medium">{holding.quantity} × {holding.avgPrice.toFixed(4)}</div>
            <div className="text-sm text-muted-foreground">
              Media (spese incl.) · costo {holding.totalCost.toFixed(2)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={removing}
            aria-label={`Rimuovi ${holding.symbol}`}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreatePortfolioDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (p: Portfolio) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("EUR");
  const [multiCurrency, setMultiCurrency] = useState(false);
  const [feeEuPct, setFeeEuPct] = useState("0");
  const [feeEuFixed, setFeeEuFixed] = useState("0");
  const [feeUsaPct, setFeeUsaPct] = useState("0");
  const [feeUsaFixed, setFeeUsaFixed] = useState("0");

  const num = (v: string) => {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/portfolios", {
        name: name.trim(),
        baseCurrency: baseCurrency.trim().toUpperCase(),
        multiCurrency,
        feeEuPct: num(feeEuPct),
        feeEuFixed: num(feeEuFixed),
        feeUsaPct: num(feeUsaPct),
        feeUsaFixed: num(feeUsaFixed),
      });
      return res.json() as Promise<Portfolio>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
      onCreated(created);
      onOpenChange(false);
      setName("");
      toast({ title: "Portafoglio creato", description: `"${created.name}" è stato creato.` });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile creare il portafoglio.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo portafoglio</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && baseCurrency.trim()) createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="pf-name">Nome</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Portafoglio reale" required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="pf-currency">Valuta base</Label>
              <Input id="pf-currency" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} placeholder="EUR" required />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor="pf-multi" className="text-sm">Multivaluta</Label>
              <Switch id="pf-multi" checked={multiCurrency} onCheckedChange={setMultiCurrency} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Commissioni EU (% + fisso)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input inputMode="decimal" value={feeEuPct} onChange={(e) => setFeeEuPct(e.target.value)} placeholder="% es. 0.19" />
              <Input inputMode="decimal" value={feeEuFixed} onChange={(e) => setFeeEuFixed(e.target.value)} placeholder="fisso" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Commissioni USA (% + fisso)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input inputMode="decimal" value={feeUsaPct} onChange={(e) => setFeeUsaPct(e.target.value)} placeholder="% es. 0.19" />
              <Input inputMode="decimal" value={feeUsaFixed} onChange={(e) => setFeeUsaFixed(e.target.value)} placeholder="fisso" />
            </div>
          </div>

          <div className="flex space-x-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={createMutation.isPending || !name.trim() || !baseCurrency.trim()}
            >
              {createMutation.isPending ? "Creazione..." : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddPositionDialog({
  open,
  onOpenChange,
  portfolio,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  portfolio: Portfolio;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BuyStock | null>(null);
  const debounced = useDebounce(query, 500);

  const { data: results } = useQuery<{ result: StockSearchResult[] }>({
    queryKey: [`/api/stocks/search?q=${debounced}`],
    enabled: debounced.length >= 2 && !selected,
  });

  const reset = () => {
    setQuery("");
    setSelected(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi posizione a {portfolio.name}</DialogTitle>
        </DialogHeader>

        {selected ? (
          <PortfolioBuyForm
            portfolio={portfolio}
            stock={selected}
            onDone={() => {
              onOpenChange(false);
              reset();
            }}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="space-y-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Cerca titolo (min 2 caratteri)..." />
            {results && results.result.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.result.map((stock, i) => (
                  <Button
                    key={`${stock.symbol}-${i}`}
                    variant="outline"
                    className="w-full justify-between text-left bg-background border-border hover:border-primary"
                    onClick={() => setSelected({ symbol: stock.symbol, name: stock.name, exchange: stock.exchange })}
                  >
                    <div>
                      <div className="font-medium">{stock.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {stock.symbol} • {stock.exchange}
                      </div>
                    </div>
                    <Briefcase className="w-4 h-4 shrink-0 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
