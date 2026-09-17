import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type PlayerLite } from "@/components/players/PlayerCard";
import { useTeamConfig } from "@/hooks/useTeamConfig";
import { ArrowLeft, ArrowDown, ArrowUp, Megaphone, Trophy } from "lucide-react";
import { computeTeamBreakdown } from "@/lib/scoring";
import { cn } from "@/lib/utils";

import { useCrew } from "@/contexts/CrewContext";
export const Route = createFileRoute("/$crewSlug/championship/$teamId")({
  component: TeamDetailPage,
  head: () => ({ meta: [{ title: "Squadra — Fanta Lambro" }] }),
});

type Team = { id: string; name: string; manager_id: string; captain_player_id: string | null; talisman_player_id: string | null; silverback_player_id: string | null };
type Coach = { id: string; full_name: string; photo_url: string | null; category: string };
type PlayerRow = PlayerLite & {
  points: number;
  last_week_points: number;
  joined_at: string;
  left_at: string | null;
  multiplier: number;
};

function TeamDetailPage() {
  const { crewSlug } = useCrew();
  const { teamId } = Route.useParams();
  const { config } = useTeamConfig();
  const { captain: mCap, talisman: mTal, silverback: mSil } = config.multipliers;
  const [team, setTeam] = useState<Team | null>(null);
  const [manager, setManager] = useState<string>("");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [coaches, setCoaches] = useState<(Coach & { points: number })[]>([]);
  const [total, setTotal] = useState(0);
  const [sortKey, setSortKey] = useState<"last_week" | "all_time">("all_time");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("teams").select("id,name,manager_id,captain_player_id,talisman_player_id,silverback_player_id").eq("id", teamId).maybeSingle();
      if (!t) return;
      setTeam(t as Team);
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", t.manager_id).maybeSingle();
      setManager(prof?.display_name || "—");

      const breakdown = await computeTeamBreakdown(teamId);
      const { data: tc } = await supabase.from("team_coaches").select("coach_id").eq("team_id", teamId);
      const cids = (tc || []).map((r: any) => r.coach_id);
      const allPids = (breakdown?.contributions || []).map((c) => c.player_id);
      const [{ data: pData }, { data: cData }, { data: cScores }] = await Promise.all([
        allPids.length ? supabase.from("players").select("id,full_name,photo_url,category,role,value_zaghetti").in("id", allPids) : Promise.resolve({ data: [] as any }),
        cids.length ? supabase.from("coaches").select("id,full_name,photo_url,category").in("id", cids) : Promise.resolve({ data: [] as any }),
        cids.length ? supabase.from("coach_scores").select("coach_id,total_points").in("coach_id", cids) : Promise.resolve({ data: [] as any }),
      ]);
      const pMap = new Map(((pData as PlayerLite[]) || []).map((p) => [p.id, p]));
      const cMap = new Map<string, number>(((cScores as any[]) || []).map((s) => [s.coach_id, s.total_points || 0]));
      const ps = (breakdown?.contributions || [])
        .map((c) => {
          const p = pMap.get(c.player_id);
          if (!p) return null;
          return { ...p, points: c.contributed, last_week_points: c.last_week_points, joined_at: c.joined_at, left_at: c.left_at, multiplier: c.multiplier };
        })
        .filter((x): x is PlayerRow => !!x);
      setPlayers(ps);
      setCoaches(((cData as Coach[]) || []).map((c) => ({ ...c, points: cMap.get(c.id) || 0 })));
      setTotal(breakdown?.total || 0);
    })();
  }, [teamId, mCap, mTal, mSil]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const va = sortKey === "last_week" ? a.last_week_points : a.points;
      const vb = sortKey === "last_week" ? b.last_week_points : b.points;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [players, sortKey, sortDir]);

  const toggleSort = (key: "last_week" | "all_time") => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (!team) return <PageShell><p className="text-muted-foreground">Caricamento…</p></PageShell>;

  return (
    <PageShell>
      <Link to="/$crewSlug/championship" params={{ crewSlug }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Torna al campionato
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{team.name}</h1>
          <p className="text-sm text-muted-foreground">Manager: {manager}</p>
        </div>
        <Card className="px-5 py-3 flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">Punti totali</div>
            <div className="text-2xl font-bold text-primary">{total}</div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-3 text-xs text-muted-foreground border-dashed">
          Il punteggio include solo i punti maturati da ogni giocatore durante la sua permanenza in rosa.
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Giocatore</th>
                  <th className="text-right px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort("last_week")}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                        sortKey === "last_week" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      Ultima sett.
                      {sortKey === "last_week" && (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => toggleSort("all_time")}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                        sortKey === "all_time" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      All time
                      {sortKey === "all_time" && (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Nessun giocatore in rosa.</td></tr>
                )}
                {sortedPlayers.map((p) => {
                  const isCap = team.captain_player_id === p.id && !p.left_at;
                  const isTal = team.talisman_player_id === p.id && !p.left_at;
                  const isSil = team.silverback_player_id === p.id && !p.left_at;
                  const lw = p.last_week_points;
                  const at = p.points;
                  const lwClass = lw > 0 ? "text-green-600 dark:text-green-500" : lw < 0 ? "text-destructive" : "text-muted-foreground";
                  const atClass = at > 0 ? "text-primary" : at < 0 ? "text-destructive" : "text-muted-foreground";
                  return (
                    <tr key={p.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", p.left_at && "opacity-60")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                            {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs">🏉</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{p.full_name}</span>
                              {isCap && <Badge variant="outline" className="text-[10px] px-1.5 py-0">C×{mCap}</Badge>}
                              {isTal && <Badge variant="outline" className="text-[10px] px-1.5 py-0">T×{mTal}</Badge>}
                              {isSil && <Badge variant="outline" className="text-[10px] px-1.5 py-0">S×{mSil}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.left_at ? "Ceduto — punti conservati" : `${p.category} · ${p.role}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", lwClass)}>
                        {lw > 0 ? `+${lw}` : lw}
                      </td>
                      <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", atClass)}>
                        {at > 0 ? `+${at}` : at}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {coaches.length > 0 && (
          <Card className="p-4">
            <h3 className="font-bold mb-3 inline-flex items-center gap-2"><Megaphone className="h-4 w-4" /> Allenatori</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {coaches.map((c) => (
                <div key={c.id} className="flex flex-col items-center gap-1 rounded-lg border p-3">
                  <div className="h-12 w-12 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                    {c.photo_url ? <img src={c.photo_url} alt="" className="h-full w-full object-cover" /> : <Megaphone className="h-5 w-5" />}
                  </div>
                  <div className="text-sm font-medium text-center truncate w-full">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">{c.category}</div>
                  <Badge variant="outline" className="text-xs mt-1">{c.points} pt</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
