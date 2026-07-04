import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AppSettings {
  marketDataProvider: "yahoo" | "finnhub" | "auto";
  finnhubAvailable: boolean;
}

const OPTIONS: { value: AppSettings["marketDataProvider"]; label: string; description: string }[] = [
  { value: "yahoo", label: "Yahoo Finance (default)", description: "Nessuna API key richiesta. Copre ricerca, quotazioni, profilo e grafici." },
  { value: "auto", label: "Auto", description: "Usa Yahoo come primario e Finnhub come fallback automatico (se disponibile)." },
  { value: "finnhub", label: "Finnhub", description: "Richiede FINNHUB_API_KEY configurata lato server. Yahoo resta come fallback." },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (marketDataProvider: AppSettings["marketDataProvider"]) => {
      const res = await apiRequest("PUT", "/api/settings", { marketDataProvider });
      return res.json() as Promise<AppSettings>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/settings"], updated);
      toast({ title: "Impostazioni salvate", description: `Provider dati: ${updated.marketDataProvider}.` });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare le impostazioni.", variant: "destructive" });
    },
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="space-y-6">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Provider dati di mercato</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-muted-foreground">Caricamento…</p>}

            {settings && (
              <>
                <RadioGroup
                  value={settings.marketDataProvider}
                  onValueChange={(v) => updateMutation.mutate(v as AppSettings["marketDataProvider"])}
                  className="space-y-3"
                >
                  {OPTIONS.map((opt) => {
                    const disabled = opt.value === "finnhub" && !settings.finnhubAvailable;
                    return (
                      <div
                        key={opt.value}
                        className="flex items-start space-x-3 rounded-md border border-border p-3"
                      >
                        <RadioGroupItem value={opt.value} id={`provider-${opt.value}`} disabled={disabled} className="mt-1" />
                        <div className="space-y-0.5">
                          <Label htmlFor={`provider-${opt.value}`} className="font-medium">
                            {opt.label}
                          </Label>
                          <p className="text-sm text-muted-foreground">{opt.description}</p>
                          {disabled && (
                            <p className="text-xs text-yellow-500">
                              Non disponibile: FINNHUB_API_KEY non configurata sul server.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>

                <p className="mt-4 text-xs text-muted-foreground">
                  Le chiavi API restano solo lato server e non vengono mai esposte al browser.
                  L'impostazione è globale (utente demo) e non persiste al riavvio del server.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
