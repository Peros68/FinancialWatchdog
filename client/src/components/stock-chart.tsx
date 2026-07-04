import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Bell, TrendingUp, BarChart3, ChevronDown } from "lucide-react";
import { ChartData } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart } from "recharts";
import { cn } from "@/lib/utils";
import AlertModal from "./alert-modal";

interface StockChartProps {
  symbol: string;
  currentPrice?: number;
}

const quickTimeframes = [
  { label: "1m", value: "1m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "D", value: "1D" },
  { label: "W", value: "1W" },
  { label: "M", value: "1M" },
];

const allTimeframes = [
  { label: "1 Minute", value: "1m" },
  { label: "5 Minutes", value: "5m" },
  { label: "15 Minutes", value: "15m" },
  { label: "30 Minutes", value: "30m" },
  { label: "1 Hour", value: "1h" },
  { label: "4 Hours", value: "4h" },
  { label: "Daily", value: "1D" },
  { label: "Weekly", value: "1W" },
  { label: "Monthly", value: "1M" },
];

export default function StockChart({ symbol, currentPrice }: StockChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<"line" | "candlestick">("line");
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showVolume, setShowVolume] = useState(true);

  const { data: chartData, isLoading } = useQuery({
    queryKey: [`/api/yahoo/chart/${symbol}`, selectedTimeframe],
    queryFn: async () => {
      // Map timeframes to Yahoo Finance parameters
      const getYahooParams = (timeframe: string) => {
        switch (timeframe) {
          case '1m': return { interval: '1m', range: '1d' };
          case '5m': return { interval: '5m', range: '1d' };
          case '15m': return { interval: '15m', range: '5d' };
          case '30m': return { interval: '30m', range: '5d' };
          case '1h': return { interval: '1h', range: '5d' };
          case '4h': return { interval: '1h', range: '1mo' };
          case '1D': return { interval: '1d', range: '1mo' };
          case '1W': return { interval: '1wk', range: '3mo' };
          case '1M': return { interval: '1mo', range: '1y' };
          default: return { interval: '1d', range: '1mo' };
        }
      };

      const { interval, range } = getYahooParams(selectedTimeframe);
      const response = await fetch(`/api/yahoo/chart/${symbol}?interval=${interval}&range=${range}`);
      if (!response.ok) throw new Error('Failed to fetch chart data');
      const data = await response.json();

      const result = data.chart?.result?.[0];
      if (!result?.timestamp || !result?.indicators?.quote?.[0]?.close) {
        throw new Error('Invalid chart data format');
      }

      const timestamps = result.timestamp;
      const closes = result.indicators.quote[0].close;
      const opens = result.indicators.quote[0].open;
      const highs = result.indicators.quote[0].high;
      const lows = result.indicators.quote[0].low;
      const volumes = result.indicators.quote[0].volume;

      return {
        data: timestamps.map((timestamp: number, index: number) => ({
          timestamp: timestamp * 1000,
          open: opens[index] || 0,
          high: highs[index] || 0,
          low: lows[index] || 0,
          close: closes[index] || 0,
          volume: volumes[index] || 0
        })).filter((item: any) => item.close > 0)
      };
    },
    enabled: !!symbol,
  });

  const formatChartData = (data: ChartData[]) => {
    return data.map(item => ({
      ...item,
      date: new Date(item.timestamp).toLocaleDateString(),
      time: new Date(item.timestamp).toLocaleTimeString(),
    }));
  };

  const chartDataFormatted = chartData ? formatChartData(chartData.data) : [];

  return (
    <>
      <div className="space-y-4">
        {/* Chart Toolbar */}
        <div className="bg-card border border-border rounded-lg p-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Timeframes */}
            <div className="flex items-center space-x-2">
              {quickTimeframes.map((timeframe) => (
                <Button
                  key={timeframe.value}
                  variant={selectedTimeframe === timeframe.value ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-sm font-medium",
                    selectedTimeframe === timeframe.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setSelectedTimeframe(timeframe.value)}
                >
                  {timeframe.label}
                </Button>
              ))}

              {/* More Timeframes Dropdown */}
              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger className="h-8 w-12 bg-background border-border text-muted-foreground">
                  <ChevronDown className="w-4 h-4" />
                </SelectTrigger>
                <SelectContent>
                  {allTimeframes.map((timeframe) => (
                    <SelectItem key={timeframe.value} value={timeframe.value}>
                      {timeframe.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right Side - Chart Type, Volume, Alert */}
            <div className="flex items-center space-x-2">
              {/* Chart Type Toggle */}
              <div className="flex items-center bg-background rounded border border-border">
                <Button
                  variant={chartType === "line" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-sm border-0 rounded-r-none",
                    chartType === "line"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setChartType("line")}
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Line
                </Button>
                <Button
                  variant={chartType === "candlestick" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-sm border-0 rounded-l-none",
                    chartType === "candlestick"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setChartType("candlestick")}
                >
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Candles
                </Button>
              </div>

              {/* Volume Toggle */}
              <Button
                variant={showVolume ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 px-3 text-sm",
                  showVolume
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setShowVolume((v) => !v)}
              >
                Volume
              </Button>

              {/* Alert Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                onClick={() => setShowAlertModal(true)}
                aria-label="Crea alert di prezzo"
              >
                <Bell className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Chart */}
        <div className="chart-container relative">
          <div className="h-80 relative">
            {isLoading && (
              <div className="w-full h-full bg-gradient-to-br from-muted to-background flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                  <p className="text-lg">Loading chart...</p>
                </div>
              </div>
            )}

            {!isLoading && chartDataFormatted.length === 0 && (
              <div className="w-full h-full bg-gradient-to-br from-muted to-background flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-lg">No chart data available</p>
                  <p className="text-sm">Try a different timeframe</p>
                </div>
              </div>
            )}

            {!isLoading && chartDataFormatted.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <LineChart data={chartDataFormatted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      domain={['dataMin - 1', 'dataMax + 1']}
                      axisLine={false}
                      orientation="right"
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                      cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                    />
                    <Line
                      type="linear"
                      dataKey="close"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                ) : (
                  <ComposedChart data={chartDataFormatted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      domain={['dataMin - 1', 'dataMax + 1']}
                      axisLine={false}
                      orientation="right"
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--foreground)'
                      }}
                      formatter={(value: number, name: string) => {
                        return [`$${value.toFixed(2)}`, name === 'open' ? 'Open' : name === 'high' ? 'High' : name === 'low' ? 'Low' : 'Close'];
                      }}
                      cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                    />
                    {/* High-Low wicks */}
                    <Line
                      type="linear"
                      dataKey="high"
                      stroke="var(--muted-foreground)"
                      strokeWidth={1}
                      dot={false}
                      connectNulls={false}
                    />
                    <Line
                      type="linear"
                      dataKey="low"
                      stroke="var(--muted-foreground)"
                      strokeWidth={1}
                      dot={false}
                      connectNulls={false}
                    />
                    {/* OHLC close as simplified bars */}
                    <Bar
                      dataKey="close"
                      fill="var(--primary)"
                      radius={[1, 1, 1, 1]}
                    />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            )}

            {/* Current Price Line */}
            {currentPrice && !isLoading && chartDataFormatted.length > 0 && (
              <div className="price-line" style={{ top: '50%' }}>
                <div className="absolute right-0 top-0 transform -translate-y-1/2 bg-primary text-primary-foreground px-2 py-1 text-xs font-semibold rounded-l">
                  ${currentPrice.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Volume Indicator */}
          {showVolume && !isLoading && chartDataFormatted.length > 0 && (
            <div className="h-24 border-t border-border">
              <div className="flex items-center px-2 py-1 bg-muted">
                <span className="text-xs font-medium text-foreground">Volume</span>
              </div>
              <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                <BarChart data={chartDataFormatted}>
                  <XAxis
                    dataKey="date"
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    orientation="right"
                    axisLine={false}
                  />
                  <Bar
                    dataKey="volume"
                    fill="var(--muted-foreground)"
                    opacity={0.6}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        symbol={symbol}
        currentPrice={currentPrice}
      />
    </>
  );
}
