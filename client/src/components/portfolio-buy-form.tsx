import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Portfolio, StockQuote, StockProfile } from "@shared/schema";
import { classifyMarket, commissionFor } from "@shared/portfolio";

export interface BuyStock {
  symbol: string;
  name: string;
  exchange: string;
  currency?: string | null;
}

interface PortfolioBuyFormProps {
  portfolio: Portfolio;
  stock: BuyStock;
  onDone: () => void;
  onBack: () => void;
}

const numOr = (v: string, fallback = 0): number => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

export default function PortfolioBuyForm({ portfolio, stock, onDone, onBack }: PortfolioBuyFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [priceEdited, setPriceEdited] = useState(false);
  const [commission, setCommission] = useState("");
  const [commissionEdited, setCommissionEdited] = useState(false);
  const [feesIncluded, setFeesIncluded] = useState(false);

  // Current price prefill (editable). Only prefills until the user types.
  const { data: quote } = useQuery<StockQuote>({
    queryKey: [`/api/stocks/quote/${stock.symbol}`],
  });
  // Profile gives the security currency (for market classification + the guard).
  const { data: profile } = useQuery<StockProfile>({
    queryKey: [`/api/stocks/profile/${stock.symbol}`],
  });

  const currency = stock.currency ?? profile?.currency ?? null;
  const currentPrice = quote?.currentPrice ?? null;

  const priceValue = priceEdited || price !== "" ? price : currentPrice != null ? String(currentPrice) : "";
  const qtyNum = numOr(quantity);
  const priceNum = numOr(priceValue);

  const market = classifyMarket(currency, stock.exchange, stock.symbol);
  const autoCommission = useMemo(
    () => commissionFor(market, portfolio, qtyNum, priceNum),
    [market, portfolio, qtyNum, priceNum],
  );

  const commissionValue = feesIncluded
    ? 0
    : commissionEdited
      ? numOr(commission)
      : Number(autoCommission.toFixed(4));

  const addedCost = qtyNum * priceNum + commissionValue;

  const currencyMismatch =
    !portfolio.multiCurrency && currency != null &&
    currency.toUpperCase() !== portfolio.baseCurrency.toUpperCase();

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        currency,
        quantity: qtyNum,
        price: priceNum,
        feesIncluded,
      };
      if (!feesIncluded) body.commission = commissionValue;
      const res = await apiRequest("POST", `/api/portfolios/${portfolio.id}/holdings`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/portfolios/${portfolio.id}/holdings`] });
      toast({
        title: "Posizione aggiornata",
        description: `${stock.symbol} · ${qtyNum} @ ${priceNum} in "${portfolio.name}"`,
      });
      onDone();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error?.message || "Impossibile aggiungere la posizione.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = qtyNum > 0 && priceNum >= 0 && !currencyMismatch && !mutation.isPending;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Aggiungo <span className="font-medium text-foreground">{stock.symbol}</span> a{" "}
        <span className="font-medium text-foreground">{portfolio.name}</span>
        <span className="ml-1">· mercato {market}{currency ? ` · ${currency}` : ""}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="buy-qty">Quantità</Label>
          <Input
            id="buy-qty"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="buy-price">
            {feesIncluded ? "Prezzo medio (spese incluse)" : "Prezzo corrente"}
          </Label>
          <Input
            id="buy-price"
            inputMode="decimal"
            value={priceValue}
            onChange={(e) => {
              setPriceEdited(true);
              setPrice(e.target.value);
            }}
            placeholder={currentPrice != null ? String(currentPrice) : "0"}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <div className="text-sm font-medium">Spese già incluse nel prezzo</div>
          <div className="text-xs text-muted-foreground">
            Import di una posizione reale: il sistema non ricalcola le commissioni.
          </div>
        </div>
        <Switch
          checked={feesIncluded}
          onCheckedChange={(v) => setFeesIncluded(v)}
          aria-label="Spese già incluse nel prezzo"
        />
      </div>

      {!feesIncluded && (
        <div className="space-y-2">
          <Label htmlFor="buy-commission">Commissione ({market})</Label>
          <Input
            id="buy-commission"
            inputMode="decimal"
            value={commissionEdited ? commission : String(commissionValue)}
            onChange={(e) => {
              setCommissionEdited(true);
              setCommission(e.target.value);
            }}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Precompilata dalla config {market} del portafoglio · modificabile.
          </p>
        </div>
      )}

      <div className="rounded-md bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Costo operazione</span>
          <span className="font-medium">
            {addedCost.toFixed(2)} {portfolio.baseCurrency}
          </span>
        </div>
      </div>

      {currencyMismatch && (
        <p className="text-sm text-red-500">
          Portafoglio non multivaluta: accetta solo {portfolio.baseCurrency}, il titolo è in {currency}.
        </p>
      )}

      <div className="flex space-x-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          Indietro
        </Button>
        <Button
          type="button"
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Salvataggio..." : "Aggiungi al portafoglio"}
        </Button>
      </div>
    </div>
  );
}
