import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import SearchInput from "@/components/search-input";
import StockItem from "@/components/stock-item";
import { useDebounce } from "@/hooks/use-debounce";
import { StockSearchResult } from "@shared/schema";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 500);

  const { data: searchResults, isLoading } = useQuery<{ result: StockSearchResult[] }>({
    queryKey: [`/api/stocks/search?q=${debouncedQuery}`],
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="space-y-6">
        <Card className="bg-card">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Search Stocks</h2>
            
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search stocks by name or symbol (min 2 characters)..."
            />

            {isLoading && debouncedQuery.length >= 2 && (
              <div className="mt-4 text-center text-muted-foreground">
                Searching...
              </div>
            )}

            {searchResults && searchResults.result.length > 0 && (
              <div className="search-results space-y-2 mt-6">
                {searchResults.result.map((stock, index) => (
                  <StockItem key={`${stock.symbol}-${index}`} stock={stock} />
                ))}
              </div>
            )}

            {searchResults && searchResults.result.length === 0 && debouncedQuery.length >= 2 && (
              <div className="mt-6 text-center text-muted-foreground">
                No stocks found for "{debouncedQuery}"
              </div>
            )}

            {debouncedQuery.length < 2 && debouncedQuery.length > 0 && (
              <div className="mt-6 text-center text-muted-foreground">
                Type at least 2 characters to search
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
