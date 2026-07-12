import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Star, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { StockSearchResult, type Portfolio } from "@shared/schema";
import { useWatchlistMembership } from "@/hooks/use-watchlist-membership";
import { cn } from "@/lib/utils";
import PortfolioBuyForm from "./portfolio-buy-form";

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockSearchResult;
}

export default function WatchlistModal({ isOpen, onClose, stock }: WatchlistModalProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [buyPortfolio, setBuyPortfolio] = useState<Portfolio | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { entries } = useWatchlistMembership(stock.symbol, isOpen);

  const { data: portfolios = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios"],
    enabled: isOpen,
  });

  const invalidateItems = (watchlistId: number) => {
    queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${watchlistId}/items`] });
  };

  const createWatchlistMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/watchlists", { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      setNewWatchlistName("");
      setShowCreateForm(false);
      toast({
        title: "Watchlist Created",
        description: "Your new watchlist has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create watchlist. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: async (watchlistId: number) => {
      const response = await apiRequest("POST", `/api/watchlists/${watchlistId}/items`, {
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
      });
      return { watchlistId, body: await response.json() };
    },
    onSuccess: ({ watchlistId }) => {
      invalidateItems(watchlistId);
      toast({
        title: "Added to Watchlist",
        description: `${stock.name} has been added to your watchlist.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add stock to watchlist.",
        variant: "destructive",
      });
    },
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: number; watchlistId: number }) => {
      await apiRequest("DELETE", `/api/watchlists/items/${itemId}`);
    },
    onSuccess: (_data, { watchlistId }) => {
      invalidateItems(watchlistId);
      toast({
        title: "Removed from Watchlist",
        description: `${stock.name} has been removed from that watchlist.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove stock from watchlist.",
        variant: "destructive",
      });
    },
  });

  const handleCreateWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWatchlistName.trim()) {
      createWatchlistMutation.mutate(newWatchlistName.trim());
    }
  };

  const handleToggleWatchlist = (watchlistId: number, itemId: number | null) => {
    if (itemId != null) {
      removeFromWatchlistMutation.mutate({ itemId, watchlistId });
    } else {
      addToWatchlistMutation.mutate(watchlistId);
    }
  };

  const isToggling = addToWatchlistMutation.isPending || removeFromWatchlistMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Aggiungi <span className="text-primary">{stock.symbol}</span>
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {stock.name} ({stock.symbol})
          </div>

          <Tabs defaultValue="watchlist" onValueChange={() => setBuyPortfolio(null)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="watchlist">
                <Star className="w-4 h-4 mr-2" />
                Watchlist
              </TabsTrigger>
              <TabsTrigger value="portfolio">
                <Briefcase className="w-4 h-4 mr-2" />
                Portafoglio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="watchlist" className="space-y-4 pt-2">
          {!showCreateForm && (
            <>
              <div className="space-y-3">
                {entries.map(({ watchlist, item }) => (
                  <Button
                    key={watchlist.id}
                    variant="outline"
                    className={cn(
                      "w-full justify-between text-left bg-background border-border hover:border-primary",
                      item != null && "border-yellow-400/50",
                    )}
                    onClick={() => handleToggleWatchlist(watchlist.id, item?.id ?? null)}
                    disabled={isToggling}
                  >
                    <div>
                      <div className="font-medium">{watchlist.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item != null ? "Presente — clicca per rimuovere" : "Clicca per aggiungere"}
                      </div>
                    </div>
                    <Star
                      className={cn(
                        "w-4 h-4 shrink-0",
                        item != null ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground",
                      )}
                    />
                  </Button>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Watchlist
                </Button>
              </div>
            </>
          )}

          {showCreateForm && (
            <form onSubmit={handleCreateWatchlist} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="watchlist-name">Watchlist Name</Label>
                <Input
                  id="watchlist-name"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  placeholder="Enter watchlist name"
                  className="bg-background border-border"
                  required
                />
              </div>
              
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={createWatchlistMutation.isPending}
                >
                  {createWatchlistMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          )}
            </TabsContent>

            <TabsContent value="portfolio" className="space-y-3 pt-2">
              {buyPortfolio ? (
                <PortfolioBuyForm
                  portfolio={buyPortfolio}
                  stock={stock}
                  onDone={onClose}
                  onBack={() => setBuyPortfolio(null)}
                />
              ) : portfolios.length > 0 ? (
                <div className="space-y-3">
                  {portfolios.map((portfolio) => (
                    <Button
                      key={portfolio.id}
                      variant="outline"
                      className="w-full justify-between text-left bg-background border-border hover:border-primary"
                      onClick={() => setBuyPortfolio(portfolio)}
                    >
                      <div>
                        <div className="font-medium">{portfolio.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {portfolio.baseCurrency}
                          {portfolio.multiCurrency ? " · multivaluta" : ""}
                        </div>
                      </div>
                      <Briefcase className="w-4 h-4 shrink-0 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <p>Nessun portafoglio.</p>
                  <p className="mt-1">Creane uno dalla pagina Portafogli.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
