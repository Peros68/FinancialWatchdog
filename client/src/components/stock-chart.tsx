import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bell, Expand, TrendingUp, BarChart3 } from "lucide-react";
import { ChartData } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, CandlestickChart } from "recharts";
import { cn } from "@/lib/utils";
import AlertModal from "./alert-modal";

interface StockChartProps {
  symbol: string;
  currentPrice?: number;
}

const timeframes = [
  { label: "1D", value: "1D" },
  { label: "5D", value: "5D" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "ALL", value: "ALL" },
];

export default function StockChart({ symbol, currentPrice }: StockChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<"line" | "candlestick">("line");
  const [showAlertModal, setShowAlertModal] = useState(false);

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
      <div className="space-y-6">
        {/* Chart Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Timeframe Selector */}
          <div className="flex items-center space-x-2 overflow-x-auto">
            {timeframes.map((timeframe) => (
              <Button
                key={timeframe.value}
                variant={selectedTimeframe === timeframe.value ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "px-3 py-1 text-sm font-medium",
                  selectedTimeframe === timeframe.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSelectedTimeframe(timeframe.value)}
              >
                {timeframe.label}
              </Button>
            ))}
          </div>

          {/* Chart Type & Controls */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-background rounded-lg p-1">
              <Button
                variant={chartType === "line" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "px-3 py-1 text-sm",
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
                  "px-3 py-1 text-sm",
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
            
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setShowAlertModal(true)}
            >
              <Bell className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Expand className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chart */}
        <div className="chart-container h-96 relative">
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
              <LineChart data={chartDataFormatted}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  domain={['dataMin', 'dataMax']}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--foreground)'
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                />
                <Line 
                  type="monotone" 
                  dataKey="close" 
                  stroke="var(--primary)" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Current Price Line */}
          {currentPrice && (
            <div className="price-line" style={{ top: '50%' }}>
              <div className="absolute right-0 top-0 transform -translate-y-1/2 bg-primary text-primary-foreground px-2 py-1 text-xs font-semibold rounded-l">
                ${currentPrice.toFixed(2)}
              </div>
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
