import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import AlertChart from '@/components/alert-chart';
import { fetchLocalAlerts, isAlertTriggered } from '@/lib/alertsApi';
import { cn } from '@/lib/utils';

// Simple beep via the Web Audio API (no extra dependency). Best-effort: some
// browsers require a prior user interaction before audio can play.
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    // ignore audio errors (autoplay policy, unsupported browser, etc.)
  }
}

export default function AlertsPage() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  // Alerts come from the LOCAL backend (/api/alerts). The same query key is
  // invalidated by AlertModal on creation, so new alerts appear here immediately.
  const { data: alerts = [], isLoading: alertsLoading, error: alertsError, refetch } = useQuery({
    queryKey: ['/api/alerts'],
    queryFn: fetchLocalAlerts,
    refetchInterval: 30000, // v1 active monitoring: re-poll quotes every 30s
  });

  // Calculate distance to target and sort alerts (price may be unavailable -> null)
  const sortedAlerts = alerts
    .map(alert => {
      const distanza = alert.price != null ? alert.target - alert.price : null;
      const percentuale =
        alert.price != null && alert.price !== 0
          ? ((alert.target - alert.price) / alert.price) * 100
          : null;
      return { ...alert, distanza, percentuale, triggered: isAlertTriggered(alert) };
    })
    .sort((a, b) => {
      if (a.distanza == null) return 1;
      if (b.distanza == null) return -1;
      return Math.abs(a.distanza) - Math.abs(b.distanza);
    });

  // Active monitoring (v1): play a beep once when an alert newly reaches its target.
  const triggeredSymbols = sortedAlerts.filter(a => a.triggered).map(a => a.symbol);
  const triggeredKey = triggeredSymbols.join('|');
  const prevTriggeredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const prev = prevTriggeredRef.current;
    const hasNew = triggeredSymbols.some(s => !prev.has(s));
    if (hasNew) playBeep();
    prevTriggeredRef.current = new Set(triggeredSymbols);
  }, [triggeredKey]);

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
              Errore nel caricamento degli alert
            </h3>
            <p className="text-muted-foreground mb-4">
              Impossibile caricare gli alert dal backend locale. Riprova.
            </p>
            <div className="mt-4">
              <Button onClick={() => refetch()} variant="outline">
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
            key={alert.symbol}
            className={cn(
              "bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer",
              alert.triggered && "border-green-500 ring-1 ring-green-500"
            )}
            onClick={() => setSelectedTicker(alert.symbol)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {alert.symbol}
                      </h3>
                      {alert.triggered && (
                        <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded">
                          🎯 Target raggiunto
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alert.symbol} Stock
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Prezzo Attuale</p>
                    <p className="text-lg font-semibold text-foreground">
                      {alert.price != null ? `$${alert.price.toFixed(2)}` : '—'}
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
                    {alert.distanza != null ? (
                      <>
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
                        {alert.percentuale != null && (
                          <p className={`text-xs ${
                            alert.distanza > 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            ({alert.percentuale > 0 ? '+' : ''}{alert.percentuale.toFixed(1)}%)
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-lg font-semibold text-muted-foreground">—</p>
                    )}
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
