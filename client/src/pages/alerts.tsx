import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AlertChart from '@/components/alert-chart';

interface Alert {
  ticker: string;
  nome: string;
  target: number;
  prezzo_attuale: number;
}

interface WatchlistItem {
  ticker: string;
}

// API calls to FastAPI backend
const fetchAlerts = async (): Promise<Alert[]> => {
  try {
    const response = await fetch('https://borsa-alert.onrender.com/alerts', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching alerts:', error);
    throw new Error('Impossibile connettersi al server degli alert. Verificare che il backend FastAPI sia attivo.');
  }
};

const fetchWatchlist = async (): Promise<WatchlistItem[]> => {
  try {
    const response = await fetch('https://borsa-alert.onrender.com/watchlist', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    throw new Error('Impossibile connettersi al server della watchlist.');
  }
};

const addToWatchlist = async (ticker: string): Promise<void> => {
  const response = await fetch('https://borsa-alert.onrender.com/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker })
  });
  if (!response.ok) throw new Error('Failed to add to watchlist');
};

const removeFromWatchlist = async (ticker: string): Promise<void> => {
  const response = await fetch('https://borsa-alert.onrender.com/watchlist', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker })
  });
  if (!response.ok) throw new Error('Failed to remove from watchlist');
};

export default function AlertsPage() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch alerts and watchlist
  const { data: alerts = [], isLoading: alertsLoading, error: alertsError } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
  });

  const { data: watchlist = [], error: watchlistError } = useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist,
  });

  // Mutations for watchlist operations
  const addMutation = useMutation({
    mutationFn: addToWatchlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast({ title: "Aggiunto alla watchlist", description: "Il titolo è stato salvato." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiungere alla watchlist.", variant: "destructive" });
    }
  });

  const removeMutation = useMutation({
    mutationFn: removeFromWatchlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast({ title: "Rimosso dalla watchlist", description: "Il titolo è stato rimosso." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile rimuovere dalla watchlist.", variant: "destructive" });
    }
  });

  // Calculate distance to target and sort alerts
  const sortedAlerts = alerts
    .map(alert => ({
      ...alert,
      distanza: alert.target - alert.prezzo_attuale,
      percentuale: ((alert.target - alert.prezzo_attuale) / alert.prezzo_attuale) * 100
    }))
    .sort((a, b) => Math.abs(a.distanza) - Math.abs(b.distanza));

  const isInWatchlist = (ticker: string) => {
    return watchlist.some(item => item.ticker === ticker);
  };

  const toggleWatchlist = (ticker: string) => {
    if (isInWatchlist(ticker)) {
      removeMutation.mutate(ticker);
    } else {
      addMutation.mutate(ticker);
    }
  };

  if (selectedTicker) {
    return (
      <div className="container mx-auto p-4">
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => setSelectedTicker(null)}
            className="mb-4"
          >
            ← Torna agli Alert
          </Button>
        </div>
        <AlertChart ticker={selectedTicker} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Alert Attivi</h1>
        <p className="text-gray-400">
          Titoli ordinati per prossimità al target di prezzo
        </p>
      </div>

      {alertsLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Caricamento alert...</span>
        </div>
      )}

      {alertsError && (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Errore di connessione
            </h3>
            <p className="text-muted-foreground mb-4">
              Impossibile connettersi al backend FastAPI. Verifica che il server sia attivo all'indirizzo:
            </p>
            <code className="bg-muted px-2 py-1 rounded text-sm">
              https://borsa-alert.onrender.com
            </code>
            <div className="mt-4">
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['alerts'] })}
                variant="outline"
              >
                Riprova
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!alertsLoading && !alertsError && sortedAlerts.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nessun alert attivo
            </h3>
            <p className="text-muted-foreground">
              Imposta degli alert sui tuoi titoli preferiti per monitorarli qui.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {sortedAlerts.map((alert) => (
          <Card 
            key={alert.ticker} 
            className="bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => setSelectedTicker(alert.ticker)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {alert.ticker}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlist(alert.ticker);
                        }}
                        disabled={addMutation.isPending || removeMutation.isPending}
                      >
                        <Star 
                          className={`w-4 h-4 ${
                            isInWatchlist(alert.ticker) 
                              ? 'fill-yellow-400 text-yellow-400' 
                              : 'text-muted-foreground'
                          }`} 
                        />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alert.nome}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Prezzo Attuale</p>
                    <p className="text-lg font-semibold text-foreground">
                      ${alert.prezzo_attuale.toFixed(2)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Target</p>
                    <p className="text-lg font-semibold text-foreground">
                      ${alert.target.toFixed(2)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Distanza</p>
                    <div className="flex items-center space-x-1">
                      {alert.distanza > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-lg font-semibold ${
                        alert.distanza > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        ${Math.abs(alert.distanza).toFixed(2)}
                      </span>
                    </div>
                    <p className={`text-xs ${
                      alert.distanza > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      ({alert.percentuale > 0 ? '+' : ''}{alert.percentuale.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}