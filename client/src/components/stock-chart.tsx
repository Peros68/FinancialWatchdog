import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Bell, 
  Expand, 
  TrendingUp, 
  BarChart3, 
  Edit3, 
  Crosshair, 
  ChevronDown,
  Settings,
  Save
} from "lucide-react";
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

const indicators = [
  { label: "Volume", value: "volume" },
  { label: "RSI", value: "rsi" },
  { label: "MACD", value: "macd" },
  { label: "Moving Average (20)", value: "ma20" },
  { label: "Moving Average (50)", value: "ma50" },
  { label: "Bollinger Bands", value: "bb" },
];

export default function StockChart({ symbol, currentPrice }: StockChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<"line" | "candlestick">("line");
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [drawingMode, setDrawingMode] = useState<"none" | "pen" | "crosshair">("none");
  const [activeIndicators, setActiveIndicators] = useState<string[]>(["volume"]);
  const [crosshairActive, setCrosshairActive] = useState(false);

  const { data: chartData, isLoading } = useQuery<{ data: ChartData[] }>({
    queryKey: [`/api/stocks/chart/${symbol}?timeframe=${selectedTimeframe}`],
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
        {/* Advanced Chart Toolbar */}
        <div className="bg-card border border-border rounded-lg p-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Left Side - Drawing Tools */}
            <div className="flex items-center space-x-2">
              {/* Drawing Pen */}
              <Button
                variant={drawingMode === "pen" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  drawingMode === "pen" 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setDrawingMode(drawingMode === "pen" ? "none" : "pen")}
              >
                <Edit3 className="w-4 h-4" />
              </Button>

              {/* Crosshair Tool */}
              <Button
                variant={crosshairActive ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 relative",
                  crosshairActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setCrosshairActive(!crosshairActive)}
              >
                <Crosshair className="w-4 h-4" />
                {crosshairActive && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-primary"></div>
                )}
              </Button>
            </div>

            {/* Center - Quick Timeframes & Dropdown */}
            <div className="flex items-center space-x-2">
              {/* Quick Timeframes */}
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

            {/* Right Side - Chart Types & Tools */}
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

              {/* Alert Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                onClick={() => setShowAlertModal(true)}
              >
                <Bell className="w-4 h-4" />
              </Button>

              {/* Indicators Dropdown */}
              <Select value="" onValueChange={(value) => {
                if (value && !activeIndicators.includes(value)) {
                  setActiveIndicators([...activeIndicators, value]);
                }
              }}>
                <SelectTrigger className="h-8 w-24 bg-background border-border text-muted-foreground text-sm">
                  <span>Indicatori</span>
                  <ChevronDown className="w-3 h-3 ml-1" />
                </SelectTrigger>
                <SelectContent>
                  {indicators.map((indicator) => (
                    <SelectItem 
                      key={indicator.value} 
                      value={indicator.value}
                      disabled={activeIndicators.includes(indicator.value)}
                    >
                      {indicator.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Save Settings */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <Save className="w-4 h-4" />
              </Button>

              {/* Fullscreen */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <Expand className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Active Indicators Bar */}
          {activeIndicators.length > 0 && (
            <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">Active:</span>
              {activeIndicators.map((indicator) => (
                <div key={indicator} className="flex items-center bg-muted rounded px-2 py-1">
                  <span className="text-xs text-foreground">
                    {indicators.find(i => i.value === indicator)?.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setActiveIndicators(activeIndicators.filter(i => i !== indicator))}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Chart */}
        <div className="chart-container relative">
          {/* Primary Chart Area */}
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
                      domain={['dataMin', 'dataMax']}
                      axisLine={false}
                      orientation="right"
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
                      type="monotone" 
                      dataKey="close" 
                      stroke="var(--primary)" 
                      strokeWidth={2}
                      dot={false}
                    />
                    {/* Moving Average 20 */}
                    {activeIndicators.includes('ma20') && (
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="var(--chart-1)" 
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    )}
                    {/* Moving Average 50 */}
                    {activeIndicators.includes('ma50') && (
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="var(--chart-2)" 
                        strokeWidth={1}
                        strokeDasharray="10 5"
                        dot={false}
                      />
                    )}
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
                      domain={['dataMin', 'dataMax']}
                      axisLine={false}
                      orientation="right"
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
                    {/* Candlestick bars using composed chart */}
                    <Bar dataKey="close" fill="var(--gain)" />
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

            {/* Crosshair overlay */}
            {crosshairActive && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 cursor-crosshair"></div>
              </div>
            )}
          </div>

          {/* RSI Indicator */}
          {activeIndicators.includes('rsi') && !isLoading && chartDataFormatted.length > 0 && (
            <div className="h-20 border-t border-border">
              <div className="flex items-center px-2 py-1 bg-muted">
                <span className="text-xs font-medium text-foreground">RSI</span>
              </div>
              <ResponsiveContainer width="100%" height="calc(100% - 28px)">
                <LineChart data={chartDataFormatted}>
                  <YAxis 
                    domain={[0, 100]} 
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    orientation="right"
                    axisLine={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="close" 
                    stroke="var(--chart-4)" 
                    strokeWidth={1}
                    dot={false}
                  />
                  {/* RSI overbought/oversold lines */}
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Volume Indicator */}
          {activeIndicators.includes('volume') && !isLoading && chartDataFormatted.length > 0 && (
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
