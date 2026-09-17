import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SEASON } from "@/lib/constants";
import { useSeason } from "@/contexts/SeasonContext";
import { Crown, CalendarDays, Trophy } from "lucide-react";

export const Route = createFileRoute("/$crewSlug/weekly")({
  component: WeeklyPage,
  head: () => ({ meta: [{ title: "Punteggi settimanali — Fanta Lambro" }] }),
});

type Event = {
  id: string;
  player_id: string;
  rule_key: string;
  week: number;
  quantity: number;
  match_id?: string | null;
  created_at?: string;
  scoring_rules: { label: string; points: number; is_malus: boolean; score_type?: string | null } | null;
};

type PlayerLite = { id: string; full_name: string; photo_url: string | null; role: string; category: string };

type RoleWindow = { assigned_at: number; removed_at: number | null; multiplier: number };

function getMultiplierAtTs(roleWindows: RoleWindow[], ts: number): number {
  for (const w of roleWindows) {
    if (ts >= w.assigned_at && (w.removed_at === null || ts <= w.removed_at)) return w.multiplier;
  }
  return 1;
}

function WeeklyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { seasonId } = useSeason();

  const [teamPlayers, setTeamPlayers] = useState<PlayerLite[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [week, setWeek] = useState<number | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerLite[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [challengeBonus, setChallengeBonus] = useState<{ id: string; points: number; reason: string; week: number }[]>(
    [],
  );
  const [roleHistoryByPlayer, setRoleHistoryByPlayer] = useState<Map<string, RoleWindow[]>>(new Map());
  const [playerWindows, setPlayerWindows] = useState<Map<string, { joined: number; left: number | null }[]>>(new Map());
  const [matchTsMap, setMatchTsMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const teamQ = supabase.from("teams").select("id").eq("manager_id", user.id);
      const { data: team } = await (
        seasonId ? teamQ.eq("season_id", seasonId) : teamQ.eq("season", SEASON)
      ).maybeSingle();
      if (!team) {
        setTeamPlayers([]);
        return;
      }

      const evSelect =
        "id,player_id,rule_key,week,quantity,match_id,created_at,scoring_rules!inner(label,points,is_malus,score_type)";
      const allEvSelect = "id,player_id,rule_key,week,quantity,scoring_rules!inner(label,points,is_malus,score_type)";

      const [
        { data: tp },
        { data: evRaw },
        { data: allPs },
        { data: allEvRaw },
        { data: penRaw },
        { data: histRaw },
        { data: matchRaw },
        { data: specialRaw },
      ] = await Promise.all([
        supabase.from("team_players").select("player_id").eq("team_id", team.id),
        seasonId
          ? supabase
              .from("weekly_events")
              .select(evSelect)
              .eq("season_id", seasonId)
              .eq("scoring_rules.is_active", true)
          : supabase.from("weekly_events").select(evSelect).eq("season", SEASON).eq("scoring_rules.is_active", true),
        supabase.from("players").select("id,full_name,photo_url,role,category"),
        seasonId
          ? supabase
              .from("weekly_events")
              .select(allEvSelect)
              .eq("season_id", seasonId)
              .eq("scoring_rules.is_active", true)
          : supabase.from("weekly_events").select(allEvSelect).eq("season", SEASON).eq("scoring_rules.is_active", true),
        supabase
          .from("team_penalties")
          .select("id,points,reason")
          .eq("team_id", team.id)
          .ilike("reason", "%sfida 1v1%"),
        supabase.from("team_player_history").select("player_id,joined_at,left_at").eq("team_id", team.id),
        supabase.from("matches").select("id,match_date"),
        (supabase as any)
          .from("special_action_completions")
          .select("id,action_id,player_id,created_at,special_actions!inner(title,points,week,season_id,season)"),
      ]);

      // Match timestamp map (same as scoring.ts)
      const mts = new Map((matchRaw || []).map((m: any) => [m.id, new Date(m.match_date + "T12:00:00Z").getTime()]));
      setMatchTsMap(mts);

      const ids = (tp || []).map((r: any) => r.player_id);
      const ps = (allPs || []).filter((p: any) => ids.includes(p.id));
      setTeamPlayers(ps as PlayerLite[]);
      setAllPlayers(allPs as PlayerLite[]);

      setRoleHistoryByPlayer(new Map());

      // team_player_history → per-player windows
      const winMap = new Map<string, { joined: number; left: number | null }[]>();
      for (const h of (histRaw || []) as any[]) {
        if (!winMap.has(h.player_id)) winMap.set(h.player_id, []);
        winMap.get(h.player_id)!.push({
          joined: new Date(h.joined_at).getTime(),
          left: h.left_at ? new Date(h.left_at).getTime() : null,
        });
      }
      // Fallback: current roster players without history entry are always in window
      for (const pid of ids) {
        if (!winMap.has(pid)) winMap.set(pid, [{ joined: 0, left: null }]);
      }
      setPlayerWindows(winMap);

      const specialRows = ((specialRaw || []) as any[]).filter((s) => {
        const action = Array.isArray(s.special_actions) ? s.special_actions[0] : s.special_actions;
        if (!action) return false;
        if (seasonId && action.season_id && action.season_id !== seasonId) return false;
        if (seasonId && !action.season_id && action.season && action.season !== SEASON) return false;
        if (!seasonId && action.season && action.season !== SEASON) return false;
        return true;
      });
      const actionCounts = new Map<string, number>();
      for (const s of specialRows) actionCounts.set(s.action_id, (actionCounts.get(s.action_id) ?? 0) + 1);
      const specialEvents = specialRows
        .filter((s) => !!s.player_id)
        .map((s) => {
          const action = Array.isArray(s.special_actions) ? s.special_actions[0] : s.special_actions;
          const isPenalty = (actionCounts.get(s.action_id) ?? 0) > 1;
          const points = isPenalty ? -Number(action.points ?? 0) : Number(action.points ?? 0);
          return {
            id: s.id,
            player_id: s.player_id,
            rule_key: "special_action",
            week: action.week ?? 0,
            quantity: 1,
            match_id: null,
            created_at: s.created_at,
            scoring_rules: {
              label: action.title ?? "Azione speciale",
              points,
              is_malus: isPenalty,
              score_type: isPenalty ? "malus" : "bonus",
            },
          } as Event;
        });

      setEvents([...(evRaw as unknown as Event[] || []), ...specialEvents]);
      setAllEvents([...(allEvRaw as unknown as Event[] || []), ...specialEvents]);

      const bonuses = ((penRaw || []) as any[]).map((p: any) => {
        const m = p.reason.match(/settimana (\d+)/i);
        return { id: p.id, points: p.points, reason: p.reason, week: m ? Number(m[1]) : 0 };
      });
      setChallengeBonus(bonuses);
    })();
  }, [user, seasonId]);

  const weeks = useMemo(() => {
    const set = new Set<number>();
    events.forEach((e) => set.add(e.week));
    allEvents.forEach((e) => set.add(e.week));
    challengeBonus.forEach((b) => {
      if (b.week > 0) set.add(b.week);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [events, allEvents, challengeBonus]);

  useEffect(() => {
    if (week === null && weeks.length) setWeek(weeks[0]);
  }, [weeks, week]);

  const weekEvents = useMemo(() => events.filter((e) => e.week === week), [events, week]);

  // Scoring aligned with scoring.ts: role_assignment_history + team_player_history windows
  const byPlayer = useMemo(() => {
    type PlayerStats = {
      events: (Event & { rawPts: number; finalPts: number; mult: number })[];
      raw: number;
      final: number;
    };
    const map = new Map<string, PlayerStats>();
    teamPlayers.forEach((p) => map.set(p.id, { events: [], raw: 0, final: 0 }));

    for (const e of weekEvents) {
      const entry = map.get(e.player_id);
      if (!entry) continue;
      const basePts = (e.scoring_rules?.points ?? 0) * e.quantity;

      // Resolve event timestamp (same formula as scoring.ts buildPlayerEvents)
      const ts =
        ((e as any).match_id && matchTsMap.get((e as any).match_id)) || new Date((e as any).created_at || 0).getTime();

      // Check player was in the team at this timestamp
      const windows = playerWindows.get(e.player_id) || [{ joined: 0, left: null }];
      const inWindow = windows.some((w) => ts >= w.joined && (w.left === null || ts <= w.left));
      if (!inWindow) continue;

      const mult = 1;
      const finalPts = basePts;

      entry.events.push({ ...e, rawPts: basePts, finalPts, mult });
      entry.raw += basePts;
      entry.final += finalPts;
    }
    return map;
  }, [teamPlayers, weekEvents, roleHistoryByPlayer, playerWindows, matchTsMap]);

  const weekChallengeBonus = useMemo(
    () => challengeBonus.filter((b) => b.week === week).reduce((s, b) => s + b.points, 0),
    [challengeBonus, week],
  );
  const totalWeek = useMemo(
    () => Array.from(byPlayer.values()).reduce((s, v) => s + v.final, 0) + weekChallengeBonus,
    [byPlayer, weekChallengeBonus],
  );

  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    allEvents
      .filter((e) => e.week === week)
      .forEach((e) => {
        const pts = (e.scoring_rules?.points ?? 0) * e.quantity;
        map.set(e.player_id, (map.get(e.player_id) ?? 0) + pts);
      });
    return allPlayers.map((p) => ({ p, points: map.get(p.id) ?? 0 })).sort((a, b) => b.points - a.points);
  }, [allEvents, allPlayers, week]);

  if (!user) return null;

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" /> Punteggi settimanali
          </h1>
          <p className="text-sm text-muted-foreground">Punti guadagnati nella settimana selezionata.</p>
        </div>
        <div className="flex items-center gap-3">
          {weeks.length > 0 && (
            <Select value={week?.toString() ?? ""} onValueChange={(v) => setWeek(Number(v))}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Seleziona periodo" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w} value={w.toString()}>
                    Settimana {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Totale tua squadra</div>
            <div className={`text-2xl font-bold ${totalWeek >= 0 ? "text-primary" : "text-destructive"}`}>
              {totalWeek > 0 ? "+" : ""}
              {totalWeek}
            </div>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="myteam" className="w-full">
        <TabsList>
          <TabsTrigger value="myteam">
            <CalendarDays className="h-4 w-4 mr-2" /> La mia squadra
          </TabsTrigger>
          <TabsTrigger value="ranking">
            <Trophy className="h-4 w-4 mr-2" /> Classifica settimanale giocatori
          </TabsTrigger>
        </TabsList>
        <TabsContent value="myteam">
          {teamPlayers.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Non hai ancora una squadra. Crea la tua squadra per vedere i recap settimanali.
            </Card>
          ) : weeks.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nessun evento registrato per la tua squadra.</Card>
          ) : (
            <div className="grid gap-3">
              {weekChallengeBonus !== 0 && (
                <Card
                  className={`p-4 border-2 ${weekChallengeBonus > 0 ? "border-emerald-400/50 bg-emerald-500/5" : "border-red-400/50 bg-red-500/5"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center text-2xl shrink-0 ${weekChallengeBonus > 0 ? "bg-emerald-500/15" : "bg-red-500/15"}`}
                    >
                      ⚔️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">
                        {weekChallengeBonus > 0 ? "Bonus Sfida 1v1 🏆" : "Malus Sfida 1v1 💔"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {challengeBonus
                          .filter((b) => b.week === week)
                          .map((b) => b.reason)
                          .join(" · ")}
                      </div>
                    </div>
                    <div
                      className={`text-2xl font-bold ${weekChallengeBonus > 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {weekChallengeBonus > 0 ? "+" : ""}
                      {weekChallengeBonus}
                    </div>
                  </div>
                </Card>
              )}
              {teamPlayers
                .map((p) => ({ p, stats: byPlayer.get(p.id)! }))
                .sort((a, b) => b.stats.final - a.stats.final)
                .map(({ p, stats }) => {
                  // Find current active role for display badge
                  const roleWindows = roleHistoryByPlayer.get(p.id) || [];
                  const activeRole = roleWindows.find((w) => w.removed_at === null);
                  const mult = activeRole?.multiplier ?? 1;
                  const multLabel = mult === 1 ? null : `×${mult}`;
                  const roleLabel =
                    mult > 1 ? (mult >= 4 ? (mult >= 5 ? "Silverback" : "Talisman") : "Capitano") : null;
                  return (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                          {p.photo_url ? (
                            <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-lg">🏉</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold flex items-center gap-2">
                            {p.full_name}
                            {roleLabel && (
                              <Badge variant="default" className="gap-1">
                                <Crown className="h-3 w-3" /> {roleLabel}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.category} · {p.role}
                          </div>
                        </div>
                        <div className="text-right">
                          {mult > 1 && stats.raw !== 0 && (
                            <div className="text-xs text-muted-foreground">
                              {stats.raw > 0 ? "+" : ""}
                              {stats.raw} {multLabel}
                            </div>
                          )}
                          <div
                            className={`text-2xl font-bold ${stats.final > 0 ? "text-primary" : stats.final < 0 ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {stats.final > 0 ? "+" : ""}
                            {stats.final}
                          </div>
                        </div>
                      </div>
                      {stats.events.length > 0 ? (
                        <ul className="mt-3 grid sm:grid-cols-2 gap-1.5">
                          {stats.events.map((e) => {
                            return (
                              <li
                                key={e.id}
                                className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-3 py-1.5"
                              >
                                <span className="truncate flex items-center gap-1.5">
                                  {e.scoring_rules?.score_type === "club" && (
                                    <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 text-[10px] py-0 px-1.5">
                                      Club
                                    </Badge>
                                  )}
                                  {e.scoring_rules?.label}
                                  {e.quantity > 1 ? ` ×${e.quantity}` : ""}
                                  {e.mult > 1 ? ` ×${e.mult}` : ""}
                                </span>
                                <span
                                  className={`font-semibold ${e.finalPts >= 0 ? "text-primary" : "text-destructive"}`}
                                >
                                  {e.finalPts > 0 ? "+" : ""}
                                  {e.finalPts}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="mt-3 text-xs text-muted-foreground">Nessun evento questa settimana</div>
                      )}
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="ranking">
          {ranking.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Nessun punteggio registrato per questa settimana.
            </Card>
          ) : (
            <div className="grid gap-2">
              {ranking.map((r, i) => (
                <Card key={r.p.id} className="p-3 flex items-center gap-3">
                  <div className="w-8 text-center font-bold text-muted-foreground">{i + 1}</div>
                  <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                    {r.p.photo_url ? (
                      <img src={r.p.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>🏉</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{r.p.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.p.category} · {r.p.role}
                    </div>
                  </div>
                  <div
                    className={`text-xl font-bold ${r.points > 0 ? "text-primary" : r.points < 0 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {r.points > 0 ? "+" : ""}
                    {r.points}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
