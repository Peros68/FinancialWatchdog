import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}`;
}

export function formatPercentChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  }
  if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  }
  if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  }
  return `$${marketCap.toFixed(0)}`;
}

export function getTimeframeTimestamp(timeframe: string): { from: number; resolution: string } {
  const now = Math.floor(Date.now() / 1000);
  
  switch (timeframe) {
    case "1D":
      return { from: now - 86400, resolution: "5" };
    case "5D":
      return { from: now - 432000, resolution: "15" };
    case "1M":
      return { from: now - 2592000, resolution: "60" };
    case "3M":
      return { from: now - 7776000, resolution: "D" };
    case "6M":
      return { from: now - 15552000, resolution: "D" };
    case "1Y":
      return { from: now - 31536000, resolution: "D" };
    case "5Y":
      return { from: now - 157680000, resolution: "W" };
    default:
      return { from: now - 86400, resolution: "5" };
  }
}

export function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(2)}B`;
  }
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(2)}M`;
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(2)}K`;
  }
  return volume.toString();
}
