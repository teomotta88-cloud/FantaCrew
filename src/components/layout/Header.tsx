import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Swords, User as UserIcon, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoFallback from "@/assets/lambro-logo.png";
import { useCrew } from "@/contexts/CrewContext";
export function Header() {
  const { crewSlug, crew } = useCrew();
  const { user, isAdmin, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = (profile?.display_name || user?.email || "?").slice(0, 2).toUpperCase();
  const clubLogo = crew?.logo_url || logoFallback;
  const clubName = crew?.name || "Lambro";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {user ? (
          <Link to="/$crewSlug/dashboard" params={{ crewSlug }} className="flex items-center gap-2">
            <img src={clubLogo} alt={clubName} className="h-9 w-9 object-contain rounded" />
            <div className="font-bold text-lg tracking-tight">
              Fanta <span className="text-primary">{clubName}</span>
            </div>
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2">
            <img src={clubLogo} alt={clubName} className="h-9 w-9 object-contain rounded" />
            <div className="font-bold text-lg tracking-tight">
              Fanta <span className="text-primary">{clubName}</span>
            </div>
          </Link>
        )}
        <nav className="hidden md:flex items-center gap-1">
          <Link to="/$crewSlug/players" params={{ crewSlug }} className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors">
            Giocatori
          </Link>
          <Link to="/$crewSlug/team" params={{ crewSlug }} className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors">
            La mia squadra
          </Link>
          <Link to="/$crewSlug/weekly" params={{ crewSlug }} className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors">
            Punteggi settimanali
          </Link>
          <Link
            to="/$crewSlug/azioni" params={{ crewSlug }}
            className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
          >
            <Zap className="h-4 w-4" /> Azioni
          </Link>
          <Link
            to="/$crewSlug/leaderboard" params={{ crewSlug }}
            className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
          >
            <Swords className="h-4 w-4" /> Clash Center
          </Link>
          <Link
            to="/$crewSlug/black-market" params={{ crewSlug }}
            className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-md bg-foreground/5 hover:bg-foreground/10"
          >
            Black Market 🖤
          </Link>
          {isAdmin && (
            <Link
              to="/$crewSlug/admin" params={{ crewSlug }}
              className="px-3 py-2 text-sm font-medium text-primary hover:text-primary-foreground hover:bg-primary rounded-md transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {user && isAdmin && (
            <Link
              to="/$crewSlug/admin" params={{ crewSlug }}
              className="md:hidden inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              Admin
            </Link>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                  <Avatar className="h-9 w-9">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.display_name} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium truncate">{profile?.display_name || "Manager"}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/$crewSlug/profile", params: { crewSlug }})}>
                  <UserIcon className="mr-2 h-4 w-4" /> Profilo
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/login" })}>
              Accedi
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
