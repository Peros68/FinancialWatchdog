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
import { Plus, Trash2, Star } from "lucide-react";
import { Link } from "wouter";
import { Watchlist, WatchlistItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function WatchlistPage() {
  const [activeWatchlist, setActiveWatchlist] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: watchlists } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlists"],
  });

  const { data: watchlistItems } = useQuery<WatchlistItem[]>({
    queryKey: [`/api/watchlists/${activeWatchlist}/items`],
    enabled: activeWatchlist !== null,
  });

  // Set first watchlist as active by default (in an effect, not during render)
  useEffect(() => {
    if (watchlists && watchlists.length > 0 && activeWatchlist === null) {
      setActiveWatchlist(watchlists[0].id);
    }
  }, [watchlists, activeWatchlist]);

  const activeWatchlistData = watchlists?.find(wl => wl.id === activeWatchlist);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/watchlists", { name });
      return res.json() as Promise<Watchlist>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      setShowCreate(false);
      setNewName("");
      setActiveWatchlist(created.id);
      toast({ title: "Watchlist creata", description: `"${created.name}" è stata creata.` });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la watchlist.", variant: "destructive" });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/watchlists/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${activeWatchlist}/items`] });
      toast({ title: "Rimosso", description: "Titolo rimosso dalla watchlist." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile rimuovere il titolo.", variant: "destructive" });
    },
  });

  const deleteWatchlistMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/watchlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
      setActiveWatchlist(null); // effect re-selects the first remaining watchlist
      toast({ title: "Watchlist eliminata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare la watchlist.", variant: "destructive" });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (name) createMutation.mutate(name);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="space-y-6">
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">My Watchlists</h2>
              <div className="flex items-center gap-2">
                {activeWatchlistData && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="text-muted-foreground hover:text-red-500"
                        disabled={deleteWatchlistMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Elimina
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminare "{activeWatchlistData.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          La watchlist e tutti i titoli che contiene saranno eliminati. L'azione non è reversibile.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteWatchlistMutation.mutate(activeWatchlistData.id)}
                        >
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Watchlist
                </Button>
              </div>
            </div>

            {/* Watchlist Tabs */}
            {watchlists && watchlists.length > 0 && (
              <div className="flex space-x-4 mb-6 overflow-x-auto">
                {watchlists.map((watchlist) => (
                  <Button
                    key={watchlist.id}
                    variant={activeWatchlist === watchlist.id ? "default" : "ghost"}
                    className={cn(
                      "whitespace-nowrap",
                      activeWatchlist === watchlist.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveWatchlist(watchlist.id)}
                  >
                    {watchlist.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Watchlist Items */}
            {watchlistItems && watchlistItems.length > 0 && (
              <div className="space-y-3">
                {watchlistItems.map((item) => (
                  <WatchlistItemCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeItemMutation.mutate(item.id)}
                    removing={removeItemMutation.isPending}
                  />
                ))}
              </div>
            )}

            {watchlistItems && watchlistItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No stocks in {activeWatchlistData?.name || "this watchlist"}
              </div>
            )}

            {(!watchlists || watchlists.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No watchlists found</p>
                <p className="text-sm mt-2">Create your first watchlist to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create watchlist dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova Watchlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-watchlist-name">Nome</Label>
              <Input
                id="new-watchlist-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Es. Tech USA, Energia, Preferiti"
                className="bg-background border-border"
                required
                autoFocus
              />
            </div>
            <div className="flex space-x-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                Annulla
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={createMutation.isPending || !newName.trim()}
              >
                {createMutation.isPending ? "Creazione..." : "Crea"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function WatchlistItemCard({
  item,
  onRemove,
  removing,
}: {
  item: WatchlistItem;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <Card className="bg-background border-border hover:border-muted-foreground transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Link href={`/stock/${item.symbol}`} className="flex items-center space-x-3 cursor-pointer flex-1">
            <div>
              <h3 className="font-semibold text-foreground">{item.name}</h3>
              <p className="text-sm text-muted-foreground">{item.symbol} • {item.exchange}</p>
            </div>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            className="ml-4"
            onClick={onRemove}
            disabled={removing}
            aria-label={`Rimuovi ${item.symbol} dalla watchlist`}
          >
            {/* Item è sempre presente in questa lista: stella piena/gialla, coerente con lo
                stato "presente" usato in WatchlistModal e Search Stocks. Click = rimuovi. */}
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
