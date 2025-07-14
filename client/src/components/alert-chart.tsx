import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';

interface ChartData {
  date: string;
  price: number;
  timestamp: number;
}

interface AlertInfo {
  symbol: string;
  price: number;
  target: number;
}

interface AlertChartProps {
  ticker: string;
}

// Fetch chart data from backend or Yahoo Finance API
const fetchChartData = async (ticker: string): Promise<ChartData[]> => {
  try {
    // Try backend first
    const response = await fetch(`https://borsa-alert.onrender.com/grafico?ticker=${ticker}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // Transform data if needed - expecting array of price points
      if (Array.isArray(data)) {
        return data.map((item: any, index: number) => ({
          date: new Date(Date.now() - (29 - index) * 24 * 60 * 60 * 1000).toLocaleDateString(),
          price: typeof item === 'number' ? item : item.price || item.close,
          timestamp: Date.now() - (29 - index) * 24 * 60 * 60 * 1000
        }));
      }
    }
  } catch (error) {
    console.warn('Backend unavailable, trying Yahoo Finance API...');
  }

  // Fallback to Yahoo Finance API via proxy
  try {
    const yahooResponse = await fetch(`/api/yahoo/chart/${ticker}`);
    if (!yahooResponse.ok) throw new Error('Yahoo Finance proxy failed');
    
    const yahooData = await yahooResponse.json();
    const result = yahooData.chart?.result?.[0];
    
    if (result?.timestamp && result?.indicators?.quote?.[0]?.close) {
      const timestamps = result.timestamp;
      const closes = result.indicators.quote[0].close;
      
      return timestamps.map((timestamp: number, index: number) => ({
        date: new Date(timestamp * 1000).toLocaleDateString(),
        price: closes[index] || 0,
        timestamp: timestamp * 1000
      })).filter((item: ChartData) => item.price > 0).slice(-30); // Last 30 data points
    }
  } catch (error) {
    console.error('Yahoo Finance API also failed:', error);
  }
  
  throw new Error('Impossibile ottenere i dati del grafico da entrambe le fonti');
};

// Fetch alert info
const fetchAlertInfo = async (ticker: string): Promise<AlertInfo | null> => {
  try {
    const response = await fetch('https://borsa-alert.onrender.com/alerts');
    if (!response.ok) return null;
    const alerts = await response.json();
    return alerts.find((alert: AlertInfo) => alert.symbol === ticker) || null;
  } catch (error) {
    console.warn('Backend unavailable for alert info');
    return null;
  }
};

export default function AlertChart({ ticker }: AlertChartProps) {
  const { data: chartData = [], isLoading: chartLoading, error: chartError } = useQuery({
    queryKey: ['chart', ticker],
    queryFn: () => fetchChartData(ticker),
    enabled: !!ticker,
  });

  const { data: alertInfo } = useQuery({
    queryKey: ['alert-info', ticker],
    queryFn: () => fetchAlertInfo(ticker),
    enabled: !!ticker,
  });

  if (chartLoading) {
    return (
      <div className="w-full">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Caricamento grafico {ticker}...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (chartError || chartData.length === 0) {
    return (
      <div className="w-full">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <TrendingDown className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Dati non disponibili
            </h3>
            <p className="text-muted-foreground">
              Impossibile caricare i dati del grafico per {ticker}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPrice = alertInfo?.price || chartData[chartData.length - 1]?.price || 0;
  const targetPrice = alertInfo?.target || 0;
  const priceChange = chartData.length > 1 ? currentPrice - chartData[0].price : 0;
  const priceChangePercent = chartData.length > 1 ? (priceChange / chartData[0].price) * 100 : 0;

  const minPrice = Math.min(...chartData.map(d => d.price), targetPrice);
  const maxPrice = Math.max(...chartData.map(d => d.price), targetPrice);
  const padding = (maxPrice - minPrice) * 0.1;

  return (
    <div className="w-full space-y-4">
      {/* Header with stock info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-foreground">
                {ticker}
              </CardTitle>
              <p className="text-muted-foreground">{ticker} Stock</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-foreground">
                ${currentPrice.toFixed(2)}
              </p>
              <div className="flex items-center space-x-2">
                {priceChange !== 0 && (
                  <>
                    {priceChange > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      priceChange > 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)} ({priceChangePercent > 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Alert target info */}
      {alertInfo && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <p className="text-sm text-muted-foreground">Target di Prezzo</p>
                  <p className="text-xl font-semibold text-foreground">
                    ${targetPrice.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Distanza dal Target</p>
                  <div className="flex items-center space-x-1">
                    <span className={`text-lg font-semibold ${
                      targetPrice > currentPrice ? 'text-green-500' : 'text-red-500'
                    }`}>
                      ${Math.abs(targetPrice - currentPrice).toFixed(2)}
                    </span>
                    <Badge variant={targetPrice > currentPrice ? 'default' : 'destructive'}>
                      {targetPrice > currentPrice ? 'Sotto target' : 'Sopra target'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">
            Andamento Ultimi 30 Giorni
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  domain={[minPrice - padding, maxPrice + padding]}
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)'
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Prezzo']}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="var(--primary)" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--primary)' }}
                />
                {/* Target price line */}
                {targetPrice > 0 && (
                  <ReferenceLine 
                    y={targetPrice} 
                    stroke="var(--chart-2)" 
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ 
                      value: `Target: $${targetPrice.toFixed(2)}`, 
                      position: 'topRight',
                      fill: 'var(--chart-2)'
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}