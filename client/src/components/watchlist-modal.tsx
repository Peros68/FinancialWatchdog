import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Watchlist, StockSearchResult } from "@shared/schema";

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockSearchResult;
}

export default function WatchlistModal({ isOpen, onClose, stock }: WatchlistModalProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
    enabled: isOpen,
  });

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
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      toast({
        title: "Added to Watchlist",
        description: `${stock.name} has been added to your watchlist.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add stock to watchlist.",
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

  const handleAddToWatchlist = (watchlistId: number) => {
    addToWatchlistMutation.mutate(watchlistId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Watchlist</DialogTitle>
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
            Adding <span className="font-medium text-foreground">{stock.name}</span> ({stock.symbol})
          </div>

          {!showCreateForm && (
            <>
              <div className="space-y-3">
                {watchlists?.map((watchlist) => (
                  <Button
                    key={watchlist.id}
                    variant="outline"
                    className="w-full justify-start text-left bg-background border-border hover:border-primary"
                    onClick={() => handleAddToWatchlist(watchlist.id)}
                    disabled={addToWatchlistMutation.isPending}
                  >
                    <div>
                      <div className="font-medium">{watchlist.name}</div>
                      <div className="text-sm text-muted-foreground">Click to add</div>
                    </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
