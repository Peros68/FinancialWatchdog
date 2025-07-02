import { Link, useLocation } from "wouter";
import { Search, Star, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { icon: Search, label: "Search", href: "/", active: location === "/" },
    { icon: Star, label: "Watchlists", href: "/watchlist", active: location === "/watchlist" },
    { icon: Bell, label: "Alerts", href: "/alerts", active: location === "/alerts" },
  ];

  return (
    <header className="bg-card border-b border-border px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <h1 className="text-xl font-bold text-primary cursor-pointer">FinAlert</h1>
          </Link>
          <nav className="hidden md:flex space-x-6">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "text-muted-foreground hover:text-primary transition-colors",
                    item.active && "text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
        <Button variant="ghost" size="sm" className="md:hidden text-foreground">
          <Menu className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
