import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { currentWeek as computeCurrentWeek } from "@/lib/week";
import { useAuth } from "@/contexts/AuthContext";
import { computeAllTeamScores, type TeamScore } from "@/lib/scoring";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SEASON, categoryLabel } from "@/lib/constants";
import { useSeason } from "@/contexts/SeasonContext";
import { useCategories } from "@/hooks/useCategories";
import { useBlockTM } from "@/hooks/useBlockTM";
import { Trophy, User as UserIcon, ArrowUp, ArrowDown, Minus, Swords } from "lucide-react";

import { useCrew } from "@/contexts/CrewContext";
export const Route = createFileRoute("/$crewSlug/leaderboard")({
  component: LeaderboardPage,
  head: () => ({ meta: [{ title: "Clash Center — Fanta Lambro" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerRow = {
  id: string;
  full_name: string;
  photo_url: string | null;
  category: string;
  role: string;
  total: number;
  value_zaghetti: number;
  zaghetti_delta: number | null;
};

type Delta = number | null;

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ pos }: { pos: number }) {
  const gold = "bg-yellow-400 text-yellow-900";
  const silver = "bg-zinc-300 text-zinc-800";
  const bronze = "bg-amber-600 text-white";
  const plain = "bg-secondary text-foreground";

  const cls = pos === 1 ? gold : pos === 2 ? silver : pos === 3 ? bronze : plain;

  return (
    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${cls}`}>
      {pos}
    </div>
  );
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: Delta }) {
  if (delta === null)
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center">
        <Minus className="h-3 w-3" />
      </span>
    );
  if (delta > 0)
    return (
      <span className="text-xs font-semibold text-emerald-600 inline-flex items-center">
        <ArrowUp className="h-3 w-3" />
        {delta}
      </span>
    );
  if (delta < 0)
    return (
      <span className="text-xs font-semibold text-destructive inline-flex items-center">
        <ArrowDown className="h-3 w-3" />
        {Math.abs(delta)}
      </span>
    );
  return (
    <span className="text-xs text-muted-foreground inline-flex items-center">
      <Minus className="h-3 w-3" />
    </span>
  );
}

function ZaghettiDelta({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  return (
    <span className={`text-[10px] font-semibold ml-1 ${delta > 0 ? "text-emerald-600" : "text-destructive"}`}>
      {delta > 0 ? `+${delta}` : delta} Z
    </span>
  );
}

// ─── Team list ────────────────────────────────────────────────────────────────

function TeamList({ rows, deltas }: { rows: TeamScore[]; deltas: Map<string, Delta> }) {
  const { crewSlug } = useCrew();
  const { user } = useAuth();
  const { activeSeason, seasonId } = useSeason();
  const [q, setQ] = useState("");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myChallenge, setMyChallenge] = useState<{ id: string; challenged_id: string } | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const currentWeek = computeCurrentWeek(activeSeason?.starts_at);

  const loadChallenge = async (teamId: string) => {
    if (!seasonId) return;
    const { data } = await supabase
      .from("challenges" as any)
      .select("id,challenged_id")
      .eq("challenger_id", teamId)
      .eq("week", currentWeek)
      .eq("season_id", seasonId)
      .maybeSingle();
    setMyChallenge((data as any) || null);
  };

  useEffect(() => {
    if (!user) {
      setMyTeamId(null);
      setMyChallenge(null);
      return;
    }
    (async () => {
      const { data } = await supabase.from("teams").select("id").eq("manager_id", user.id).maybeSingle();
      const tid = (data as any)?.id ?? null;
      setMyTeamId(tid);
      if (tid) await loadChallenge(tid);
    })();
  }, [user?.id, seasonId, currentWeek]);

  const sendChallenge = async (targetTeamId: string) => {
    if (!myTeamId || !seasonId) return;
    setSending(targetTeamId);
    const { error } = await supabase.from("challenges" as any).insert({
      challenger_id: myTeamId,
      challenged_id: targetTeamId,
      week: currentWeek,
      season_id: seasonId,
    });
    setSending(null);
    if (error) {
      toast.error("Errore nell'invio della sfida");
      return;
    }
    toast.success("Sfida inviata! ⚔️");
    await loadChallenge(myTeamId);
  };

  if (rows.length === 0)
    return <Card className="p-8 text-center text-muted-foreground">Ancora nessuna squadra in gara.</Card>;

  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? rows.filter((r) => r.team_name.toLowerCase().includes(ql) || (r.manager_name ?? "").toLowerCase().includes(ql))
    : rows;

  const leader = rows[0].total;
  const hasActiveChallenge = !!myChallenge;
  const alreadyChallenged = myChallenge?.challenged_id ?? null;

  return (
    <div className="space-y-3">
      <Input placeholder="Cerca squadra o utente…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="overflow-hidden">
        <ul className="divide-y">
          {filtered.map((r) => {
            const i = rows.indexOf(r);
            const pos = i + 1;
            const gap = leader - r.total;
            const isMine = myTeamId === r.team_id;
            const isChallenged = alreadyChallenged === r.team_id;
            return (
              <li key={r.team_id}>
                <div className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                  <Link
                    to="/$crewSlug/championship/$teamId"
                    params={{ crewSlug, teamId: r.team_id }}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <RankBadge pos={pos} />

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{r.team_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="truncate">{r.manager_name}</span>
                        <DeltaBadge delta={deltas.get(r.team_id) ?? null} />
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <div>
                        <div
                          className={`text-xl font-bold ${
                            r.total > 0 ? "text-primary" : r.total < 0 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {r.total > 0 ? "+" : ""}
                          {r.total}
                        </div>
                        {gap > 0 && <div className="text-xs text-muted-foreground">-{gap} pt</div>}
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-muted-foreground flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </Link>
                  {user &&
                    myTeamId &&
                    !isMine &&
                    (isChallenged ? (
                      <Button size="sm" variant="outline" disabled className="flex-shrink-0">
                        Sfida inviata ✓
                      </Button>
                    ) : hasActiveChallenge ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button size="sm" variant="outline" disabled className="flex-shrink-0">
                                <Swords className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Hai già una sfida attiva questa settimana</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => sendChallenge(r.team_id)}
                        disabled={sending === r.team_id}
                        className="flex-shrink-0"
                      >
                        <Swords className="h-4 w-4 mr-1" /> Sfida
                      </Button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

// ─── Player list ──────────────────────────────────────────────────────────────

function PlayerList({ players, labelMap }: { players: PlayerRow[]; labelMap: Record<string, string> }) {
  if (players.length === 0)
    return <Card className="p-8 text-center text-muted-foreground">Nessun giocatore in questa categoria.</Card>;

  const leader = players[0].total;

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {players.map((p, i) => {
          const pos = i + 1;
          const gap = leader - p.total;
          return (
            <li key={`${p.id}-${pos}`} className="flex items-center gap-3 p-4">
              <RankBadge pos={pos} />

              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.full_name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {categoryLabel(p.category, labelMap)}
                  </Badge>
                  <span className="truncate">{p.role}</span>
                  <span className="font-medium text-foreground">
                    {p.value_zaghetti} Z
                    <ZaghettiDelta delta={p.zaghetti_delta} />
                  </span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div
                  className={`text-xl font-bold ${
                    p.total > 0 ? "text-primary" : p.total < 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {p.total > 0 ? "+" : ""}
                  {p.total}
                </div>
                {gap > 0 && <div className="text-xs text-muted-foreground">-{gap} pt</div>}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ─── Shame player list ────────────────────────────────────────────────────────

function ShamePlayerList({ players, labelMap }: { players: PlayerRow[]; labelMap: Record<string, string> }) {
  if (players.length === 0)
    return (
      <Card className="p-8 text-center text-muted-foreground">Nessun giocatore con malus in questa categoria.</Card>
    );

  const leader = players[0].total;

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {players.map((p, i) => {
          const pos = i + 1;
          const gap = leader - p.total;
          return (
            <li key={`shame-${p.id}-${pos}`} className="flex items-center gap-3 p-4">
              <RankBadge pos={pos} />

              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.full_name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {categoryLabel(p.category, labelMap)}
                  </Badge>
                  <span className="truncate">{p.role}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-1">
                <div className="text-xl font-bold text-destructive">{p.total}</div>
                {gap > 0 && <div className="text-xs text-muted-foreground">-{gap} pt</div>}
                <div className="text-[10px] text-destructive/70 font-medium">punti malus</div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ─── Clash Center Tab ─────────────────────────────────────────────────────────

type ChallengeRow = {
  id: string;
  status: string;
  winner_id: string | null;
  week: number;
  challenger_pts: number | null;
  challenged_pts: number | null;
  challenger: { id: string; name: string };
  challenged: { id: string; name: string };
};

function ClashCard({
  c,
  myTeamId,
  livePts = {},
}: {
  c: ChallengeRow;
  myTeamId: string | null;
  livePts?: Record<string, number>;
}) {
  const isMine = myTeamId ? c.challenger.id === myTeamId || c.challenged.id === myTeamId : false;
  const done = c.status === "completed";
  const leftPts = done ? (c.challenger_pts ?? 0) : (livePts[c.challenger.id] ?? 0);
  const rightPts = done ? (c.challenged_pts ?? 0) : (livePts[c.challenged.id] ?? 0);
  const iWon = done && myTeamId && c.winner_id === myTeamId;
  const iLost = done && myTeamId && c.winner_id && c.winner_id !== myTeamId;

  return (
    <Card className={cn("p-4 relative overflow-hidden", isMine && "ring-2 ring-primary/30")}>
      {done && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-lg pointer-events-none">
          <span
            className={cn(
              "text-2xl font-black drop-shadow-md",
              iWon ? "text-emerald-400" : iLost ? "text-red-400" : "text-muted-foreground",
            )}
          >
            {iWon ? "🏆 Vittoria" : iLost ? "💔 Sconfitta" : "🤝 Pareggio"}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-base font-bold shrink-0",
              c.challenger.id === myTeamId ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {c.challenger.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-center truncate w-full px-1">{c.challenger.name}</span>
          <span
            className={cn("text-xl font-black", done && leftPts >= rightPts ? "text-primary" : "text-muted-foreground")}
          >
            {leftPts}
          </span>
          {c.challenger.id === myTeamId && <span className="text-[10px] text-primary font-semibold">Tu</span>}
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <Swords className="h-4 w-4 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-bold">VS</span>
        </div>
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-base font-bold shrink-0",
              c.challenged.id === myTeamId ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {c.challenged.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-center truncate w-full px-1">{c.challenged.name}</span>
          <span
            className={cn("text-xl font-black", done && rightPts > leftPts ? "text-primary" : "text-muted-foreground")}
          >
            {rightPts}
          </span>
          {c.challenged.id === myTeamId && <span className="text-[10px] text-primary font-semibold">Tu</span>}
        </div>
      </div>
      {!done && (
        <p className="mt-2 text-center text-[10px] text-muted-foreground">Sfida in corso · si chiude domenica sera</p>
      )}
    </Card>
  );
}

function ClashCenterTab() {
  const { user } = useAuth();
  const { seasonId, activeSeason } = useSeason();
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [livePts, setLivePts] = useState<Record<string, number>>({});

  const currentWeek = computeCurrentWeek(activeSeason?.starts_at);

  useEffect(() => {
    if (!seasonId) return;

    async function load() {
      const [{ data: ch }, teamRes] = await Promise.all([
        (supabase as any)
          .from("challenges")
          .select(
            `
            id, status, winner_id, week,
            challenger_pts, challenged_pts,
            challenger:teams!challenger_id(id, name),
            challenged:teams!challenged_id(id, name)
          `,
          )
          .eq("season_id", seasonId)
          .order("week", { ascending: false }),
        user
          ? supabase.from("teams").select("id").eq("manager_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const allCh = (ch || []) as ChallengeRow[];
      setChallenges(allCh);
      setMyTeamId((teamRes.data as any)?.id ?? null);
      setLoading(false);

      const active = allCh.filter((c) => c.status === "active");
      if (!active.length) {
        setLivePts({});
        return;
      }

      const teamIds = [...new Set(active.flatMap((c) => [c.challenger.id, c.challenged.id]))] as string[];
      const sid = seasonId as string;
      // Use the week of the active challenges to avoid off-by-one with computeCurrentWeek.
      const liveWeek = Math.max(...active.map((c) => c.week));

      const [{ data: tp }, { data: evRaw }, { data: specialRaw }, { data: roles }, { data: cfg }] = await Promise.all([
        supabase.from("team_players").select("team_id,player_id").in("team_id", teamIds),
        supabase
          .from("weekly_events")
          .select("player_id,quantity,scoring_rules!inner(points)")
          .eq("week", liveWeek)
          .eq("season_id", sid)
          .eq("scoring_rules.is_active", true),
        (supabase as any)
          .from("special_action_completions")
          .select("action_id,player_id,special_actions!inner(points,week,season_id)")
          .eq("special_actions.week", liveWeek)
          .eq("special_actions.season_id", sid),
        supabase
          .from("role_assignment_history")
          .select("team_id,player_id,role")
          .in("team_id", teamIds)
          .is("removed_at", null),
        supabase
          .from("team_config")
          .select("key,value")
          .in("key", ["multiplier_captain", "multiplier_talisman", "multiplier_silverback"]),
      ]);

      const cfgMap = new Map(((cfg || []) as any[]).map((r: any) => [r.key, Number(r.value)]));
      const mCap = cfgMap.get("multiplier_captain") ?? 2;
      const mTal = cfgMap.get("multiplier_talisman") ?? 4;
      const mSil = cfgMap.get("multiplier_silverback") ?? 5;

      const playerPts = new Map<string, number>();
      for (const e of (evRaw || []) as any[]) {
        const pts = ((e.scoring_rules as any)?.points ?? 0) * (e.quantity ?? 1);
        if (!pts) continue;
        playerPts.set(e.player_id, (playerPts.get(e.player_id) ?? 0) + pts);
      }
      const actionCounts = new Map<string, number>();
      for (const s of (specialRaw || []) as any[]) actionCounts.set(s.action_id, (actionCounts.get(s.action_id) ?? 0) + 1);
      for (const s of (specialRaw || []) as any[]) {
        if (!s.player_id) continue;
        const action = Array.isArray(s.special_actions) ? s.special_actions[0] : s.special_actions;
        const base = Number(action?.points ?? 0);
        const pts = (actionCounts.get(s.action_id) ?? 0) > 1 ? -base : base;
        if (!pts) continue;
        playerPts.set(s.player_id, (playerPts.get(s.player_id) ?? 0) + pts);
      }

      const roleMult = new Map<string, number>();
      for (const r of (roles || []) as any[]) {
        const mult = r.role === "captain" ? mCap : r.role === "talisman" ? mTal : r.role === "silverback" ? mSil : 1;
        roleMult.set(`${r.team_id}:${r.player_id}`, mult);
      }

      const pts: Record<string, number> = {};
      for (const tid of teamIds) {
        const members = ((tp || []) as any[]).filter((r: any) => r.team_id === tid);
        let total = 0;
        for (const m of members) {
          const base = playerPts.get(m.player_id) ?? 0;
          const mult = roleMult.get(`${tid}:${m.player_id}`) ?? 1;
          total += base * mult;
        }
        pts[tid] = total;
      }
      setLivePts(pts);
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [seasonId, user?.id]);

  if (loading) {
    return <Card className="p-8 text-center text-muted-foreground">Caricamento sfide…</Card>;
  }

  if (challenges.length === 0) {
    return <Card className="p-8 text-center text-muted-foreground">Nessuna sfida in questa stagione.</Card>;
  }

  // Group by week, current week first
  const byWeek = new Map<number, ChallengeRow[]>();
  challenges.forEach((c) => {
    if (!byWeek.has(c.week)) byWeek.set(c.week, []);
    byWeek.get(c.week)!.push(c);
  });
  const weeks = Array.from(byWeek.keys()).sort((a, b) => b - a);

  return (
    <div className="space-y-5">
      {weeks.map((w) => {
        const wCh = byWeek.get(w)!;
        const myWins = myTeamId ? wCh.filter((c) => c.winner_id === myTeamId).length : 0;
        const myLosses = myTeamId
          ? wCh.filter(
              (c) =>
                c.status === "completed" &&
                c.winner_id &&
                c.winner_id !== myTeamId &&
                (c.challenger.id === myTeamId || c.challenged.id === myTeamId),
            ).length
          : 0;
        return (
          <div key={w} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Settimana {w}</span>
                {w === currentWeek && <Badge className="bg-primary/10 text-primary text-[10px]">In corso</Badge>}
              </div>
              {myTeamId && (
                <div className="flex items-center gap-1.5 ml-auto">
                  {myWins > 0 && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 text-[10px] hover:bg-emerald-500/15">
                      🏆 {myWins}V
                    </Badge>
                  )}
                  {myLosses > 0 && (
                    <Badge className="bg-red-500/15 text-red-700 text-[10px] hover:bg-red-500/15">💔 {myLosses}S</Badge>
                  )}
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {wCh.map((c) => (
                <ClashCard key={c.id} c={c} myTeamId={myTeamId} livePts={livePts} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function LeaderboardPage() {
  useBlockTM();
  const { seasonId } = useSeason();
  const { labelMap } = useCategories();
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined" && window.location.hash === "#sfide") return "sfide";
    return "teams";
  });

  // Teams
  const [rows, setRows] = useState<TeamScore[]>([]);
  const [deltas, setDeltas] = useState<Map<string, Delta>>(new Map());

  // Players
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [shamePlayers, setShamePlayers] = useState<PlayerRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [playerCategory, setPlayerCategory] = useState<"all" | string>("all");
  const [playerSubTab, setPlayerSubTab] = useState<"fame" | "shame">("fame");
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // ── Load team scores + deltas ──
  useEffect(() => {
    (async () => {
      const teamScores = await computeAllTeamScores(seasonId);
      setRows(teamScores);

      const snapsQ = supabase
        .from("leaderboard_snapshots")
        .select("team_id,week,rank")
        .order("week", { ascending: false });
      const { data: snaps } = await (seasonId ? snapsQ.eq("season_id", seasonId) : snapsQ.eq("season", SEASON));

      const byWeek = new Map<number, Map<string, number>>();
      (snaps || []).forEach((s: any) => {
        if (!byWeek.has(s.week)) byWeek.set(s.week, new Map());
        byWeek.get(s.week)!.set(s.team_id, s.rank);
      });
      const weeks = Array.from(byWeek.keys()).sort((a, b) => b - a);
      const d = new Map<string, Delta>();
      if (weeks.length >= 2) {
        const cur = byWeek.get(weeks[0])!;
        const prev = byWeek.get(weeks[1])!;
        teamScores.forEach((t) => {
          const c = cur.get(t.team_id);
          const p = prev.get(t.team_id);
          if (c == null || p == null) d.set(t.team_id, null);
          else d.set(t.team_id, p - c);
        });
      } else {
        teamScores.forEach((t) => d.set(t.team_id, null));
      }
      setDeltas(d);
    })();
  }, [seasonId]);

  // ── Load players + scores + zaghetti delta ──
  useEffect(() => {
    (async () => {
      setLoadingPlayers(true);
      const eventsQuery = supabase
        .from("weekly_events")
        .select("player_id,quantity,rule_key,scoring_rules!inner(points),season_id,season")
        .eq("scoring_rules.is_active", true);
      const actionsQuery = supabase
        .from("special_action_completions")
        .select("player_id,special_actions(points,season_id,season)");

      const [{ data: ps }, { data: ev }, { data: sac }, { data: zh }] = await Promise.all([
        supabase.from("players").select("id,full_name,photo_url,category,role,value_zaghetti"),
        seasonId ? eventsQuery.or(`season_id.eq.${seasonId},season.eq.${SEASON}`) : eventsQuery.eq("season", SEASON),
        actionsQuery,
        (() => {
          const zhQ = supabase.from("zaghetti_history").select("player_id,delta").order("month", { ascending: false });
          return seasonId ? zhQ.eq("season_id", seasonId) : zhQ.eq("season", SEASON);
        })(),
      ]);

      // Latest zaghetti delta per player
      const zaghettiDeltaMap = new Map<string, number>();
      (zh || []).forEach((z: any) => {
        if (!zaghettiDeltaMap.has(z.player_id)) zaghettiDeltaMap.set(z.player_id, z.delta);
      });

      // Points totals from weekly_events
      const totals = new Map<string, number>();
      const shameMap = new Map<string, number>();
      (
        ev as unknown as
          | { player_id: string; quantity: number; rule_key: string; scoring_rules: { points: number } | null }[]
          | null
      )?.forEach((e) => {
        const pts = (e.scoring_rules?.points ?? 0) * e.quantity;
        totals.set(e.player_id, (totals.get(e.player_id) ?? 0) + pts);
        if (["yellow_card", "red_card", "merdtm"].includes(e.rule_key)) {
          shameMap.set(e.player_id, (shameMap.get(e.player_id) ?? 0) + Math.abs(pts));
        }
      });

      // Points from special actions
      (
        sac as unknown as
          | {
              player_id: string | null;
              special_actions: { points: number; season_id: string | null; season?: string } | null;
            }[]
          | null
      )?.forEach((c: any) => {
        if (!c.player_id || !c.special_actions) return;
        const sid = c.special_actions.season_id;
        const sname = c.special_actions.season;
        if (seasonId && sid && sid !== seasonId) return;
        if (seasonId && !sid && sname && sname !== SEASON) return;
        totals.set(c.player_id, (totals.get(c.player_id) ?? 0) + c.special_actions.points);
      });

      const list: PlayerRow[] = (ps || [])
        .map((p: any) => ({
          ...p,
          total: totals.get(p.id) ?? 0,
          zaghetti_delta: zaghettiDeltaMap.get(p.id) ?? null,
        }))
        .sort((a: PlayerRow, b: PlayerRow) => b.total - a.total);

      const shameList: PlayerRow[] = (ps || [])
        .map((p: any) => ({
          ...p,
          total: shameMap.get(p.id) ?? 0,
          zaghetti_delta: null,
        }))
        .filter((p: PlayerRow) => p.total > 0)
        .sort((a: PlayerRow, b: PlayerRow) => b.total - a.total);

      setPlayers(list);
      setShamePlayers(shameList);

      const cats = Array.from(new Set((ps || []).map((p: any) => p.category as string).filter(Boolean))).sort();
      setCategories(cats);

      setLoadingPlayers(false);
    })();
  }, [seasonId]);

  const filteredPlayers = playerCategory === "all" ? players : players.filter((p) => p.category === playerCategory);
  const filteredShame =
    playerCategory === "all" ? shamePlayers : shamePlayers.filter((p) => p.category === playerCategory);

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-3">
        <Swords className="h-7 w-7 text-primary" />
        <h1 className="text-3xl font-bold">Clash Center</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="teams">
            <Trophy className="h-4 w-4 mr-2" /> Squadre
          </TabsTrigger>
          <TabsTrigger value="players">
            <UserIcon className="h-4 w-4 mr-2" /> Giocatori
          </TabsTrigger>
          <TabsTrigger value="sfide">
            <Swords className="h-4 w-4 mr-2" /> Sfide
          </TabsTrigger>
        </TabsList>

        {/* ── SQUADRE ── */}
        <TabsContent value="teams">
          <TeamList rows={rows} deltas={deltas} />
        </TabsContent>

        {/* ── GIOCATORI ── */}
        <TabsContent value="players">
          {loadingPlayers ? (
            <Card className="p-8 text-center text-muted-foreground">Caricamento classifica giocatori…</Card>
          ) : players.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nessun giocatore registrato.</Card>
          ) : (
            <>
              {/* Fame / Shame selector */}
              <Tabs defaultValue="fame" onValueChange={(v) => setPlayerSubTab(v as "fame" | "shame")}>
                <TabsList className="mb-2">
                  <TabsTrigger value="fame">Hall of Fame 🏆</TabsTrigger>
                  <TabsTrigger value="shame">Hall of Shame 💩</TabsTrigger>
                </TabsList>

                <TabsContent value="fame">
                  <p className="text-sm text-muted-foreground mb-3">
                    I migliori giocatori della stagione per punti totali.
                  </p>
                </TabsContent>

                <TabsContent value="shame">
                  <p className="text-sm text-muted-foreground mb-3">
                    La classifica dei peggiori… Solo i malus contano: cartellini e MerdTM.
                  </p>
                </TabsContent>
              </Tabs>

              {/* Category filter */}
              <Tabs value={playerCategory} onValueChange={(v) => setPlayerCategory(v)}>
                <TabsList className="mb-4 flex-wrap h-auto gap-1">
                  <TabsTrigger value="all">Tutti</TabsTrigger>
                  {categories.map((cat) => (
                    <TabsTrigger key={cat} value={cat}>
                      {categoryLabel(cat, labelMap)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="all">
                  {playerSubTab === "fame" ? (
                    <PlayerList players={filteredPlayers} labelMap={labelMap} />
                  ) : (
                    <ShamePlayerList players={filteredShame} labelMap={labelMap} />
                  )}
                </TabsContent>
                {categories.map((cat) => (
                  <TabsContent key={cat} value={cat}>
                    {playerSubTab === "fame" ? (
                      <PlayerList players={filteredPlayers} labelMap={labelMap} />
                    ) : (
                      <ShamePlayerList players={filteredShame} labelMap={labelMap} />
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </TabsContent>
        {/* ── SFIDE ── */}
        <TabsContent value="sfide">
          <ClashCenterTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
