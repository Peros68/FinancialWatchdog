import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navigation from "@/components/navigation";
import SearchPage from "@/pages/search";
import StockDetailPage from "@/pages/stock-detail";
import WatchlistPage from "@/pages/watchlist";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <Switch>
        <Route path="/" component={SearchPage} />
        <Route path="/stock/:symbol" component={StockDetailPage} />
        <Route path="/watchlist" component={WatchlistPage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
