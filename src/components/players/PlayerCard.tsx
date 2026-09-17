import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/constants";
import { ZaghettoIcon } from "@/components/ZaghettoIcon";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { useCrew } from "@/contexts/CrewContext";
export interface PlayerLite {
  id: string;
  full_name: string;
  photo_url: string | null;
  category: string;
  role: string;
  value_zaghetti: number;
}

const catColor: Record<string, string> = {
  U16: "bg-accent text-accent-foreground",
  U18: "bg-primary/15 text-primary",
  Seniores: "bg-primary text-primary-foreground",
};

export function PlayerCard({ player, selected, captain, talisman, silverback, captainMult = 2, talismanMult = 4, silverbackMult = 5, onClick, disabled, action, zaghettiDelta }: {
  player: PlayerLite;
  selected?: boolean;
  captain?: boolean;
  talisman?: boolean;
  silverback?: boolean;
  captainMult?: number;
  talismanMult?: number;
  silverbackMult?: number;
  onClick?: () => void;
  disabled?: boolean;
  action?: React.ReactNode;
  zaghettiDelta?: number | null;
}) {
  const { crewSlug } = useCrew();
  return (
    <Card
      onClick={disabled ? undefined : onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden border transition-all",
        onClick && !disabled && "cursor-pointer hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]",
        selected && "ring-2 ring-primary",
        captain && "ring-2 ring-[var(--warning)]",
        talisman && "ring-2 ring-fuchsia-500",
        silverback && "ring-2 ring-emerald-500",
        disabled && "opacity-50",
      )}
    >
      <div className="relative aspect-square bg-gradient-to-br from-secondary to-accent overflow-hidden">
        {player.photo_url ? (
          <img src={player.photo_url} alt={player.full_name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">🏉</div>
        )}
        {captain && (
          <div className="absolute top-2 left-2 rounded-full bg-[var(--warning)] px-2 py-0.5 text-xs font-bold text-background">
            CAPTAIN ×{captainMult}
          </div>
        )}
        {talisman && (
          <div className="absolute bottom-2 left-2 rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs font-bold text-white">
            TALISMANO ×{talismanMult}
          </div>
        )}
        {silverback && (
          <div className="absolute bottom-2 right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
            SILVERBACK ×{silverbackMult}
          </div>
        )}
        <Badge className={cn("absolute top-2 right-2 text-xs", catColor[player.category])}>
          {categoryLabel(player.category)}
        </Badge>
      </div>
      <div className="p-3">
        <Link
          to="/$crewSlug/player/$id"
          params={{ crewSlug, id: player.id }}
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-sm truncate inline-flex items-center gap-1 hover:text-primary"
        >
          {player.full_name}
          <ArrowUpRight className="h-3 w-3 shrink-0 opacity-60" />
        </Link>
        <div className="text-xs text-muted-foreground capitalize">{player.role}</div>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm font-bold text-primary inline-flex items-center gap-1">
            <ZaghettoIcon /> {player.value_zaghetti}
            {zaghettiDelta != null && zaghettiDelta !== 0 && (
              <span
                className={cn(
                  "ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
                  zaghettiDelta > 0 ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive",
                )}
              >
                {zaghettiDelta > 0 ? `+${zaghettiDelta}` : zaghettiDelta}
              </span>
            )}
          </div>
          {action && <div className="flex justify-end">{action}</div>}
        </div>
      </div>
    </Card>
  );
}