import { Link, useLocation } from "@tanstack/react-router";
import { Home, Users, Shield, Swords, Zap, User, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCrew } from "@/contexts/CrewContext";

const items = [
  { to: "/$crewSlug/dashboard", label: "Dashboard", icon: Home, exact: true },
  { to: "/$crewSlug/players", label: "Giocatori", icon: Users, exact: false },
  { to: "/$crewSlug/team", label: "Squadra", icon: Shield, exact: false },
  { to: "/$crewSlug/azioni", label: "Azioni", icon: Zap, exact: false },
  { to: "/$crewSlug/leaderboard", label: "Clash Center", icon: Swords, exact: false },
  { to: "/$crewSlug/black-market", label: "Market", icon: ShoppingBag, exact: false },
  { to: "/$crewSlug/profile", label: "Profilo", icon: User, exact: false },
] as const;

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { crewSlug } = useCrew();
  if (!user) return null;
  return (
    <nav
      aria-label="Navigazione"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {items.map((it) => {
          const Icon = it.icon;
          const resolved = it.to.replace("$crewSlug", crewSlug);
          const active = it.exact ? pathname === resolved : pathname === resolved || pathname.startsWith(resolved + "/");
          return (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to}
                params={{ crewSlug }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[48px] py-2 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
