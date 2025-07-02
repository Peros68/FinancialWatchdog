import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          className="w-full bg-background border-border rounded-lg py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
        API: Finnhub
      </div>
    </div>
  );
}
