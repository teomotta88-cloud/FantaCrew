import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDraftState } from "@/hooks/useDraftState";
import { useBlockTM } from "@/hooks/useBlockTM";
import { useTeamManager } from "@/hooks/useTeamManager";
import { useSeason } from "@/contexts/SeasonContext";
import { useCategories } from "@/hooks/useCategories";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { computeAllTeamScores, type TeamScore } from "@/lib/scoring";
import { SEASON } from "@/lib/constants";
import { toast } from "sonner";
import {
  Calendar as CalIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Minus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  Swords,
  Trash2,
  Trophy,
  Users,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Shield } from "lucide-react";
import { currentWeek as computeCurrentWeek, weekOf } from "@/lib/week";

import { useCrew } from "@/contexts/CrewContext";
export const Route = createFileRoute("/$crewSlug/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Fanta Lambro" }] }),
});

type ClaimedPlayer = { id: string; full_name: string; category: string; role: string; photo_url?: string | null };
type ClaimedCoach = { id: string; full_name: string; category: string };
type Absence = {
  id: string;
  player_id: string;
  user_id: string;
  training_date: string;
  justification: string;
  category: string;
  is_read: boolean;
  created_at: string;
  players?: { full_name: string } | null;
};

function DashboardPage() {
  useBlockTM();
  const { user, loading, isAdmin, profile } = useAuth();
  const { tm, isTeamManager } = useTeamManager();
  const navigate = useNavigate();
  const { seasonId, activeSeason } = useSeason();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  const [player, setPlayer] = useState<ClaimedPlayer | null>(null);
  const [coach, setCoach] = useState<ClaimedCoach | null>(null);
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);
  const [topTeams, setTopTeams] = useState<TeamScore[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<{ users: number; teams: number; unread: number } | null>(null);

  // Refs prevent re-fetching on tab focus / AuthContext re-renders
  const rolesLoadedForUser = useRef<string | null>(null);
  const teamsLoadedForSeason = useRef<string | null>(null);
  const adminStatsLoaded = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (rolesLoadedForUser.current === user.id) return; // already loaded
    rolesLoadedForUser.current = user.id;
    setRolesLoading(true);
    (async () => {
      const [{ data: pl }, { data: co }, { data: tm }] = await Promise.all([
        supabase.from("players").select("id,full_name,category,role,photo_url").eq("user_id", user.id).maybeSingle(),
        supabase.from("coaches").select("id,full_name,category").eq("user_id", user.id).maybeSingle(),
        supabase.from("teams").select("id,name").eq("manager_id", user.id).maybeSingle(),
      ]);
      setPlayer((pl as ClaimedPlayer) || null);
      setCoach((co as ClaimedCoach) || null);
      setTeam((tm as any) || null);
      setRolesLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!seasonId) return;
    if (teamsLoadedForSeason.current === seasonId) return; // already loaded
    teamsLoadedForSeason.current = seasonId;
    (async () => {
      const all = await computeAllTeamScores(seasonId);
      setTopTeams(all.slice(0, 5));
    })();
  }, [seasonId]);

  useEffect(() => {
    if (!isAdmin) return;
    if (adminStatsLoaded.current) return; // already loaded
    adminStatsLoaded.current = true;
    (async () => {
      const [{ count: users }, { count: teams }, { count: unread }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("teams").select("*", { count: "exact", head: true }),
        supabase.from("training_absences" as any).select("*", { count: "exact", head: true }),
      ]);
      setAdminStats({ users: users || 0, teams: teams || 0, unread: unread || 0 });
    })();
  }, [isAdmin]);

  // ── Challenges ──────────────────────────────────────────────────
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengePts, setChallengePts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!team || !seasonId || !activeSeason?.starts_at) return;
    async function loadChallenges() {
      const { data: chData } = await (supabase as any)
        .from("challenges")
        .select(
          `
          id, status, winner_id, week,
          challenger_pts, challenged_pts,
          challenger:teams!challenger_id(id, name),
          challenged:teams!challenged_id(id, name)
        `,
        )
        .or(`challenger_id.eq.${team!.id},challenged_id.eq.${team!.id}`)
        .eq("season_id", seasonId)
        .order("week", { ascending: false });
      setChallenges(chData || []);

      const active = ((chData || []) as any[]).filter((c: any) => c.status === "active");
      if (!active.length) return;

      // Use the week of the active challenges themselves to avoid
      // off-by-one mismatches with computeCurrentWeek.
      const currentWeek = Math.max(...active.map((c: any) => c.week));
      const teamIds = [...new Set(active.flatMap((c: any) => [c.challenger.id, c.challenged.id]))] as string[];
      const sid = seasonId as string;

      const [{ data: tp }, { data: evRaw }, { data: specialRaw }, { data: roles }, { data: cfg }] = await Promise.all([
        supabase.from("team_players").select("team_id,player_id").in("team_id", teamIds),
        supabase
          .from("weekly_events")
          .select("player_id,quantity,scoring_rules!inner(points)")
          .eq("week", currentWeek)
          .eq("season_id", sid)
          .eq("scoring_rules.is_active", true),
        (supabase as any)
          .from("special_action_completions")
          .select("action_id,player_id,special_actions!inner(points,week,season_id)")
          .eq("special_actions.week", currentWeek)
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

      // Base weekly pts per player
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

      // Current role multiplier per team+player
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
      setChallengePts(pts);
    }

    loadChallenges();
    const interval = setInterval(loadChallenges, 30_000);
    return () => clearInterval(interval);
  }, [team?.id, seasonId, activeSeason?.starts_at]);

  if (loading || !user) {
    return (
      <PageShell>
        <div className="text-center text-sm text-muted-foreground py-12">Caricamento…</div>
      </PageShell>
    );
  }

  const greetingName = profile?.display_name || user.email?.split("@")[0] || "manager";
  const hasAnyRole = isAdmin || !!player || !!coach || isTeamManager;

  return (
    <PageShell>
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Ciao, {greetingName} 👋</h1>
          {rolesLoading ? (
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
          ) : hasAnyRole ? (
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Badge className="gap-1">
                  <Shield className="h-3 w-3" /> Admin
                </Badge>
              )}
              {isTeamManager && (
                <Badge variant="secondary" className="gap-1">
                  🏟️ Team Manager — {tm?.category}
                </Badge>
              )}
              {player && (
                <Badge variant="secondary">
                  🏉 Giocatore — {player.category} · {player.role}
                </Badge>
              )}
              {coach && <Badge variant="secondary">🎽 Allenatore — {coach.category}</Badge>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Benvenuto! Il tuo account è attivo.</p>
          )}
        </div>

        {rolesLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            {team && (
              <>
                <SectionDivider label="Sfide 1v1" />
                <ChallengesSection
                  challenges={challenges}
                  myTeamId={team.id}
                  challengePts={challengePts}
                  currentWeek={computeCurrentWeek(activeSeason?.starts_at)}
                />
              </>
            )}
            {isAdmin && (
              <>
                <SectionDivider label="Sezione Admin" />
                <AdminSection stats={adminStats} />
              </>
            )}
            {isTeamManager && tm && (
              <>
                <SectionDivider label="Sezione Team Manager" />
                <TMSection category={tm.category} />
              </>
            )}
            {player && (
              <>
                <SectionDivider label="Sezione Giocatore" />
                <PlayerSection player={player} team={team} topTeams={topTeams} userId={user.id} />
              </>
            )}
            {coach && (
              <>
                <SectionDivider label="Sezione Allenatore" />
                <CoachSection coach={coach} />
              </>
            )}
            {!isAdmin && !player && !coach && (
              <>
                <SectionDivider label="Inizia da qui" />
                <GenericSection team={team} topTeams={topTeams} />
              </>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

/* ─── Sfide 1v1 ──────────────────────────────────────────────────────────── */

function ChallengCard({
  c,
  myTeamId,
  challengePts,
}: {
  c: any;
  myTeamId: string;
  challengePts: Record<string, number>;
}) {
  const isChallenger = c.challenger.id === myTeamId;
  const left = c.challenger;
  const right = c.challenged;
  const leftPts = c.status === "completed" ? (c.challenger_pts ?? 0) : (challengePts[left.id] ?? 0);
  const rightPts = c.status === "completed" ? (c.challenged_pts ?? 0) : (challengePts[right.id] ?? 0);
  const done = c.status === "completed";
  const iWon = done && c.winner_id === myTeamId;
  const iLost = done && c.winner_id && c.winner_id !== myTeamId;

  return (
    <Card className="p-4 relative overflow-hidden">
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
              "h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
              isChallenger ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {left.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-center truncate w-full px-1">{left.name}</span>
          <span className={cn("text-2xl font-black", leftPts >= rightPts ? "text-primary" : "text-muted-foreground")}>
            {leftPts}
          </span>
          {isChallenger && <span className="text-[10px] text-primary font-semibold">Tu</span>}
        </div>
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <Swords className="h-5 w-5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-bold">VS</span>
        </div>
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div
            className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
              !isChallenger ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {right.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-center truncate w-full px-1">{right.name}</span>
          <span className={cn("text-2xl font-black", rightPts > leftPts ? "text-primary" : "text-muted-foreground")}>
            {rightPts}
          </span>
          {!isChallenger && <span className="text-[10px] text-primary font-semibold">Tu</span>}
        </div>
      </div>
      {!done && (
        <p className="mt-2 text-center text-[10px] text-muted-foreground">Sfida in corso · si chiude domenica sera</p>
      )}
    </Card>
  );
}

function ChallengesSection({
  challenges,
  myTeamId,
  challengePts,
  currentWeek,
}: {
  challenges: any[];
  myTeamId: string;
  challengePts: Record<string, number>;
  currentWeek: number;
}) {
  const { crewSlug } = useCrew();
  const [showHistory, setShowHistory] = useState(false);

  const current = challenges.filter((c) => c.week === currentWeek);
  const history = challenges.filter((c) => c.week !== currentWeek);
  const byWeek = new Map<number, any[]>();
  history.forEach((c) => {
    if (!byWeek.has(c.week)) byWeek.set(c.week, []);
    byWeek.get(c.week)!.push(c);
  });
  const histWeeks = Array.from(byWeek.keys()).sort((a, b) => b - a);

  if (challenges.length === 0) {
    return (
      <Card className="p-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Swords className="h-4 w-4" /> Sfide 1v1 — Settimana {currentWeek}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Nessuna sfida questa settimana.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/$crewSlug/leaderboard" params={{ crewSlug }} hash="sfide">
            Clash Center →
          </Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-base">
          <Swords className="h-4 w-4" /> Sfide 1v1 — Settimana {currentWeek}
        </h3>
        <Button asChild variant="ghost" size="sm">
          <Link to="/$crewSlug/leaderboard" params={{ crewSlug }} hash="sfide">
            Clash Center →
          </Link>
        </Button>
      </div>

      {current.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground text-center">
          Nessuna sfida questa settimana.{" "}
          <Link to="/$crewSlug/leaderboard" params={{ crewSlug }} className="text-primary underline-offset-2 hover:underline">
            Sfidane uno!
          </Link>
        </Card>
      ) : (
        current.map((c) => <ChallengCard key={c.id} c={c} myTeamId={myTeamId} challengePts={challengePts} />)
      )}

      {histWeeks.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={cn("h-4 w-4 transition-transform", showHistory && "rotate-90")}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            Storico sfide ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-4">
              {histWeeks.map((w) => {
                const wCh = byWeek.get(w)!;
                const wins = wCh.filter((c) => c.winner_id === myTeamId).length;
                const losses = wCh.filter(
                  (c) => c.status === "completed" && c.winner_id && c.winner_id !== myTeamId,
                ).length;
                return (
                  <div key={w} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Settimana {w}
                      </span>
                      {wins > 0 && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 text-[10px] hover:bg-emerald-500/15">
                          🏆 {wins}V
                        </Badge>
                      )}
                      {losses > 0 && (
                        <Badge className="bg-red-500/15 text-red-700 text-[10px] hover:bg-red-500/15">
                          💔 {losses}S
                        </Badge>
                      )}
                    </div>
                    {wCh.map((c) => (
                      <ChallengCard key={c.id} c={c} myTeamId={myTeamId} challengePts={challengePts} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Separator className="flex-1" />
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">— {label} —</span>
      <Separator className="flex-1" />
    </div>
  );
}

/* ---------------- Admin section ---------------- */

function AdminSection({ stats }: { stats: { users: number; teams: number; unread: number } | null }) {
  const { crewSlug } = useCrew();
  return (
    <section className="space-y-3">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" /> Pannello amministrazione
          </h3>
          <Button asChild>
            <Link to="/$crewSlug/admin" params={{ crewSlug }}>⚙️ Admin</Link>
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Utenti" value={stats?.users} />
          <Stat label="Squadre" value={stats?.teams} />
          <Stat label="Assenze totali" value={stats?.unread} highlight={!!stats && stats.unread > 0} />
        </div>
      </Card>
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | undefined; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3 text-center", highlight && "border-primary bg-primary/5")}>
      <div className="text-2xl font-bold">{value ?? "—"}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

/* ---------------- Player section ---------------- */

function PlayerSection({
  player,
  team,
  topTeams,
  userId,
}: {
  player: ClaimedPlayer;
  team: { id: string; name: string } | null;
  topTeams: TeamScore[];
  userId: string;
}) {
  const { crewSlug } = useCrew();
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-l-4 border-primary pl-3">
        <h2 className="text-xl font-bold">La tua scheda giocatore</h2>
        <Badge variant="secondary">{player.category}</Badge>
        <Badge variant="outline">{player.role}</Badge>
      </div>

      <PlayerProfileCard player={player} />
      <NextMatchCard category={player.category} />
      <MatchCalendarCard category={player.category} />

      <AbsenceCard player={player} userId={userId} />

      <PlayerStatsCard playerId={player.id} />

      <PlayerBadgesCard playerId={player.id} playerCategory={player.category} />

      <Card className="p-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <UsersIcon className="h-4 w-4" /> La mia squadra Fanta
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {team ? team.name : "Non hai ancora creato la tua squadra"}
          </p>
        </div>
        <Button asChild variant={team ? "outline" : "default"}>
          <Link to="/$crewSlug/team" params={{ crewSlug }}>{team ? "Apri" : "Crea squadra"}</Link>
        </Button>
      </Card>

      <TopFiveCard topTeams={topTeams} />
    </section>
  );
}

/* ---------------- Player Badges ---------------- */

type BadgeDef = {
  key: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  threshold: number | null;
  sort_order: number;
};
type EarnedBadge = { badge_key: string };

function PlayerStatsCard({ playerId }: { playerId: string }) {
  const { seasonId } = useSeason();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) return;
    (async () => {
      setLoading(true);
      // Use scoring_rules!inner to exclude inactive rules automatically
      const { data: we } = await supabase
        .from("weekly_events")
        .select(
          "id,rule_key,quantity,week,inserted_at,created_at,scoring_rules!inner(label,points,is_malus,key,is_active)",
        )
        .eq("player_id", playerId)
        .eq("season_id", seasonId)
        .eq("scoring_rules.is_active", true);
      const { data: sac } = await supabase
        .from("special_action_completions")
        .select("id,created_at,action_id,special_actions(title,points,week,season_id)")
        .eq("player_id", playerId);
      const actionCounts: Record<string, number> = {};
      (sac || []).forEach((s: any) => {
        actionCounts[s.action_id] = (actionCounts[s.action_id] ?? 0) + 1;
      });
      // Normalize weekly_events — skip rows where scoring_rules is null (inactive)
      const weNorm = ((we || []) as any[])
        .filter((e) => e.scoring_rules != null)
        .map((e) => ({
          id: e.id,
          week: e.week ?? 0,
          event_key: e.scoring_rules?.key ?? e.rule_key,
          event_label: e.scoring_rules?.label ?? e.rule_key,
          points: (e.scoring_rules?.points ?? 0) * (e.quantity ?? 1),
          is_malus: e.scoring_rules?.is_malus ?? false,
          date: e.inserted_at || e.created_at,
        }));
      const sacNorm = ((sac || []) as any[])
        .filter((s: any) => s.special_actions?.season_id === seasonId)
        .map((s: any) => {
          const dup = (actionCounts[s.action_id] ?? 1) > 1;
          return {
            id: s.id,
            week: s.special_actions?.week ?? 0,
            event_key: "special_action",
            event_label: s.special_actions?.title ?? "Azione speciale",
            points: dup ? -(s.special_actions?.points ?? 0) : (s.special_actions?.points ?? 0),
            is_malus: dup,
            date: s.created_at,
          };
        });
      const all = [...weNorm, ...sacNorm].sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      );
      setEvents(all);
      setLoading(false);
    })();
  }, [playerId, seasonId]);

  // Navigation state — MUST be before any early return (Rules of Hooks)
  const [weekIdx, setWeekIdx] = useState(0);

  if (loading)
    return (
      <Card className="p-5">
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  if (events.length === 0)
    return (
      <Card className="p-5">
        <h3 className="font-semibold text-lg mb-2">📊 Le tue statistiche</h3>
        <p className="text-sm text-muted-foreground">Nessun evento registrato per questa stagione.</p>
      </Card>
    );

  const total = events.reduce((s, e) => s + e.points, 0);
  const countKey = (key: string) => events.filter((e) => e.event_key === key).length;

  const fmtDate = (iso: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Group events by calendar week (Mon–Sun) based on actual event date
  const getMonday = (iso: string): string => {
    const d = new Date(iso);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    return mon.toISOString().slice(0, 10);
  };

  const byWeek = new Map<string, typeof events>();
  events.forEach((e) => {
    if (!e.date) return;
    const key = getMonday(e.date);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(e);
  });
  const weeksSorted = Array.from(byWeek.keys()).sort((a, b) => b.localeCompare(a));
  const currentWeekKey = weeksSorted[weekIdx] ?? null;
  const currentWeekEvents = currentWeekKey ? (byWeek.get(currentWeekKey) ?? []) : [];
  const currentWeekTotal = currentWeekEvents.reduce((s, e) => s + e.points, 0);
  const hasPrev = weekIdx < weeksSorted.length - 1;
  const hasNext = weekIdx > 0;

  const weekLabel = (mondayIso: string): string => {
    const mon = new Date(mondayIso + "T00:00:00");
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
    const fmtY = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt(mon)} – ${fmtY(sun)}`;
  };

  const stats = [
    { label: "Totale pt", value: total, accent: true },
    { label: "Allenamenti ✓", value: countKey("training_attendance") },
    { label: "Allenamenti ✗", value: countKey("training_absence") },
    { label: "Titolare", value: countKey("starting_xv") },
    { label: "Mete", value: countKey("try_scored") },
    { label: "MOTM 🏆", value: countKey("motm") },
    { label: "MerdTM 💩", value: countKey("merdtm") },
  ];

  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold text-lg">📊 Le tue statistiche</h3>

      {/* Stat grid — season totals */}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-2 text-center">
            <div
              className={`text-xl font-bold ${s.accent ? (s.value >= 0 ? "text-primary" : "text-destructive") : ""}`}
            >
              {s.accent && s.value > 0 ? "+" : ""}
              {s.value}
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Week navigator */}
      {weeksSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">Nessun evento registrato.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {/* Week header with arrows */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
            <button
              onClick={() => setWeekIdx((i) => i + 1)}
              disabled={!hasPrev}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Settimana precedente"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            <div className="text-center">
              <div className="text-sm font-semibold">{currentWeekKey ? weekLabel(currentWeekKey) : "Senza data"}</div>
              <div
                className={`text-xs font-bold ${currentWeekTotal > 0 ? "text-emerald-600" : currentWeekTotal < 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {currentWeekTotal > 0 ? "+" : ""}
                {currentWeekTotal} pt
              </div>
            </div>

            <button
              onClick={() => setWeekIdx((i) => i - 1)}
              disabled={!hasNext}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Settimana successiva"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Events in selected week */}
          {currentWeekEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun evento questa settimana.</p>
          ) : (
            <div className="divide-y">
              {currentWeekEvents.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{e.event_label}</div>
                    {e.date && <div className="text-[10px] text-muted-foreground">{fmtDate(e.date)}</div>}
                  </div>
                  <span
                    className={`font-bold flex-shrink-0 ml-2 ${e.points >= 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {e.points > 0 ? `+${e.points}` : e.points}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Week counter */}
          <div className="px-3 py-1.5 bg-muted/20 border-t text-center text-[10px] text-muted-foreground">
            {weekIdx + 1} / {weeksSorted.length} settimane
          </div>
        </div>
      )}
    </Card>
  );
}

function PlayerBadgesCard({ playerId, playerCategory }: { playerId: string; playerCategory?: string }) {
  const { seasonId, activeSeason } = useSeason();
  const [defs, setDefs] = useState<BadgeDef[]>([]);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!seasonId) return;
    (async () => {
      setLoading(true);
      const [
        { data: d },
        { data: pb },
        { data: ev },
        { data: ac },
        { count: totalTeams },
        { data: roleRows },
        { data: seasonTrainings },
      ] = await Promise.all([
        (supabase as any).from("badge_definitions").select("*").eq("is_active", true).order("sort_order"),
        (supabase as any).from("player_badges").select("badge_key").eq("player_id", playerId).eq("season_id", seasonId),
        supabase
          .from("weekly_events")
          .select("rule_key,quantity,match_id,inserted_at,created_at")
          .eq("player_id", playerId)
          .eq("season_id", seasonId),
        supabase.from("special_action_completions").select("action_id").eq("player_id", playerId),
        supabase.from("teams").select("*", { count: "exact", head: true }).eq("season_id", seasonId),
        supabase
          .from("role_assignment_history")
          .select("role,team_id")
          .eq("player_id", playerId)
          .is("removed_at", null),
        supabase.from("trainings").select("training_date").eq("season_id", seasonId),
      ]);
      if (cancelled) return;
      setDefs((d as BadgeDef[]) || []);

      // Compute progress from raw events
      const evArr = (ev || []) as any[];
      const acArr = (ac as any[]) || [];

      const tries = evArr.filter((e) => e.rule_key === "try_scored").reduce((s, e) => s + (e.quantity || 1), 0);
      const motm = evArr.filter((e) => e.rule_key === "motm").reduce((s, e) => s + (e.quantity || 1), 0);
      const kicks = evArr
        .filter((e) => e.rule_key === "penalty_kick" || e.rule_key === "conversion")
        .reduce((s, e) => s + (e.quantity || 1), 0);
      const actions = new Set(acArr.map((a) => a.action_id)).size;

      // Consecutive streaks for bench/king
      const matchEvents = evArr.filter((e) => e.rule_key === "on_the_bench" || e.rule_key === "starting_xv");
      const matchIds = [...new Set(matchEvents.map((e) => e.match_id).filter(Boolean))];
      let benchStreak = 0,
        kingStreak = 0,
        curBench = 0,
        curKing = 0;
      for (const mid of matchIds) {
        const me = matchEvents.filter((e) => e.match_id === mid);
        if (me.some((e) => e.rule_key === "on_the_bench")) {
          curBench++;
          curKing = 0;
        } else if (me.some((e) => e.rule_key === "starting_xv")) {
          curKing++;
          curBench = 0;
        } else {
          curBench = 0;
          curKing = 0;
        }
        if (curBench > benchStreak) benchStreak = curBench;
        if (curKing > kingStreak) kingStreak = curKing;
      }

      // Mete per match (for due_cuori / hat_trick / poker)
      const triesPerMatch = new Map<string, number>();
      evArr
        .filter((e) => e.rule_key === "try_scored" && e.match_id)
        .forEach((e) => {
          triesPerMatch.set(e.match_id, (triesPerMatch.get(e.match_id) || 0) + (e.quantity || 1));
        });
      const maxTriesInMatch = Math.max(0, ...Array.from(triesPerMatch.values()));

      // Training attendance for roccia/muro/scudo
      const trainAtt = evArr.filter((e) => e.rule_key === "training_attendance");
      const trainAbs = evArr.filter((e) => e.rule_key === "training_absence");

      // Group attendance by month (YYYY-MM)
      const monthsAllPresent = new Set<string>();
      const allMonths = new Set([
        ...trainAtt.map((e) => (e.inserted_at || e.created_at || "").slice(0, 7)),
        ...trainAbs.map((e) => (e.inserted_at || e.created_at || "").slice(0, 7)),
      ]);
      for (const m of allMonths) {
        if (
          m &&
          trainAbs.filter((e) => (e.inserted_at || e.created_at || "").startsWith(m)).length === 0 &&
          trainAtt.filter((e) => (e.inserted_at || e.created_at || "").startsWith(m)).length > 0
        ) {
          monthsAllPresent.add(m);
        }
      }
      // Consecutive months all-present
      const sortedMonths = [...monthsAllPresent].sort();
      let maxConsecMonths = 0,
        consecMonths = 1;
      for (let i = 1; i < sortedMonths.length; i++) {
        const [py, pm] = sortedMonths[i - 1].split("-").map(Number);
        const [cy, cm] = sortedMonths[i].split("-").map(Number);
        if (cy * 12 + cm === py * 12 + pm + 1) {
          consecMonths++;
        } else {
          consecMonths = 1;
        }
        if (consecMonths > maxConsecMonths) maxConsecMonths = consecMonths;
      }
      if (sortedMonths.length > 0 && maxConsecMonths === 0) maxConsecMonths = 1;

      // Scudo: attendance rate over the full season period (dynamic from activeSeason)
      const seasonStart = activeSeason?.starts_at ? new Date(activeSeason.starts_at) : new Date("2025-08-25");
      const seasonEnd = activeSeason?.ends_at ? new Date(activeSeason.ends_at) : new Date("2026-07-31");

      const inSeasonRange = (dateStr: string): boolean => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= seasonStart && d <= seasonEnd;
      };

      // Total season trainings in DB within season range
      const allSeasonTrainings = ((seasonTrainings as any[]) || []).filter((t) => inSeasonRange(t.training_date));
      const totalSeasonTrainings = allSeasonTrainings.length;

      // Attended trainings within season range
      const seasonAtt = trainAtt.filter((e) => inSeasonRange(e.inserted_at || e.created_at || "")).length;

      // Use total season trainings as denominator — future unregistered sessions count against you
      const attRate =
        totalSeasonTrainings > 0 ? Math.round((seasonAtt / totalSeasonTrainings) * 100) : seasonAtt > 0 ? 100 : 0;

      // Ironman: convocated in every match of the season
      // Ironman: player must be convocated in every match of the season
      // Denominator = total matches in DB for this player's category (not just tracked ones)
      let totalSeasonMatches = 0;
      if (playerCategory) {
        const { count } = await supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("category", playerCategory);
        totalSeasonMatches = count ?? 0;
      }
      const playedMatches = new Set(
        evArr
          .filter((e) => e.rule_key === "starting_xv" || e.rule_key === "on_the_bench")
          .map((e) => e.match_id)
          .filter(Boolean),
      ).size;
      const isIronman = totalSeasonMatches > 0 && playedMatches >= totalSeasonMatches;

      // ── Roccia: presences this month / total tracked (resets on any absence) ──
      const nowDate = new Date();
      const currentMonth = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
      const thisMonthAtt = trainAtt.filter((e) =>
        (e.inserted_at || e.created_at || "").startsWith(currentMonth),
      ).length;
      const thisMonthAbs = trainAbs.filter((e) =>
        (e.inserted_at || e.created_at || "").startsWith(currentMonth),
      ).length;
      const thisMonthTotal = thisMonthAtt + thisMonthAbs;
      const rocciaProgress = thisMonthAbs > 0 ? 0 : thisMonthAtt;
      const rocciaTotal = thisMonthTotal || 1;

      // ── Muro: current streak of consecutive all-present months (resets on any absence) ──
      const allTrackedMonths = [
        ...new Set([
          ...trainAtt.map((e) => (e.inserted_at || e.created_at || "").slice(0, 7)),
          ...trainAbs.map((e) => (e.inserted_at || e.created_at || "").slice(0, 7)),
        ]),
      ]
        .filter(Boolean)
        .sort();

      let muroStreak = 0;
      for (let i = allTrackedMonths.length - 1; i >= 0; i--) {
        const m = allTrackedMonths[i];
        const hasAbs = trainAbs.some((e) => (e.inserted_at || e.created_at || "").startsWith(m));
        if (hasAbs) break;
        const hasAtt = trainAtt.some((e) => (e.inserted_at || e.created_at || "").startsWith(m));
        if (hasAtt) muroStreak++;
        else break;
      }

      const prog: Record<string, number> = {
        metaman: tries,
        super_metaman: tries,
        mega_metaman: tries,
        motm_1: motm,
        motm_3: motm,
        cecchino: kicks,
        super_cecchino: kicks,
        joker: actions,
        bench: benchStreak,
        bomb_squad: benchStreak,
        king: kingStreak,
        super_king: kingStreak,
        due_cuori: maxTriesInMatch,
        hat_trick: maxTriesInMatch,
        poker: maxTriesInMatch,
        roccia: rocciaProgress,
        muro: muroStreak,
        scudo: attRate,
        ironman: playedMatches,
      };
      (prog as any).__rocciaTotal = rocciaTotal;
      (prog as any).__rocciaHasAbsence = thisMonthAbs > 0;
      (prog as any).__ironmanTotal = totalSeasonMatches;
      (prog as any).__scudoAtt = seasonAtt;
      (prog as any).__scudoTotal = totalSeasonTrainings;

      // Fanta role popularity
      const capCount = ((roleRows as any[]) || []).filter((r) => r.role === "captain").length;
      const talCount = ((roleRows as any[]) || []).filter((r) => r.role === "talisman").length;
      const silCount = ((roleRows as any[]) || []).filter((r) => r.role === "silverback").length;
      const totTeams = totalTeams ?? 1;
      (prog as any).__capCount = capCount;
      (prog as any).__talCount = talCount;
      (prog as any).__silCount = silCount;
      (prog as any).__totTeams = totTeams;

      // Add to prog for threshold comparison (threshold = 30 teams)
      prog.captain_popular = capCount;
      prog.talisman_popular = talCount;
      prog.silverback_popular = silCount;

      setProgress(prog);

      // Badges that must always be recalculated (their condition can regress)
      const ALWAYS_RECALC = new Set(["ironman", "roccia", "muro", "scudo"]);

      const dbEarned = new Set(((pb as EarnedBadge[]) || []).map((b) => b.badge_key));
      const localEarned = new Set<string>(dbEarned);
      const defs2 = (d as BadgeDef[]) || [];
      for (const def of defs2) {
        // For always-recalc badges: remove from localEarned first, then re-evaluate
        if (ALWAYS_RECALC.has(def.key)) {
          localEarned.delete(def.key);
        } else if (dbEarned.has(def.key)) {
          continue; // trust DB for stable badges
        }
        if (def.threshold !== null && def.threshold !== undefined) {
          if ((prog[def.key] ?? 0) >= def.threshold) localEarned.add(def.key);
        }
        if (def.key === "ironman" && isIronman) localEarned.add("ironman");
        else if (def.key === "ironman") localEarned.delete("ironman"); // explicitly remove if not earned
        if (def.key === "roccia" && thisMonthAbs === 0 && thisMonthAtt > 0 && thisMonthAtt >= thisMonthTotal)
          localEarned.add("roccia");
        else if (def.key === "roccia" && (thisMonthAbs > 0 || thisMonthAtt === 0)) localEarned.delete("roccia");
        if (def.key === "muro" && muroStreak >= 3) localEarned.add("muro");
        else if (def.key === "muro" && muroStreak < 3) localEarned.delete("muro");
      }
      setEarned(localEarned);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId, seasonId]);

  // Which badge info is expanded (mobile tap) — MUST be before any early return
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null);
  const toggleBadge = (key: string) => setExpandedBadge((prev) => (prev === key ? null : key));

  if (loading)
    return (
      <Card className="p-5">
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  if (defs.length === 0) return null;

  // Badge card — shared renderer
  const BadgeCard = ({ b }: { b: BadgeDef }) => {
    const got = earned.has(b.key);
    const prog = progress[b.key];
    const isExpanded = expandedBadge === b.key;
    return (
      <div className="flex flex-col flex-1 min-w-0">
        {/* Card */}
        <div
          className={cn(
            "rounded-lg border p-3 flex flex-col items-center text-center gap-1 transition relative",
            got
              ? "border-yellow-400 ring-2 ring-yellow-400/40 bg-yellow-50/40 dark:bg-yellow-500/5"
              : "border-muted grayscale opacity-70",
          )}
          title={b.description}
        >
          {/* ⓘ info button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleBadge(b.key);
            }}
            className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Info badge"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
          <div className="text-3xl leading-none">{b.emoji}</div>
          <div className={cn("text-xs font-medium leading-tight", got && "font-bold")}>{b.name}</div>
          {got ? (
            <div className="text-[10px] text-yellow-700 dark:text-yellow-400 font-semibold">✓ Conquistato</div>
          ) : b.key === "roccia" ? (
            <div className="text-[10px] text-muted-foreground">
              {(progress as any).__rocciaHasAbsence
                ? `0/${(progress as any).__rocciaTotal ?? "?"} ⚠️ assenza`
                : `${prog ?? 0}/${(progress as any).__rocciaTotal ?? "?"} allenamenti`}
            </div>
          ) : b.key === "muro" ? (
            <div className="text-[10px] text-muted-foreground">{prog ?? 0}/3 mesi consecutivi</div>
          ) : b.key === "scudo" ? (
            <div className="text-[10px] text-muted-foreground">
              {prog ?? 0}% — {(progress as any).__scudoAtt ?? 0}/{(progress as any).__scudoTotal ?? "?"} allenamenti
            </div>
          ) : b.key === "ironman" ? (
            <div className="text-[10px] text-muted-foreground">
              {prog ?? 0}/{(progress as any).__ironmanTotal ?? "?"}
            </div>
          ) : b.key === "captain_popular" ? (
            <div className="text-[10px] text-muted-foreground">
              {(progress as any).__capCount ?? 0} squadre
              {(progress as any).__totTeams > 0 &&
                ` (${Math.round((((progress as any).__capCount ?? 0) / (progress as any).__totTeams) * 100)}%)`}{" "}
              / min {b.threshold}
            </div>
          ) : b.key === "talisman_popular" ? (
            <div className="text-[10px] text-muted-foreground">
              {(progress as any).__talCount ?? 0} squadre
              {(progress as any).__totTeams > 0 &&
                ` (${Math.round((((progress as any).__talCount ?? 0) / (progress as any).__totTeams) * 100)}%)`}{" "}
              / min {b.threshold}
            </div>
          ) : b.key === "silverback_popular" ? (
            <div className="text-[10px] text-muted-foreground">
              {(progress as any).__silCount ?? 0} squadre
              {(progress as any).__totTeams > 0 &&
                ` (${Math.round((((progress as any).__silCount ?? 0) / (progress as any).__totTeams) * 100)}%)`}{" "}
              / min {b.threshold}
            </div>
          ) : prog !== undefined && b.threshold ? (
            <div className="text-[10px] text-muted-foreground">
              {prog}/{b.threshold}
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">In valutazione</div>
          )}
        </div>
        {/* Inline description — expands on tap */}
        {isExpanded && (
          <div className="mt-1 rounded-md bg-muted/60 border border-muted px-2 py-1.5 text-[10px] text-muted-foreground leading-snug text-center">
            {b.description}
          </div>
        )}
      </div>
    );
  };

  // Helper: render a row of badges with equal width, left-aligned
  const BadgeRow = ({ keys }: { keys: string[] }) => {
    const items = keys.map((k) => defs.find((d) => d.key === k)).filter(Boolean) as BadgeDef[];
    if (items.length === 0) return null;
    return (
      <div className="flex gap-3 items-start">
        {items.map((b) => (
          <BadgeCard key={b.key} b={b} />
        ))}
        {Array.from({ length: 3 - items.length }).map((_, i) => (
          <div key={`empty-${i}`} className="flex-1 min-w-0" />
        ))}
      </div>
    );
  };

  const byKey = new Map(defs.map((d) => [d.key, d]));
  const fantas = ["captain_popular", "talisman_popular", "silverback_popular"]
    .map((k) => byKey.get(k))
    .filter(Boolean) as BadgeDef[];
  const motms = ["motm_1", "motm_3"].map((k) => byKey.get(k)).filter(Boolean) as BadgeDef[];
  const speciali = ["joker"].map((k) => byKey.get(k)).filter(Boolean) as BadgeDef[];
  const piazzati = ["cecchino", "super_cecchino"].map((k) => byKey.get(k)).filter(Boolean) as BadgeDef[];

  return (
    <Card className="p-5 space-y-5">
      <h3 className="font-semibold text-lg">🏅 I miei badge</h3>

      {/* FANTA */}
      {fantas.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fanta</div>
          <div className="flex gap-3">
            {fantas.map((b) => (
              <BadgeCard key={b.key} b={b} />
            ))}
          </div>
        </div>
      )}

      {/* METE & PARTITA — rows of 3 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mete &amp; Partita</div>
        <BadgeRow keys={["metaman", "super_metaman", "mega_metaman"]} />
        <BadgeRow keys={["due_cuori", "hat_trick", "poker"]} />
      </div>

      {/* MOTM */}
      {motms.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MOTM</div>
          <BadgeRow keys={["motm_1", "motm_3"]} />
        </div>
      )}

      {/* PRESENZE — fixed rows */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Presenze</div>
        <BadgeRow keys={["roccia", "muro", "scudo"]} />
        <BadgeRow keys={["bench", "bomb_squad"]} />
        <BadgeRow keys={["king", "super_king", "ironman"]} />
      </div>

      {/* SPECIALI */}
      {speciali.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Speciali</div>
          <BadgeRow keys={["joker"]} />
        </div>
      )}

      {/* PIAZZATI */}
      {piazzati.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Piazzati</div>
          <BadgeRow keys={["cecchino", "super_cecchino"]} />
        </div>
      )}
    </Card>
  );
}

/* ---------------- Player profile / matches ---------------- */

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

type MatchRow = {
  id: string;
  match_date: string;
  match_time?: string | null;
  opponent: string;
  status: string;
  home_away?: "home" | "away" | null;
  notes?: string | null;
};

function formatMatch(homeAway: "home" | "away", opponent: string): string {
  return homeAway === "home" ? `Lambro vs ${opponent}` : `${opponent} vs Lambro`;
}

function PlayerProfileCard({ player }: { player: ClaimedPlayer }) {
  const { seasonId } = useSeason();
  const [isMotm, setIsMotm] = useState(false);
  const [nextMatchDate, setNextMatchDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Latest week in current season
      let weekQ = supabase.from("weekly_events").select("week").order("week", { ascending: false }).limit(1);
      if (seasonId) weekQ = weekQ.eq("season_id", seasonId) as any;
      const { data: wk } = await weekQ;
      const maxWeek = (wk?.[0] as any)?.week ?? null;
      let motm = false;
      if (maxWeek != null) {
        let q = supabase
          .from("weekly_events")
          .select("id")
          .eq("player_id", player.id)
          .eq("rule_key", "motm")
          .eq("week", maxWeek)
          .limit(1);
        if (seasonId) q = q.eq("season_id", seasonId) as any;
        const { data } = await q;
        motm = (data || []).length > 0;
      }
      const today = new Date().toISOString().slice(0, 10);
      const { data: nm } = await supabase
        .from("matches")
        .select("match_date")
        .eq("category", player.category)
        .gte("match_date", today)
        .order("match_date", { ascending: true })
        .limit(1);
      if (cancelled) return;
      setIsMotm(motm);
      setNextMatchDate((nm?.[0] as any)?.match_date ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [player.id, player.category, seasonId]);

  let showSticker = isMotm;
  if (showSticker && nextMatchDate) {
    const md = new Date(nextMatchDate + "T00:00:00");
    const dow = md.getDay(); // 0 Sun ... 6 Sat
    const daysBack = dow === 6 ? 7 : dow + 1;
    const satBefore = new Date(md);
    satBefore.setDate(md.getDate() - daysBack);
    satBefore.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today >= satBefore) showSticker = false;
  }

  const ringClass = showSticker ? "ring-4 ring-yellow-400" : "ring-4 ring-primary/20";

  return (
    <Card className="p-5 flex flex-col items-center text-center gap-4">
      <div className="relative shrink-0 mx-auto">
        {player.photo_url ? (
          <img
            src={player.photo_url}
            alt={player.full_name}
            className={cn("h-32 w-32 md:h-36 md:w-36 rounded-full object-cover", ringClass)}
          />
        ) : (
          <div
            className={cn(
              "h-32 w-32 md:h-36 md:w-36 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground",
              ringClass,
            )}
          >
            {initialsOf(player.full_name)}
          </div>
        )}
        {showSticker && (
          <span
            className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-base shadow-md ring-2 ring-background"
            title="Man of the Match"
          >
            🐐
          </span>
        )}
      </div>
      <div>
        <div className="font-semibold truncate">{player.full_name}</div>
        <div className="text-sm text-muted-foreground">
          {player.category} · {player.role}
        </div>
        {showSticker && (
          <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5 font-medium">⭐ Man of the Match</div>
        )}
      </div>
    </Card>
  );
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function dowLabel(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("it-IT", { weekday: "long" });
}

function NextMatchCard({ category }: { category: string }) {
  const [match, setMatch] = useState<MatchRow | null | undefined>(undefined);
  const [showCallups, setShowCallups] = useState(false);
  const [callups, setCallups] = useState<{ full_name: string; role: string; jersey_number: number | null }[]>([]);
  const [callupsLoaded, setCallupsLoaded] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      let { data } = await supabase
        .from("matches")
        .select("id,match_date,match_time,opponent,status,home_away")
        .eq("category", category)
        .gte("match_date", today)
        .order("match_date", { ascending: true })
        .limit(1);
      if (!data || data.length === 0) {
        const { data: data2 } = await supabase
          .from("matches")
          .select("id,match_date,match_time,opponent,status,home_away")
          .ilike("category", category)
          .gte("match_date", today)
          .order("match_date", { ascending: true })
          .limit(1);
        data = data2;
      }
      if (!data || data.length === 0) {
        const { data: data3 } = await supabase
          .from("matches")
          .select("id,match_date,match_time,opponent,status,home_away")
          .gte("match_date", today)
          .order("match_date", { ascending: true })
          .limit(1);
        data = data3;
      }
      setMatch((data?.[0] as any as MatchRow) || null);
    })();
  }, [category]);

  const loadCallups = async (matchId: string) => {
    if (callupsLoaded) return;
    const { data } = await supabase
      .from("weekly_events")
      .select("player_id, rule_key, jersey_number, players!inner(full_name)")
      .eq("match_id", matchId)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
    const list = ((data || []) as any[])
      .map((r) => ({
        full_name: r.players?.full_name ?? "—",
        role: r.rule_key === "starting_xv" ? "Titolare" : r.rule_key === "on_the_bench" ? "Panchina" : "Guardalinee",
        jersey_number: r.jersey_number ?? null,
      }))
      .sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
    setCallups(list);
    setCallupsLoaded(true);
  };

  const toggleCallups = () => {
    if (!showCallups && match && !callupsLoaded) loadCallups((match as any).id);
    setShowCallups((s) => !s);
  };

  return (
    <Card className="p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-3">📅 Prossima partita</h3>
      {match === undefined ? (
        <Skeleton className="h-12 w-full" />
      ) : !match ? (
        <p className="text-sm text-muted-foreground">Nessuna partita in programma</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground capitalize">{dowLabel(match.match_date)}</div>
              <div className="font-semibold text-lg">{fmtDate(match.match_date)}</div>
              <div className="text-sm mt-1">
                {formatMatch(match.home_away ?? "home", match.opponent)}
                {(match as any).match_time && (
                  <span className="text-muted-foreground"> · {(match as any).match_time.slice(0, 5)}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={match.home_away === "home" ? "default" : "outline"} className="gap-1">
                <MapPin className="h-3 w-3" />
                {match.home_away === "home" ? "Casa" : "Trasferta"}
              </Badge>
              <button
                type="button"
                onClick={toggleCallups}
                className="text-xs text-primary underline-offset-2 hover:underline flex items-center gap-1"
              >
                <Users className="h-3 w-3" />
                {showCallups ? "Nascondi convocati" : "Vedi convocati"}
              </button>
            </div>
          </div>
          {showCallups && (
            <div className="border rounded-md overflow-hidden">
              {callups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Convocati non ancora pubblicati</p>
              ) : (
                <ul className="divide-y">
                  {callups.map((c, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                      {c.jersey_number != null && (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                          {c.jersey_number}
                        </span>
                      )}
                      <span className="flex-1 font-medium">{c.full_name}</span>
                      <Badge
                        variant={c.role === "Titolare" ? "default" : c.role === "Panchina" ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {c.role}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function resultBadge(status: string) {
  if (status === "won") return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">V</Badge>;
  if (status === "draw") return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15">P</Badge>;
  if (status === "loss" || status === "lost")
    return <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">S</Badge>;
  return null;
}

/* ── Player Match Calendar — grid view only, no editing ───────────────────── */

const MONTH_NAMES_PLAYER = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
const DOW_LABELS_PLAYER = ["L", "M", "M", "G", "V", "S", "D"];

function fmtLocalPlayer(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

type PlayerCalendarTraining = {
  id: string;
  training_date: string;
  start_time: string | null;
  location: string | null;
};

function MatchCalendarCard({ category }: { category: string }) {
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [monthMatches, setMonthMatches] = useState<MatchRow[]>([]);
  const [monthTrainings, setMonthTrainings] = useState<PlayerCalendarTraining[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const todayStr = fmtLocalPlayer(new Date());

  // Load matches + trainings for current month
  useEffect(() => {
    const y = calMonth.getFullYear();
    const mo = calMonth.getMonth();
    const first = fmtLocalPlayer(new Date(y, mo, 1));
    const last = fmtLocalPlayer(new Date(y, mo + 1, 0));

    (async () => {
      // Matches
      let { data: mData } = await supabase
        .from("matches")
        .select("id,match_date,match_time,opponent,status,home_away")
        .eq("category", category)
        .gte("match_date", first)
        .lte("match_date", last)
        .order("match_date", { ascending: true });
      if (!mData || mData.length === 0) {
        const { data: d2 } = await supabase
          .from("matches")
          .select("id,match_date,match_time,opponent,status,home_away")
          .ilike("category", category)
          .gte("match_date", first)
          .lte("match_date", last)
          .order("match_date", { ascending: true });
        mData = d2;
      }
      setMonthMatches(((mData as any[]) || []) as MatchRow[]);

      // Trainings
      const { data: tData } = await supabase
        .from("trainings")
        .select("id,training_date,start_time,location")
        .eq("category", category)
        .gte("training_date", first)
        .lte("training_date", last)
        .order("training_date", { ascending: true });
      setMonthTrainings(((tData as any[]) || []) as PlayerCalendarTraining[]);
    })();
  }, [calMonth, category]);

  // Build grid cells
  const year = calMonth.getFullYear();
  const mo = calMonth.getMonth();
  const first = new Date(year, mo, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(year, mo, 1 - startOffset);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === mo });
  }

  const matchByDate = new Map(monthMatches.map((m) => [m.match_date, m]));
  const trainingByDate = new Map(monthTrainings.map((t) => [t.training_date, t]));

  const selectedMatch = selectedDate ? (matchByDate.get(selectedDate) ?? null) : null;
  const selectedTraining = selectedDate ? (trainingByDate.get(selectedDate) ?? null) : null;
  const hasDetail = selectedMatch || selectedTraining;

  // Callups for selected match (lazy loaded)
  const [showCallups, setShowCallups] = useState(false);
  const [callups, setCallups] = useState<{ full_name: string; role: string; jersey_number: number | null }[]>([]);
  const [callupsMatchId, setCallupsMatchId] = useState<string | null>(null);

  // Reset callups when selected date changes
  useEffect(() => {
    setShowCallups(false);
    setCallups([]);
    setCallupsMatchId(null);
  }, [selectedDate]);

  const loadCallupsForMatch = async (matchId: string) => {
    if (callupsMatchId === matchId) return;
    const { data } = await supabase
      .from("weekly_events")
      .select("player_id, rule_key, jersey_number, players!inner(full_name)")
      .eq("match_id", matchId)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
    const list = ((data || []) as any[])
      .map((r) => ({
        full_name: r.players?.full_name ?? "—",
        role: r.rule_key === "starting_xv" ? "Titolare" : r.rule_key === "on_the_bench" ? "Panchina" : "Guardalinee",
        jersey_number: r.jersey_number ?? null,
      }))
      .sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
    setCallups(list);
    setCallupsMatchId(matchId);
  };

  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <CalIcon className="h-4 w-4" /> Calendario stagione
      </h3>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
            setSelectedDate(null);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-sm">
          {MONTH_NAMES_PLAYER[mo]} {year}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
            setSelectedDate(null);
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {DOW_LABELS_PLAYER.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }, i) => {
          const ds = fmtLocalPlayer(date);
          const match = matchByDate.get(ds);
          const training = trainingByDate.get(ds);
          const isToday = ds === todayStr;
          const isPast = ds < todayStr;
          const isSelected = selectedDate === ds;
          const isClickable = !!(match || training);

          return (
            <button
              key={i}
              type="button"
              onClick={() => (isClickable ? setSelectedDate(isSelected ? null : ds) : undefined)}
              className={cn(
                "relative rounded-md border text-left p-1 transition h-10 md:h-14 text-[11px]",
                inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                isToday ? "ring-2 ring-primary" : "",
                isSelected ? "ring-2 ring-blue-400" : "",
                isClickable ? "cursor-pointer hover:bg-muted/40" : "cursor-default",
              )}
            >
              <div className={cn("font-medium", !inMonth && "opacity-50")}>{date.getDate()}</div>
              {(match || training) && (
                <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                  {training && (
                    <div className="flex items-center gap-0.5">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500" />
                    </div>
                  )}
                  {match && (
                    <div className="flex items-center gap-0.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          match.status === "won"
                            ? "bg-emerald-500"
                            : match.status === "lost"
                              ? "bg-red-500"
                              : match.status === "draw"
                                ? "bg-amber-500"
                                : isPast
                                  ? "bg-muted-foreground/50"
                                  : "bg-blue-500",
                        )}
                      />
                      <span className="hidden md:inline text-[9px] text-blue-600 dark:text-blue-400 truncate leading-none">
                        Match
                      </span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {hasDetail && selectedDate && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground capitalize">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Training row */}
          {selectedTraining && (
            <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-2.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  🏋️ Allenamento
                  {selectedTraining.start_time && ` · ${selectedTraining.start_time.slice(0, 5)}`}
                </div>
                {selectedTraining.location && (
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" /> {selectedTraining.location}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Match row */}
          {selectedMatch && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-md border p-2.5",
                selectedMatch.status === "won"
                  ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : selectedMatch.status === "lost"
                    ? "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800"
                    : selectedMatch.status === "draw"
                      ? "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800"
                      : "border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0 mt-1",
                  selectedMatch.status === "won"
                    ? "bg-emerald-500"
                    : selectedMatch.status === "lost"
                      ? "bg-red-500"
                      : selectedMatch.status === "draw"
                        ? "bg-amber-500"
                        : "bg-blue-500",
                )}
              />
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-sm font-semibold",
                    selectedMatch.status === "won"
                      ? "text-emerald-800 dark:text-emerald-300"
                      : selectedMatch.status === "lost"
                        ? "text-red-800 dark:text-red-300"
                        : selectedMatch.status === "draw"
                          ? "text-amber-800 dark:text-amber-300"
                          : "text-blue-800 dark:text-blue-300",
                  )}
                >
                  ⚔️ Match
                  {(selectedMatch as any).match_time ? ` · ${(selectedMatch as any).match_time.slice(0, 5)}` : ""}
                </div>
                <div className="text-sm font-medium mt-0.5">
                  {formatMatch(selectedMatch.home_away ?? "home", selectedMatch.opponent)}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant={selectedMatch.home_away === "home" ? "default" : "outline"} className="gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    {selectedMatch.home_away === "home" ? "Casa" : "Trasferta"}
                  </Badge>
                  {selectedMatch.status === "won" && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 text-xs">
                      🏆 Vittoria
                    </Badge>
                  )}
                  {selectedMatch.status === "lost" && (
                    <Badge className="bg-red-500/15 text-red-700 hover:bg-red-500/15 text-xs">💔 Sconfitta</Badge>
                  )}
                  {selectedMatch.status === "draw" && (
                    <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 text-xs">🤝 Pareggio</Badge>
                  )}
                  {(!selectedMatch.status || selectedMatch.status === "scheduled") && (
                    <Badge variant="outline" className="text-xs">
                      📅 Programmata
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const mid = (selectedMatch as any).id;
                      if (!showCallups) loadCallupsForMatch(mid);
                      setShowCallups((s) => !s);
                    }}
                    className="text-xs text-primary underline-offset-2 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Users className="h-3 w-3" />
                    {showCallups ? "Nascondi convocati" : "Vedi convocati"}
                  </button>
                </div>
                {showCallups && (
                  <div className="mt-2 border rounded-md overflow-hidden">
                    {callups.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">Convocati non ancora pubblicati</p>
                    ) : (
                      <ul className="divide-y">
                        {callups.map((c, i) => (
                          <li key={i} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                            {c.jersey_number != null && (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                {c.jersey_number}
                              </span>
                            )}
                            <span className="flex-1 font-medium">{c.full_name}</span>
                            <Badge
                              variant={
                                c.role === "Titolare" ? "default" : c.role === "Panchina" ? "secondary" : "outline"
                              }
                              className="text-xs"
                            >
                              {c.role}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1 border-t text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Allenamento
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Prossima partita
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Pareggio
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Sconfitta
        </span>
      </div>
    </Card>
  );
}

function AbsenceCard({ player, userId }: { player: ClaimedPlayer; userId: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const submit = async () => {
    if (!date) return toast.error("Seleziona una data");
    if (justification.trim().length < 10) return toast.error("Inserisci una giustificazione di almeno 10 caratteri");
    setSubmitting(true);
    const { error } = await supabase.from("training_absences" as any).insert({
      player_id: player.id,
      user_id: userId,
      training_date: date,
      justification: justification.trim(),
      category: player.category,
    });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    // Fire-and-forget push notification
    supabase.functions
      .invoke("process-event-notifications", {
        body: { eventTrigger: "training_absence_reported", category: player.category },
      })
      .catch(() => {});
    setSubmitting(false);
    setOpen(false);
    setDate("");
    setJustification("");
    toast.success("Assenza comunicata ✓ — i tuoi allenatori sono stati avvisati.");
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <CalIcon className="h-4 w-4" /> Comunica un'assenza
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Avvisa lo staff se non potrai partecipare a un allenamento.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>📅 Comunica assenza</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Comunica assenza allenamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="abs-date">Data allenamento</Label>
                <Input
                  id="abs-date"
                  type="date"
                  min={minDate}
                  max={maxDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="abs-just">Giustificazione</Label>
                <Textarea
                  id="abs-just"
                  placeholder="es. impegno scolastico, infortunio, lavoro…"
                  rows={4}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimo 10 caratteri ({justification.trim().length}/10)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Invio…" : "Invia"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}

function TopFiveCard({ topTeams }: { topTeams: TeamScore[] }) {
  const { crewSlug } = useCrew();
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Top 5 Fanta
        </h3>
        <Button asChild variant="ghost" size="sm">
          <Link to="/$crewSlug/leaderboard" params={{ crewSlug }}>Vedi classifica</Link>
        </Button>
      </div>
      {topTeams.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna squadra ancora.</p>
      ) : (
        <ol className="space-y-1.5">
          {topTeams.map((t, i) => (
            <li key={t.team_id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    i === 0
                      ? "bg-yellow-400 text-black"
                      : i === 1
                        ? "bg-zinc-300 text-black"
                        : i === 2
                          ? "bg-amber-700 text-white"
                          : "bg-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span className="font-medium">{t.team_name}</span>
                <span className="text-muted-foreground text-xs">· {t.manager_name}</span>
              </span>
              <span className="font-semibold">{t.total} pt</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ---------------- Coach matches helpers ---------------- */

type Match = {
  id: string;
  category: string;
  match_date: string;
  match_time?: string | null;
  week: number;
  opponent: string;
  status: string;
  home_away?: "home" | "away";
};
type CallUpRole = "starter" | "bench" | "linesman" | "out";

function formatCoachMatch(homeAway: "home" | "away", opponent: string): string {
  return homeAway === "home" ? `Lambro vs ${opponent}` : `${opponent} vs Lambro`;
}

/* ---------------- Coach presenze helpers ---------------- */

type CoachTraining = {
  id: string;
  training_date: string;
  start_time: string | null;
  location: string | null;
  category: string;
};

type CoachCalendarMatch = {
  id: string;
  match_date: string;
  match_time?: string | null;
  week?: number;
  opponent: string;
  status: string;
  home_away?: "home" | "away";
};

const MONTH_NAMES_COACH = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
const DOW_LABELS_COACH = ["L", "M", "M", "G", "V", "S", "D"];

function fmtLocalCoach(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function generateCoachTrainingDates(days: number[]): string[] {
  if (!days?.length) return [];
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 11, 31);
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (days.includes(d.getDay())) out.push(fmtLocalCoach(d));
  }
  return out;
}

function CoachCalendarGrid({
  month,
  trainings,
  scheduledDates,
  matches,
  selectedDate,
  onDayClick,
  onPrevMonth,
  onNextMonth,
}: {
  month: Date;
  trainings: CoachTraining[];
  scheduledDates: string[];
  matches: CoachCalendarMatch[];
  selectedDate: string | null;
  onDayClick: (d: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const todayStr = fmtLocalCoach(new Date());
  const trainingByDate = new Map(trainings.map((t) => [t.training_date, t]));
  const matchByDate = new Map(matches.map((mx) => [mx.match_date, mx]));
  const scheduledSet = new Set(scheduledDates);
  const first = new Date(year, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, m, 1 - startOffset);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === m });
  }
  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold text-sm">
          {MONTH_NAMES_COACH[m]} {year}
        </div>
        <Button variant="outline" size="sm" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {DOW_LABELS_COACH.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }, i) => {
          const ds = fmtLocalCoach(date);
          const t = trainingByDate.get(ds);
          const scheduled = scheduledSet.has(ds);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(ds)}
              className={cn(
                "relative rounded-md border text-left p-1 transition h-10 md:h-14 text-[11px]",
                inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                isToday ? "ring-2 ring-primary" : "",
                isSelected ? "ring-2 ring-primary/60" : "",
                "hover:bg-muted/40",
              )}
            >
              <div className="font-medium">{date.getDate()}</div>
              {(t || scheduled || matchByDate.get(ds)) && (
                <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                  {(t || scheduled) && (
                    <div className="flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${t ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                      />
                      <span className="hidden md:inline text-[10px] text-emerald-700 dark:text-emerald-400 truncate font-medium">
                        {t ? "Allenamento" : ""}
                      </span>
                    </div>
                  )}
                  {matchByDate.get(ds) && (
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full shrink-0 bg-blue-500" />
                      <span className="hidden md:inline text-[10px] text-blue-600 dark:text-blue-400 truncate font-medium">
                        Match
                      </span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function CoachPresenzeCard({ category }: { category: string }) {
  const { user } = useAuth();
  const { seasonId, activeSeason } = useSeason();
  const { categories } = useCategories();
  const cat = categories.find((c) => c.name === category);
  const dates = useMemo(() => generateCoachTrainingDates(cat?.training_days || []), [cat?.training_days]);

  const [date, setDate] = useState<string>("");
  const [players, setPlayers] = useState<{ id: string; full_name: string }[]>([]);
  const trainingId = `${date}|${category}`;
  const [presentArr, setPresentArr, clearPresent] = useDraftState<string[]>(`coach_draft_attendance_${trainingId}`, []);
  const present = useMemo(() => new Set(presentArr), [presentArr]);
  const [existing, setExisting] = useState<Map<string, "training_attendance" | "training_absence">>(new Map());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const isPastDate = !!selectedDate && selectedDate < fmtLocalCoach(new Date());
  const [isEditingPast, setIsEditingPast] = useState(false);
  const [monthTrainings, setMonthTrainings] = useState<CoachTraining[]>([]);
  const [monthMatches, setMonthMatches] = useState<CoachCalendarMatch[]>([]);

  // ── Match panel state (convocazioni + risultato nel calendario) ──
  const selectedMatch = selectedDate ? (monthMatches.find((m) => m.match_date === selectedDate) ?? null) : null;
  const matchDraftKey = selectedMatch ? `draft_convocations_${selectedMatch.id}` : "__none__";
  const [matchPicks, setMatchPicks, clearMatchPicks] = useDraftState<Record<string, string>>(matchDraftKey, {});
  const matchJerseyKey = selectedMatch ? `draft_jerseys_${selectedMatch.id}` : "__none__";
  const [matchJerseys, setMatchJerseys, clearMatchJerseys] = useDraftState<Record<string, number>>(matchJerseyKey, {});
  const [matchConvCounts, setMatchConvCounts] = useState<Record<string, number>>({});
  const [matchSaving, setMatchSaving] = useState(false);
  const [matchEditing, setMatchEditing] = useState(false);
  const [matchDirty, setMatchDirty] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);

  const reloadMonthMatches = () => {
    if (!category) return;
    const y = calMonth.getFullYear();
    const mo = calMonth.getMonth();
    const first = fmtLocalCoach(new Date(y, mo, 1));
    const last = fmtLocalCoach(new Date(y, mo + 1, 0));
    supabase
      .from("matches")
      .select("id,match_date,match_time,week,opponent,status,home_away")
      .eq("category", category)
      .gte("match_date", first)
      .lte("match_date", last)
      .then(({ data }) => setMonthMatches(((data as any[]) || []) as CoachCalendarMatch[]));
  };

  // Always load from DB when a match is selected
  useEffect(() => {
    if (!selectedMatch) {
      setMatchEditing(false);
      setMatchDirty(false);
      return;
    }
    setMatchEditing(false);
    setMatchDirty(false);
    setMatchLoading(true);
    supabase
      .from("weekly_events")
      .select("player_id,rule_key,jersey_number")
      .eq("match_id", selectedMatch.id)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"])
      .then(({ data }) => {
        const next: Record<string, string> = {};
        const jerseyInit: Record<string, number> = {};
        (data || []).forEach((r: any) => {
          next[r.player_id] =
            r.rule_key === "starting_xv" ? "starter" : r.rule_key === "on_the_bench" ? "bench" : "linesman";
          if (r.jersey_number) jerseyInit[r.player_id] = r.jersey_number;
        });
        setMatchPicks(next);
        setMatchJerseys(jerseyInit);
        setMatchConvCounts((prev) => ({ ...prev, [selectedMatch.id]: Object.keys(next).length }));
        setMatchLoading(false);
        setMatchDirty(false);
        if (Object.keys(next).length === 0) setMatchEditing(true);
      });
  }, [selectedMatch?.id]);

  const saveMatchCallups = async () => {
    if (!selectedMatch) return;
    const mx = selectedMatch as any;
    setMatchSaving(true);
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", mx.id)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
    const rows: any[] = Object.entries(matchPicks)
      .filter(([_k, r]) => r !== "out")
      .map(([player_id, role]) => ({
        player_id,
        rule_key: role === "starter" ? "starting_xv" : role === "bench" ? "on_the_bench" : "linesman_call",
        week: mx.week,
        quantity: 1,
        match_id: mx.id,
        season: SEASON,
        season_id: seasonId ?? null,
        notes: `match:${mx.id}`,
        inserted_by: user?.id ?? null,
        inserted_at: new Date().toISOString(),
        jersey_number: matchJerseys[player_id] ?? null,
      }));
    if (rows.length) {
      const { error } = await supabase.from("weekly_events").insert(rows);
      if (error) {
        setMatchSaving(false);
        return toast.error(error.message);
      }
    }
    if (mx.status === "won" || mx.status === "draw" || mx.status === "lost") {
      await supabase
        .from("weekly_events")
        .delete()
        .eq("match_id", mx.id)
        .in("rule_key", ["match_win", "match_draw", "match_loss"]);
      const rule_key = mx.status === "won" ? "match_win" : mx.status === "draw" ? "match_draw" : "match_loss";
      const conv = Object.entries(matchPicks)
        .filter(([_k, r]) => r === "starter" || r === "bench")
        .map(([player_id]) => ({
          player_id,
          rule_key,
          week: mx.week,
          quantity: 1,
          match_id: mx.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${mx.id}`,
          inserted_by: user?.id ?? null,
          inserted_at: new Date().toISOString(),
        }));
      if (conv.length) await supabase.from("weekly_events").insert(conv);
    }
    setMatchSaving(false);
    toast.success(`Convocazioni salvate (${rows.length})`);
    clearMatchPicks();
    clearMatchJerseys();
    setMatchDirty(false);
    setMatchEditing(false);
    setMatchConvCounts((prev) => ({ ...prev, [mx.id]: rows.length }));
  };

  const setMatchStatus = async (status: "won" | "draw" | "lost" | "scheduled") => {
    if (!selectedMatch) return;
    const mx = selectedMatch as any;
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", mx.id)
      .in("rule_key", ["match_win", "match_loss", "match_draw"]);
    if (status !== "scheduled") {
      const { data: callups } = await supabase
        .from("weekly_events")
        .select("player_id")
        .eq("match_id", mx.id)
        .in("rule_key", ["starting_xv", "on_the_bench"]);
      const playerIds = Array.from(new Set((callups || []).map((r: any) => r.player_id)));
      const rule_key = status === "won" ? "match_win" : status === "draw" ? "match_draw" : "match_loss";
      if (playerIds.length) {
        const rows = playerIds.map((player_id) => ({
          player_id,
          rule_key,
          week: mx.week,
          quantity: 1,
          match_id: mx.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${mx.id}`,
          inserted_by: user?.id ?? null,
          inserted_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("weekly_events").insert(rows);
        if (error) return toast.error(error.message);
      }
    }
    const { error } = await supabase.from("matches").update({ status }).eq("id", mx.id);
    if (error) return toast.error(error.message);
    toast.success(
      status === "won"
        ? "Vittoria"
        : status === "draw"
          ? "Pareggio"
          : status === "lost"
            ? "Sconfitta"
            : "Risultato azzerato",
    );
    reloadMonthMatches();
  };

  useEffect(() => {
    if (!category) return;
    const y = calMonth.getFullYear();
    const mo = calMonth.getMonth();
    const first = fmtLocalCoach(new Date(y, mo, 1));
    const last = fmtLocalCoach(new Date(y, mo + 1, 0));
    supabase
      .from("trainings")
      .select("id,training_date,start_time,location,category")
      .eq("category", category)
      .gte("training_date", first)
      .lte("training_date", last)
      .then(({ data }) => setMonthTrainings((data as CoachTraining[]) || []));
    supabase
      .from("matches")
      .select("id,match_date,match_time,week,opponent,status,home_away")
      .eq("category", category)
      .gte("match_date", first)
      .lte("match_date", last)
      .then(({ data }) => setMonthMatches((data as CoachCalendarMatch[]) || []));
  }, [calMonth, category]);

  useEffect(() => {
    supabase
      .from("players")
      .select("id,full_name")
      .eq("category", category)
      .order("full_name")
      .then(({ data }) => setPlayers(data || []));
  }, [category]);

  useEffect(() => {
    if (!date || !category) return;
    (async () => {
      const tid = `${date}|${category}`;
      const { data } = await supabase
        .from("weekly_events")
        .select("player_id,rule_key")
        .eq("training_id", tid)
        .in("rule_key", ["training_attendance", "training_absence"]);
      const map = new Map<string, "training_attendance" | "training_absence">();
      (data || []).forEach((r: any) => map.set(r.player_id, r.rule_key));
      setExisting(map);
      const draft = localStorage.getItem(`coach_draft_attendance_${tid}`);
      if (!draft) {
        setPresentArr(
          (data || []).filter((r: any) => r.rule_key === "training_attendance").map((r: any) => r.player_id),
        );
        setDirty(false);
      } else {
        setDirty(true);
      }
    })();
  }, [date, category]);

  const toggle = (id: string) => {
    const next = new Set(present);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPresentArr([...next]);
    setDirty(true);
  };

  const save = async () => {
    if (!date) return toast.error("Seleziona una data");
    setSaving(true);
    const week = weekOf(date, activeSeason?.starts_at);
    const tid = `${date}|${category}`;
    const nowIso = new Date().toISOString();

    // Compute only players whose status has changed
    const changed = players.filter((p) => {
      const prev = existing.get(p.id);
      const next = present.has(p.id) ? "training_attendance" : "training_absence";
      return prev !== next;
    });

    if (changed.length === 0) {
      setSaving(false);
      toast.info("Nessuna variazione da salvare");
      clearPresent();
      setDirty(false);
      setIsEditingPast(false);
      return;
    }

    // Delete only changed rows, then insert new ones (preserves created_at for unchanged)
    const changedIds = changed.map((p) => p.id);
    await supabase
      .from("weekly_events")
      .delete()
      .in("rule_key", ["training_attendance", "training_absence"])
      .eq("training_id", tid)
      .in("player_id", changedIds);

    const rows = changed.map((p) => ({
      player_id: p.id,
      rule_key: present.has(p.id) ? "training_attendance" : "training_absence",
      week,
      quantity: 1,
      notes: `training:${date}|${category}`,
      training_id: tid,
      season: SEASON,
      season_id: seasonId ?? null,
      inserted_by: user?.id ?? null,
      inserted_at: nowIso,
    }));
    const { error } = await supabase.from("weekly_events").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    const added = changed.filter((p) => present.has(p.id)).length;
    const removed = changed.filter((p) => !present.has(p.id)).length;
    const parts = [];
    if (added) parts.push(`+${added} presenti`);
    if (removed) parts.push(`-${removed} assenti`);
    toast.success(`Aggiornate: ${parts.join(", ")} (${changed.length} variazioni)`);
    clearPresent();
    const { data: refreshed } = await supabase
      .from("weekly_events")
      .select("player_id,rule_key")
      .eq("training_id", tid)
      .in("rule_key", ["training_attendance", "training_absence"]);
    const map = new Map<string, "training_attendance" | "training_absence">();
    (refreshed || []).forEach((r: any) => map.set(r.player_id, r.rule_key));
    setExisting(map);
    setPresentArr(
      (refreshed || []).filter((r: any) => r.rule_key === "training_attendance").map((r: any) => r.player_id),
    );
    setDirty(false);
    setIsEditingPast(false);
  };

  const filtered = players.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <CalIcon className="h-4 w-4" /> Calendario
      </h3>
      <CoachCalendarGrid
        month={calMonth}
        trainings={monthTrainings}
        scheduledDates={dates}
        matches={monthMatches}
        selectedDate={selectedDate}
        onDayClick={(d) => {
          setSelectedDate(d);
          setDate(d);
          setIsEditingPast(false);
        }}
        onPrevMonth={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        onNextMonth={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
      />
      {selectedDate && (
        <div
          className={[
            "md:static md:translate-y-0 md:shadow-none md:border-0",
            "fixed bottom-0 left-0 right-0 z-[60] bg-background border-t shadow-xl",
            "transition-transform duration-300 max-h-[85vh] overflow-y-auto",
          ].join(" ")}
        >
          <div className="md:hidden flex flex-col items-center pt-2 relative">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="absolute right-3 top-2 p-1 text-muted-foreground"
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 pb-24 md:pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </div>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => setSelectedDate(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Match panel — convocazioni + risultato */}
            {selectedMatch &&
              (() => {
                const mx = selectedMatch as any;
                const label = mx.home_away === "home" ? `Lambro vs ${mx.opponent}` : `${mx.opponent} vs Lambro`;
                const conv = matchConvCounts[mx.id] ?? 0;
                return (
                  <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                          ⚔️ Match{mx.match_time ? ` · ${mx.match_time.slice(0, 5)}` : ""}
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-400 truncate">
                          {label} · {conv} convocati
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge
                        variant={
                          mx.status === "won"
                            ? "default"
                            : mx.status === "lost"
                              ? "destructive"
                              : mx.status === "draw"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {mx.status === "won"
                          ? "Vinta"
                          : mx.status === "draw"
                            ? "Pareggio"
                            : mx.status === "lost"
                              ? "Persa"
                              : "Programmata"}
                      </Badge>
                      <Button
                        size="sm"
                        variant={mx.status === "won" ? "default" : "outline"}
                        onClick={() => setMatchStatus("won")}
                      >
                        <Trophy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={mx.status === "draw" ? "secondary" : "outline"}
                        onClick={() => setMatchStatus("draw")}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={mx.status === "lost" ? "destructive" : "outline"}
                        onClick={() => setMatchStatus("lost")}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </Button>
                      {mx.status !== "scheduled" && (
                        <Button size="sm" variant="ghost" onClick={() => setMatchStatus("scheduled")}>
                          Azzera
                        </Button>
                      )}
                    </div>
                    {matchLoading ? (
                      <div className="text-xs text-muted-foreground py-2">Caricamento convocati…</div>
                    ) : matchEditing ? (
                      <div className="border-t pt-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const all: Record<string, string> = {};
                              players.forEach((p) => {
                                all[p.id] = "starter";
                              });
                              setMatchPicks(all);
                              setMatchDirty(true);
                            }}
                          >
                            Tutti titolari
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setMatchPicks({});
                              setMatchDirty(true);
                            }}
                          >
                            Azzera
                          </Button>
                          {matchDirty && (
                            <span className="text-xs text-amber-500 font-medium self-center">● Non salvato</span>
                          )}
                        </div>
                        <ul className="divide-y max-h-[40vh] overflow-auto rounded border bg-background">
                          {players.map((p) => {
                            const role = matchPicks[p.id] || "out";
                            const isConvocato = role !== "out";
                            return (
                              <li key={p.id} className="flex items-center gap-2 py-2 px-3">
                                <span className="flex-1 text-sm font-medium truncate">{p.full_name}</span>
                                {isConvocato && (
                                  <Input
                                    type="number"
                                    min={1}
                                    max={25}
                                    placeholder="#"
                                    value={matchJerseys[p.id] ?? ""}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value);
                                      setMatchJerseys((prev) => {
                                        const next = { ...prev };
                                        if (e.target.value === "" || isNaN(v)) {
                                          delete next[p.id];
                                          return next;
                                        }
                                        next[p.id] = Math.min(25, Math.max(1, v));
                                        return next;
                                      });
                                      setMatchDirty(true);
                                    }}
                                    className="h-8 w-14 text-center"
                                  />
                                )}
                                <Select
                                  value={role}
                                  onValueChange={(v) => {
                                    setMatchPicks((prev) => ({ ...prev, [p.id]: v }));
                                    setMatchDirty(true);
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="out">Non convocato</SelectItem>
                                    <SelectItem value="starter">Titolare</SelectItem>
                                    <SelectItem value="bench">Panchina</SelectItem>
                                    <SelectItem value="linesman">Guardalinee</SelectItem>
                                  </SelectContent>
                                </Select>
                              </li>
                            );
                          })}
                          {players.length === 0 && (
                            <li className="p-4 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                          )}
                        </ul>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setMatchEditing(false);
                              setMatchDirty(false);
                            }}
                          >
                            Annulla
                          </Button>
                          <Button onClick={saveMatchCallups} disabled={matchSaving}>
                            {matchSaving ? "Salvataggio…" : "Salva convocazioni"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Convocati ({conv})
                          </span>
                          <Button size="sm" variant="outline" onClick={() => setMatchEditing(true)}>
                            ✏️ {conv > 0 ? "Modifica" : "Aggiungi convocati"}
                          </Button>
                        </div>
                        {conv === 0 ? (
                          <p className="text-xs text-muted-foreground">Nessun convocato inserito</p>
                        ) : (
                          <ul className="divide-y rounded border bg-background max-h-[30vh] overflow-auto">
                            {players
                              .filter((p) => matchPicks[p.id] && matchPicks[p.id] !== "out")
                              .sort((a, b) => (matchJerseys[a.id] ?? 99) - (matchJerseys[b.id] ?? 99))
                              .map((p) => {
                                const role = matchPicks[p.id];
                                const jersey = matchJerseys[p.id];
                                return (
                                  <li key={p.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                                    {jersey != null && (
                                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                        {jersey}
                                      </span>
                                    )}
                                    <span className="flex-1 font-medium truncate">{p.full_name}</span>
                                    <Badge
                                      variant={
                                        role === "starter" ? "default" : role === "bench" ? "secondary" : "outline"
                                      }
                                      className="text-xs"
                                    >
                                      {role === "starter" ? "Titolare" : role === "bench" ? "Panchina" : "Guardalinee"}
                                    </Badge>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            {!selectedMatch &&
              (isPastDate && !isEditingPast ? (
                <Card className="p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">Presenze registrate</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {[...existing.values()].filter((v) => v === "training_attendance").length}/{players.length}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Pre-populate checkboxes from saved state
                          const presentIds = [...existing.entries()]
                            .filter(([_k, v]) => v === "training_attendance")
                            .map(([k]) => k);
                          setPresentArr(presentIds);
                          setDirty(false);
                          setIsEditingPast(true);
                        }}
                      >
                        ✏️ Modifica
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cerca giocatore"
                    className="max-w-xs"
                  />
                  <ul className="divide-y max-h-[50vh] overflow-auto border rounded-md">
                    {filtered.map((p) => {
                      const status = existing.get(p.id);
                      return (
                        <li key={p.id} className="flex items-center gap-3 p-3">
                          <div className="flex-1 min-w-0 font-medium truncate">{p.full_name}</div>
                          {status === "training_attendance" && (
                            <Badge className="bg-emerald-500 text-white">✓ Presente</Badge>
                          )}
                          {status === "training_absence" && (
                            <Badge variant="outline" className="text-muted-foreground">
                              ✗ Assente
                            </Badge>
                          )}
                          {!status && (
                            <Badge variant="outline" className="text-muted-foreground opacity-50">
                              —
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                    {filtered.length === 0 && (
                      <li className="p-6 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                    )}
                  </ul>
                </Card>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cerca giocatore"
                      className="max-w-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPresentArr(players.map((p) => p.id));
                        setDirty(true);
                      }}
                    >
                      Tutti presenti
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPresentArr([]);
                        setDirty(true);
                      }}
                    >
                      Tutti assenti
                    </Button>
                    <Badge variant="secondary">
                      {present.size}/{players.length}
                    </Badge>
                    {dirty && <span className="text-xs text-amber-500 font-medium">● Non salvato</span>}
                  </div>
                  <Card>
                    <ul className="divide-y max-h-[50vh] overflow-auto">
                      {filtered.map((p) => {
                        const on = present.has(p.id);
                        const saved = existing.get(p.id);
                        const savedLabel =
                          saved === "training_attendance"
                            ? "✓ presente"
                            : saved === "training_absence"
                              ? "✗ assente"
                              : "non impostato";
                        return (
                          <li
                            key={p.id}
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40"
                            onClick={() => toggle(p.id)}
                          >
                            <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{p.full_name}</div>
                              <div className="text-[10px] text-muted-foreground">Stato salvato: {savedLabel}</div>
                            </div>
                            <Badge variant={on ? "default" : "outline"}>{on ? "Presente" : "Assente"}</Badge>
                          </li>
                        );
                      })}
                      {filtered.length === 0 && (
                        <li className="p-6 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                      )}
                    </ul>
                  </Card>
                  <div className="flex flex-col gap-2">
                    {isPastDate && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setIsEditingPast(false)}>
                        Annulla modifica
                      </Button>
                    )}
                    <Button size="lg" onClick={save} disabled={saving || !date} className="w-full md:w-auto">
                      {saving ? "Salvataggio…" : "Salva presenze"}
                    </Button>
                  </div>
                </>
              ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function CoachMatchesCard({ category }: { category: string }) {
  const { user } = useAuth();
  const { seasonId, activeSeason } = useSeason();
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({
    match_date: new Date().toISOString().slice(0, 10),
    match_time: "",
    opponent: "",
    home_away: "home" as "home" | "away",
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const draftKey = openId ? `draft_convocations_${openId}` : "__none__";
  const [picks, setPicks, clearPicks] = useDraftState<Record<string, CallUpRole>>(draftKey, {});
  const jerseyDraftKey = openId ? `draft_jerseys_${openId}` : "__none__";
  const [jerseys, setJerseys, clearJerseys] = useDraftState<Record<string, number>>(jerseyDraftKey, {});
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from("matches").select("*").eq("category", category).order("match_date", { ascending: false }),
      supabase.from("players").select("id,full_name").eq("category", category).order("full_name"),
    ]);
    setMatches(((m as any[]) || []) as Match[]);
    setPlayers(p || []);
    const ids = (((m as any[]) || []) as Match[]).map((x) => x.id);
    if (ids.length) {
      const { data: ev } = await supabase
        .from("weekly_events")
        .select("match_id,player_id,rule_key")
        .in("match_id", ids)
        .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
      const c: Record<string, Set<string>> = {};
      (ev || []).forEach((r: any) => {
        (c[r.match_id] ||= new Set()).add(r.player_id);
      });
      const out: Record<string, number> = {};
      Object.entries(c).forEach(([k, set]) => {
        out[k] = set.size;
      });
      setCounts(out);
    } else {
      setCounts({});
    }
  };

  useEffect(() => {
    load();
  }, [category]);
  useEffect(() => {
    if (!openId) {
      setDirty(false);
      return;
    }
    setDirty(!!localStorage.getItem(`draft_convocations_${openId}`));
  }, [openId]);
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") window.dispatchEvent(new Event("storage"));
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const create = async () => {
    if (!form.opponent.trim()) return toast.error("Inserisci l'avversario");
    const week = weekOf(form.match_date, activeSeason?.starts_at);
    const { error } = await supabase.from("matches").insert({
      category,
      match_date: form.match_date,
      match_time: form.match_time || null,
      opponent: form.opponent.trim(),
      week,
      season: SEASON,
      season_id: seasonId ?? null,
      home_away: form.home_away as string,
    });
    if (error) return toast.error(error.message);
    toast.success("Partita creata");
    setForm({ ...form, opponent: "", match_time: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare la partita?")) return;
    await supabase.from("weekly_events").delete().eq("match_id", id);
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Partita eliminata");
    load();
  };

  const setStatus = async (m: Match, status: "won" | "draw" | "lost" | "scheduled") => {
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", m.id)
      .in("rule_key", ["match_win", "match_loss", "match_draw"]);
    if (status !== "scheduled") {
      const { data: callups } = await supabase
        .from("weekly_events")
        .select("player_id")
        .eq("match_id", m.id)
        .in("rule_key", ["starting_xv", "on_the_bench"]);
      const playerIds = Array.from(new Set((callups || []).map((r: any) => r.player_id)));
      const rule_key = status === "won" ? "match_win" : status === "draw" ? "match_draw" : "match_loss";
      if (playerIds.length) {
        const rows = playerIds.map((player_id) => ({
          player_id,
          rule_key,
          week: m.week,
          quantity: 1,
          match_id: m.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${m.id}`,
          inserted_by: user?.id ?? null,
          inserted_at: new Date().toISOString(),
        }));
        const { error: insErr } = await supabase.from("weekly_events").insert(rows);
        if (insErr) return toast.error(insErr.message);
      }
    }
    const { error } = await supabase.from("matches").update({ status }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(
      status === "won"
        ? "Vittoria"
        : status === "draw"
          ? "Pareggio"
          : status === "lost"
            ? "Sconfitta"
            : "Risultato azzerato",
    );
    load();
  };

  const openMatch = async (m: Match) => {
    if (openId === m.id) {
      setOpenId(null);
      return;
    }
    setOpenId(m.id);
    const { data } = await supabase
      .from("weekly_events")
      .select("player_id,rule_key,jersey_number")
      .eq("match_id", m.id)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
    const next: Record<string, CallUpRole> = {};
    const nextJerseys: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      next[r.player_id] =
        r.rule_key === "starting_xv" ? "starter" : r.rule_key === "on_the_bench" ? "bench" : "linesman";
      if (r.jersey_number) nextJerseys[r.player_id] = r.jersey_number;
    });
    if (!localStorage.getItem(`draft_convocations_${m.id}`)) {
      setPicks(next);
      setJerseys(nextJerseys);
      setDirty(false);
    } else if (!localStorage.getItem(`draft_jerseys_${m.id}`)) {
      setJerseys(nextJerseys);
    }
  };

  const saveCallups = async (m: Match) => {
    setSaving(true);
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", m.id)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
    const rows: any[] = [];
    Object.entries(picks).forEach(([player_id, role]) => {
      if (role === "out") return;
      const rule_key = role === "starter" ? "starting_xv" : role === "bench" ? "on_the_bench" : "linesman_call";
      rows.push({
        player_id,
        rule_key,
        week: m.week,
        quantity: 1,
        match_id: m.id,
        season: SEASON,
        season_id: seasonId ?? null,
        notes: `match:${m.id}`,
        inserted_by: user?.id ?? null,
        inserted_at: new Date().toISOString(),
        jersey_number: jerseys[player_id] ?? null,
      });
    });
    if (rows.length) {
      const { error } = await supabase.from("weekly_events").insert(rows);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    if (m.status === "won" || m.status === "draw" || m.status === "lost") {
      await supabase
        .from("weekly_events")
        .delete()
        .eq("match_id", m.id)
        .in("rule_key", ["match_win", "match_draw", "match_loss"]);
      const rule_key = m.status === "won" ? "match_win" : m.status === "draw" ? "match_draw" : "match_loss";
      const conv = Object.entries(picks)
        .filter(([_k, r]) => r === "starter" || r === "bench")
        .map(([player_id]) => ({
          player_id,
          rule_key,
          week: m.week,
          quantity: 1,
          match_id: m.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${m.id}`,
          inserted_by: user?.id ?? null,
          inserted_at: new Date().toISOString(),
        }));
      if (conv.length) await supabase.from("weekly_events").insert(conv);
    }
    setSaving(false);
    toast.success(`Convocazioni salvate (${rows.length})`);
    clearPicks();
    clearJerseys();
    setDirty(false);
    setOpenId(null);
    load();
  };

  const setRole = (pid: string, role: CallUpRole) => {
    setPicks((prev) => ({ ...prev, [pid]: role }));
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-bold mb-3">Nuova partita</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Data</Label>
            <Input
              type="date"
              value={form.match_date}
              onChange={(e) => setForm({ ...form, match_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Orario kick-off</Label>
            <Input
              type="time"
              value={form.match_time}
              onChange={(e) => setForm({ ...form, match_time: e.target.value })}
              placeholder="es. 15:00"
            />
          </div>
          <div>
            <Label>Avversario</Label>
            <Input
              value={form.opponent}
              onChange={(e) => setForm({ ...form, opponent: e.target.value })}
              placeholder="es. Cernusco Rugby"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() => setForm({ ...form, home_away: "home" })}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                form.home_away === "home"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              🏠 Casa
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, home_away: "away" })}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l ${
                form.home_away === "away"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              ✈️ Trasferta
            </button>
          </div>
          <Button onClick={create} className="w-full md:w-auto">
            Crea partita
          </Button>
        </div>
      </Card>
      <div className="space-y-3">
        {matches.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nessuna partita</Card>}
        {matches.map((m) => {
          const isOpen = openId === m.id;
          const conv = counts[m.id] ?? 0;
          return (
            <Card key={m.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-semibold">{formatCoachMatch(m.home_away ?? "home", m.opponent)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.match_date + "T00:00:00").toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {m.match_time && ` · ${m.match_time.slice(0, 5)}`}
                    {` · W${m.week} · ${conv} convocati`}
                  </div>
                </div>
                <Badge
                  variant={
                    m.status === "won"
                      ? "default"
                      : m.status === "lost"
                        ? "destructive"
                        : m.status === "draw"
                          ? "secondary"
                          : "outline"
                  }
                >
                  {m.status === "won"
                    ? "Vinta"
                    : m.status === "draw"
                      ? "Pareggio"
                      : m.status === "lost"
                        ? "Persa"
                        : "Programmata"}
                </Badge>
                <Button
                  size="sm"
                  variant={m.status === "won" ? "default" : "outline"}
                  onClick={() => setStatus(m, "won")}
                >
                  <Trophy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={m.status === "draw" ? "secondary" : "outline"}
                  onClick={() => setStatus(m, "draw")}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={m.status === "lost" ? "destructive" : "outline"}
                  onClick={() => setStatus(m, "lost")}
                >
                  <ShieldAlert className="h-4 w-4" />
                </Button>
                {m.status !== "scheduled" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(m, "scheduled")}>
                    Azzera
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openMatch(m)}>
                  <Users className="h-4 w-4 mr-1" />
                  {isOpen ? "Chiudi" : "Convoca"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {isOpen && (
                <div className="mt-3 border-t pt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const all: Record<string, CallUpRole> = {};
                        players.forEach((p) => {
                          all[p.id] = "starter";
                        });
                        setPicks(all);
                        setDirty(true);
                      }}
                    >
                      Tutti titolari
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPicks({});
                        setDirty(true);
                      }}
                    >
                      Azzera
                    </Button>
                  </div>
                  <ul className="divide-y max-h-[55vh] overflow-auto">
                    {players.map((p) => {
                      const role = picks[p.id] || "out";
                      const isConvocato = role !== "out";
                      return (
                        <li key={p.id} className="flex items-center gap-2 py-2">
                          <span className="flex-1 text-sm font-medium truncate">{p.full_name}</span>
                          {isConvocato && (
                            <Input
                              type="number"
                              min={1}
                              max={25}
                              placeholder="#"
                              value={jerseys[p.id] ?? ""}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                setJerseys((prev) => {
                                  const next = { ...prev };
                                  if (e.target.value === "" || isNaN(v)) {
                                    delete next[p.id];
                                    return next;
                                  }
                                  next[p.id] = Math.min(25, Math.max(1, v));
                                  return next;
                                });
                                setDirty(true);
                              }}
                              className="h-8 w-14 text-center"
                            />
                          )}
                          <Select value={role} onValueChange={(v) => setRole(p.id, v as CallUpRole)}>
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="out">Non convocato</SelectItem>
                              <SelectItem value="starter">Titolare</SelectItem>
                              <SelectItem value="bench">Panchina</SelectItem>
                              <SelectItem value="linesman">Guardalinee</SelectItem>
                            </SelectContent>
                          </Select>
                        </li>
                      );
                    })}
                    {players.length === 0 && (
                      <li className="p-4 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                    )}
                  </ul>
                  <div className="flex justify-end gap-2 items-center">
                    {dirty && <span className="text-xs text-amber-500 font-medium">● Modifiche non salvate</span>}
                    <Button variant="outline" onClick={() => setOpenId(null)}>
                      Annulla
                    </Button>
                    <Button onClick={() => saveCallups(m)} disabled={saving}>
                      {saving ? "Salvataggio…" : "Salva convocazioni"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function CoachSection({ coach }: { coach: ClaimedCoach }) {
  const { user } = useAuth();

  const { categories } = useCategories();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [activeCat, setActiveCat] = useState<string>(coach.category);
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    if (!user) return;
    const [{ data: abs }, { data: reads }] = await Promise.all([
      supabase
        .from("training_absences" as any)
        .select("*, players(full_name)")
        .eq("category", coach.category)
        .order("training_date", { ascending: true }),
      supabase
        .from("training_absence_reads" as any)
        .select("absence_id")
        .eq("coach_id", user.id),
    ]);
    const readSet = new Set(((reads as any[]) || []).map((r) => r.absence_id));
    setAbsences(((abs as any[]) || []).map((a) => ({ ...a, is_read: readSet.has(a.id) })));
  };
  useEffect(() => {
    load();
  }, [coach.category, user?.id]);

  const unreadList = absences.filter((a) => !a.is_read);
  const archivedList = absences.filter((a) => a.is_read);

  const markRead = async (a: Absence) => {
    if (!user) return;
    const { error } = await supabase
      .from("training_absence_reads" as any)
      .insert({ absence_id: a.id, coach_id: user.id });
    if (error) return toast.error(error.message);
    setAbsences((rows) => rows.map((r) => (r.id === a.id ? { ...r, is_read: true } : r)));
  };
  const markUnread = async (a: Absence) => {
    if (!user) return;
    const { error } = await supabase
      .from("training_absence_reads" as any)
      .delete()
      .eq("absence_id", a.id)
      .eq("coach_id", user.id);
    if (error) return toast.error(error.message);
    setAbsences((rows) => rows.map((r) => (r.id === a.id ? { ...r, is_read: false } : r)));
  };

  const COACH_TABS = [
    { value: "allenamenti", label: "Calendario" },
    { value: "calendario", label: "Partite" },
    { value: "statistiche", label: "Statistiche" },
  ] as const;
  type CoachTabValue = (typeof COACH_TABS)[number]["value"];
  const [activeCoachTab, setActiveCoachTab] = useState<CoachTabValue>("allenamenti");
  const coachTabIdx = COACH_TABS.findIndex((t) => t.value === activeCoachTab);
  const coachTabPrev = coachTabIdx > 0 ? COACH_TABS[coachTabIdx - 1] : null;
  const coachTabNext = coachTabIdx < COACH_TABS.length - 1 ? COACH_TABS[coachTabIdx + 1] : null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <h2 className="text-xl font-bold">Sezione Allenatore</h2>
        <Badge variant="secondary">{coach.category}</Badge>
      </div>

      {/* Assenze — sempre visibili, fuori dai tab */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <CalIcon className="h-4 w-4" /> Assenze comunicate
          </h3>
          {unreadList.length > 0 && (
            <Badge>
              {unreadList.length} non {unreadList.length === 1 ? "letta" : "lette"}
            </Badge>
          )}
        </div>
        {absences.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna assenza comunicata.</p>
        ) : unreadList.length === 0 && archivedList.length > 0 && !showArchived ? (
          <p className="text-sm text-emerald-600 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Nessuna assenza da leggere
          </p>
        ) : (
          <ul className="space-y-2">
            {unreadList.map((a) => (
              <AbsenceRow key={a.id} a={a} onAction={() => markRead(a)} actionLabel="Letto ✓" />
            ))}
          </ul>
        )}

        {archivedList.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
              onClick={() => setShowArchived((s) => !s)}
            >
              {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Archiviate ({archivedList.length})
            </button>
            {showArchived && (
              <ul className="space-y-2 mt-2">
                {archivedList.map((a) => (
                  <AbsenceRow
                    key={a.id}
                    a={a}
                    archived
                    onAction={() => markUnread(a)}
                    actionLabel="Ripristina"
                    actionIcon={<RotateCcw className="h-4 w-4 mr-1" />}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {/* Tab navigation */}
      <div className="space-y-4">
        {/* Desktop tab bar */}
        <div className="hidden md:block">
          <Tabs value={activeCoachTab} onValueChange={(v) => setActiveCoachTab(v as CoachTabValue)}>
            <TabsList className="grid grid-cols-3 w-full">
              {COACH_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Mobile arrow navigation */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <button
            onClick={() => coachTabPrev && setActiveCoachTab(coachTabPrev.value)}
            disabled={!coachTabPrev}
            className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border bg-card disabled:opacity-30 transition-colors active:bg-muted"
            aria-label="Sezione precedente"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <div className="font-semibold text-base">{COACH_TABS[coachTabIdx].label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {coachTabIdx + 1} / {COACH_TABS.length}
              {coachTabPrev && <span className="ml-2 opacity-50">← {coachTabPrev.label}</span>}
              {coachTabNext && <span className="ml-2 opacity-50">{coachTabNext.label} →</span>}
            </div>
          </div>
          <button
            onClick={() => coachTabNext && setActiveCoachTab(coachTabNext.value)}
            disabled={!coachTabNext}
            className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border bg-card disabled:opacity-30 transition-colors active:bg-muted"
            aria-label="Sezione successiva"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Tab content */}
        {activeCoachTab === "allenamenti" && <CoachPresenzeCard category={coach.category} />}
        {activeCoachTab === "calendario" && <CoachMatchesCard category={coach.category} />}
        {activeCoachTab === "statistiche" && (
          <Card className="p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <UsersIcon className="h-4 w-4" /> Statistiche giocatori
            </h3>
            <Tabs value={activeCat} onValueChange={setActiveCat}>
              <TabsList className="flex flex-wrap h-auto">
                {categories.map((c) => (
                  <TabsTrigger key={c.id} value={c.name}>
                    {c.label || c.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {categories.map((c) => (
                <TabsContent key={c.id} value={c.name} className="mt-4">
                  <CoachStatsTable category={c.name} trainingDays={c.training_days || []} />
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        )}
      </div>
    </section>
  );
}

function AbsenceRow({
  a,
  archived,
  onAction,
  actionLabel,
  actionIcon,
}: {
  a: Absence;
  archived?: boolean;
  onAction: () => void;
  actionLabel: string;
  actionIcon?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "rounded-md border p-3 flex items-start justify-between gap-3 transition-opacity",
        archived ? "opacity-60 border-l-2 border-l-muted" : "border-l-4 border-l-amber-500 bg-amber-500/5",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold truncate">{a.players?.full_name || "—"}</span>
          <span className="text-muted-foreground text-xs">
            ·{" "}
            {new Date(a.training_date).toLocaleDateString("it-IT", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 break-words">{a.justification}</p>
      </div>
      <Button size="sm" variant={archived ? "ghost" : "outline"} onClick={onAction}>
        {actionIcon ?? <CheckCircle2 className="h-4 w-4 mr-1" />}
        {actionLabel}
      </Button>
    </li>
  );
}

type PlayerStat = {
  id: string;
  full_name: string;
  role: string;
  training_attendance: number;
  training_absence: number;
  starting_xv: number;
  on_the_bench: number;
  try_scored: number;
  yellow_card: number;
  red_card: number;
};

type SortKey = "name" | "presence" | "absence" | "matches" | "starter" | "bench" | "tries" | "yellow" | "red";

function CoachStatsTable({ category, trainingDays }: { category: string; trainingDays: number[] }) {
  const { crewSlug } = useCrew();
  const { seasonId, activeSeason } = useSeason();
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [totalTrainings, setTotalTrainings] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "presence", dir: "desc" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const playersQ = supabase.from("players").select("id,full_name,role").eq("category", category).order("full_name");
      const { data: pls } = await playersQ;
      const list = (pls || []) as { id: string; full_name: string; role: string }[];
      const ids = list.map((p) => p.id);

      let events: any[] = [];
      if (ids.length) {
        let evQ = supabase
          .from("weekly_events")
          .select("player_id,rule_key,quantity,week,match_id,notes,created_at")
          .in("player_id", ids)
          .in("rule_key", [
            "training_attendance",
            "training_absence",
            "starting_xv",
            "on_the_bench",
            "try_scored",
            "yellow_card",
            "red_card",
          ]);
        if (seasonId) evQ = evQ.eq("season_id", seasonId) as any;
        const { data } = await evQ;
        events = data || [];
      }

      // Distinct tracked training sessions. Prefer the date encoded in notes
      // ("training:YYYY-MM-DD|category"), fall back to created_at day, then to
      // the max events-per-player count (robust against missing keys).
      const trainingDates = new Set<string>();
      const matchIds = new Set<string>();
      const trainPerPlayer = new Map<string, number>();
      const matchPerPlayer = new Map<string, number>();
      events.forEach((e) => {
        if (e.rule_key === "training_attendance" || e.rule_key === "training_absence") {
          const m = typeof e.notes === "string" ? e.notes.match(/training:(\d{4}-\d{2}-\d{2})/) : null;
          const day = m ? m[1] : e.created_at ? new Date(e.created_at).toISOString().slice(0, 10) : null;
          if (day) trainingDates.add(day);
          trainPerPlayer.set(e.player_id, (trainPerPlayer.get(e.player_id) ?? 0) + 1);
        }
        if (e.rule_key === "starting_xv" || e.rule_key === "on_the_bench") {
          if (e.match_id) matchIds.add(e.match_id);
          matchPerPlayer.set(e.player_id, (matchPerPlayer.get(e.player_id) ?? 0) + 1);
        }
      });
      const maxTrain = Math.max(0, ...Array.from(trainPerPlayer.values()));
      const maxMatch = Math.max(0, ...Array.from(matchPerPlayer.values()));
      setTotalTrainings(Math.max(trainingDates.size, maxTrain));
      setTotalMatches(Math.max(matchIds.size, maxMatch));

      const map = new Map<string, PlayerStat>();
      list.forEach((p) =>
        map.set(p.id, {
          id: p.id,
          full_name: p.full_name,
          role: p.role,
          training_attendance: 0,
          training_absence: 0,
          starting_xv: 0,
          on_the_bench: 0,
          try_scored: 0,
          yellow_card: 0,
          red_card: 0,
        }),
      );
      events.forEach((e) => {
        const s = map.get(e.player_id);
        if (!s) return;
        (s as any)[e.rule_key] = ((s as any)[e.rule_key] ?? 0) + (e.quantity ?? 1);
      });
      setPlayers(Array.from(map.values()));
      setLoading(false);
    })();
  }, [category, seasonId, activeSeason?.name]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = q ? players.filter((p) => p.full_name.toLowerCase().includes(q)) : players.slice();
    const dir = sort.dir === "asc" ? 1 : -1;
    const presPct = (p: PlayerStat) => (totalTrainings > 0 ? p.training_attendance / totalTrainings : 0);
    arr.sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.full_name.localeCompare(b.full_name) * dir;
        case "presence":
          return (presPct(a) - presPct(b)) * dir;
        case "absence":
          return (a.training_absence - b.training_absence) * dir;
        case "matches":
          return (a.starting_xv + a.on_the_bench - (b.starting_xv + b.on_the_bench)) * dir;
        case "starter":
          return (a.starting_xv - b.starting_xv) * dir;
        case "bench":
          return (a.on_the_bench - b.on_the_bench) * dir;
        case "tries":
          return (a.try_scored - b.try_scored) * dir;
        case "yellow":
          return (a.yellow_card - b.yellow_card) * dir;
        case "red":
          return (a.red_card - b.red_card) * dir;
      }
    });
    return arr;
  }, [players, search, sort, totalTrainings]);

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  const noTrainings = totalTrainings === 0;
  const noMatches = totalMatches === 0;

  if (!loading && players.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun giocatore in questa categoria.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Cerca giocatore…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {noTrainings && (
          <span className="text-xs text-muted-foreground">Nessun allenamento registrato per questa stagione.</span>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <Th onClick={() => toggleSort("name")} active={sort.key === "name"} dir={sort.dir}>
                Nome
              </Th>
              <Th onClick={() => toggleSort("presence")} active={sort.key === "presence"} dir={sort.dir} center>
                Pres. allenamenti
              </Th>
              <Th onClick={() => toggleSort("absence")} active={sort.key === "absence"} dir={sort.dir} center>
                Ass.
              </Th>
              <Th onClick={() => toggleSort("matches")} active={sort.key === "matches"} dir={sort.dir} center>
                Partite
              </Th>
              <Th onClick={() => toggleSort("starter")} active={sort.key === "starter"} dir={sort.dir} center>
                Titolare
              </Th>
              <Th onClick={() => toggleSort("bench")} active={sort.key === "bench"} dir={sort.dir} center>
                Panchina
              </Th>
              <Th onClick={() => toggleSort("tries")} active={sort.key === "tries"} dir={sort.dir} center>
                Mete
              </Th>
              <Th onClick={() => toggleSort("yellow")} active={sort.key === "yellow"} dir={sort.dir} center>
                🟡
              </Th>
              <Th onClick={() => toggleSort("red")} active={sort.key === "red"} dir={sort.dir} center>
                🔴
              </Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const matches = p.starting_xv + p.on_the_bench;
              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2">
                    <Link to="/$crewSlug/player/$id" params={{ crewSlug, id: p.id }} className="font-medium hover:text-primary">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="text-center min-w-[180px]">
                    <PresenceCell present={p.training_attendance} total={totalTrainings} />
                  </td>
                  <td className="text-center">{p.training_absence || "—"}</td>
                  <td className="text-center">
                    <div className="font-medium">
                      {matches}/{totalMatches || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      T:{p.starting_xv} P:{p.on_the_bench}
                    </div>
                  </td>
                  <td className="text-center">{p.starting_xv || "—"}</td>
                  <td className="text-center">{p.on_the_bench || "—"}</td>
                  <td className={cn("text-center", p.try_scored > 0 && "font-bold")}>{p.try_scored || "—"}</td>
                  <td className="text-center">
                    {p.yellow_card > 0 ? <CardBadge color="yellow" n={p.yellow_card} /> : "—"}
                  </td>
                  <td className="text-center">{p.red_card > 0 ? <CardBadge color="red" n={p.red_card} /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.map((p) => {
          const matches = p.starting_xv + p.on_the_bench;
          return (
            <div key={p.id} className="rounded-md border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Link to="/$crewSlug/player/$id" params={{ crewSlug, id: p.id }} className="font-semibold hover:text-primary">
                  {p.full_name}
                </Link>
                <Badge variant="outline" className="text-xs">
                  {p.role}
                </Badge>
              </div>
              <div className="text-xs flex items-center gap-2">
                <span className="text-muted-foreground">Pres:</span>
                <PresenceCell present={p.training_attendance} total={totalTrainings} />
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Partite:</span>{" "}
                <span className="font-medium">
                  {matches}/{totalMatches || 0}
                </span>{" "}
                <span className="text-muted-foreground">
                  T:{p.starting_xv} P:{p.on_the_bench}
                </span>
              </div>
              <div className="text-xs flex items-center gap-3">
                <span>
                  <span className="text-muted-foreground">Mete:</span>{" "}
                  <span className={cn(p.try_scored > 0 && "font-bold")}>{p.try_scored}</span>
                </span>
                <span className="flex items-center gap-1">🟡 {p.yellow_card}</span>
                <span className="flex items-center gap-1">🔴 {p.red_card}</span>
                {p.training_absence > 0 && <span className="text-muted-foreground">Ass: {p.training_absence}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {noMatches && <p className="text-xs text-muted-foreground">Nessuna partita registrata per questa stagione.</p>}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  center,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
  center?: boolean;
}) {
  return (
    <th
      className={cn("py-2 px-1 select-none cursor-pointer hover:text-foreground", center && "text-center")}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function PresenceCell({ present, total }: { present: number; total: number }) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const color = total === 0 ? "bg-muted" : pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="inline-flex items-center gap-2 min-w-[160px]">
      <span className="font-medium tabular-nums whitespace-nowrap">
        {present}/{total}
      </span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[48px]">
        <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{total > 0 ? `${pct}%` : "—"}</span>
    </div>
  );
}

function CardBadge({ color, n }: { color: "yellow" | "red"; n: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded text-xs font-bold text-white",
        color === "yellow" ? "bg-yellow-500 text-black" : "bg-red-600",
      )}
    >
      {n}
    </span>
  );
}

/* ---------------- Generic section ---------------- */

function GenericSection({ team, topTeams }: { team: { id: string; name: string } | null; topTeams: TeamScore[] }) {
  const { crewSlug } = useCrew();
  return (
    <section className="space-y-4">
      <Card className="p-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <UsersIcon className="h-4 w-4" /> La mia squadra Fanta
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {team ? team.name : "Non hai ancora creato la tua squadra"}
          </p>
        </div>
        <Button asChild variant={team ? "outline" : "default"}>
          <Link to="/$crewSlug/team" params={{ crewSlug }}>{team ? "Apri" : "Crea squadra"}</Link>
        </Button>
      </Card>
      <TopFiveCard topTeams={topTeams} />
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SEZIONE TEAM MANAGER — integrata dalla pagina /tm
   ═══════════════════════════════════════════════════════════════════ */

function TMSection({ category }: { category: string }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
        <h2 className="text-xl font-bold">Sezione Team Manager</h2>
      </div>
      <TMTabs category={category} />
    </section>
  );
}

type Training = {
  id: string;
  training_date: string;
  start_time: string | null;
  location: string | null;
  category: string;
};

const MONTH_NAMES_TM = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
const DOW_LABELS_TM = ["L", "M", "M", "G", "V", "S", "D"];

function fmtLocalTM(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

type CalendarMatchRow = {
  id: string;
  match_date: string;
  match_time?: string | null;
  week?: number;
  opponent: string;
  status: string;
  home_away?: "home" | "away";
};

type TMCalendarGridProps = {
  month: Date;
  trainings: Training[];
  scheduledDates: string[];
  matches: CalendarMatchRow[];
  selectedDate: string | null;
  onDayClick: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function TMCalendarGrid({
  month,
  trainings,
  scheduledDates,
  matches,
  selectedDate,
  onDayClick,
  onPrevMonth,
  onNextMonth,
}: TMCalendarGridProps) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const todayStr = fmtLocalTM(new Date());
  const trainingByDate = new Map(trainings.map((t) => [t.training_date, t]));
  const matchByDate = new Map(matches.map((mx) => [mx.match_date, mx]));
  const scheduledSet = new Set(scheduledDates);
  const first = new Date(year, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, m, 1 - startOffset);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === m });
  }
  return (
    <Card className="p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold text-sm md:text-base">
          {MONTH_NAMES_TM[m]} {year}
        </div>
        <Button variant="outline" size="sm" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] md:text-xs font-medium text-muted-foreground">
        {DOW_LABELS_TM.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }, i) => {
          const ds = fmtLocalTM(date);
          const t = trainingByDate.get(ds);
          const scheduled = scheduledSet.has(ds);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(ds)}
              className={[
                "relative rounded-md border text-left p-1 transition",
                "h-10 md:h-16 text-[11px] md:text-xs",
                inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                isToday ? "ring-2 ring-primary" : "",
                isSelected ? "ring-2 ring-primary/60" : "",
                "hover:bg-muted/40",
              ].join(" ")}
            >
              <div className="font-medium">{date.getDate()}</div>
              {(t || scheduled || matchByDate.get(ds)) && (
                <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                  {(t || scheduled) && (
                    <div className="flex items-center gap-1">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${t ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                      />
                      <span className="hidden md:inline text-[10px] text-emerald-700 dark:text-emerald-400 truncate font-medium">
                        {t ? "Allenamento" : ""}
                      </span>
                    </div>
                  )}
                  {matchByDate.get(ds) && (
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full shrink-0 bg-blue-500" />
                      <span className="hidden md:inline text-[10px] text-blue-600 dark:text-blue-400 truncate font-medium">
                        Match
                      </span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function formatTMMatch(homeAway: "home" | "away", opponent: string): string {
  return homeAway === "home" ? `Lambro vs ${opponent}` : `${opponent} vs Lambro`;
}

const TM_TABS = [
  { value: "presenze", label: "Presenze" },
  { value: "matches", label: "Partite" },
  { value: "events", label: "Punteggi" },
  { value: "special", label: "Azioni speciali" },
  { value: "quotas", label: "Quote" },
] as const;
type TMTabValue = (typeof TM_TABS)[number]["value"];

function TMTabs({ category }: { category: string }) {
  const [active, setActive] = useState<TMTabValue>("presenze");
  const idx = TM_TABS.findIndex((t) => t.value === active);
  const prev = idx > 0 ? TM_TABS[idx - 1] : null;
  const next = idx < TM_TABS.length - 1 ? TM_TABS[idx + 1] : null;

  return (
    <div className="space-y-4">
      {/* Desktop: classic tab bar */}
      <div className="hidden md:block">
        <Tabs value={active} onValueChange={(v) => setActive(v as TMTabValue)}>
          <TabsList className="grid grid-cols-5 w-full">
            {TM_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Mobile: arrow navigation */}
      <div className="flex items-center justify-between gap-2 md:hidden">
        <button
          onClick={() => prev && setActive(prev.value)}
          disabled={!prev}
          className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border bg-card disabled:opacity-30 transition-colors active:bg-muted"
          aria-label="Sezione precedente"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div className="flex-1 text-center">
          <div className="font-semibold text-base">{TM_TABS[idx].label}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {idx + 1} / {TM_TABS.length}
            {prev && <span className="ml-2 opacity-50">← {prev.label}</span>}
            {next && <span className="ml-2 opacity-50">{next.label} →</span>}
          </div>
        </div>

        <button
          onClick={() => next && setActive(next.value)}
          disabled={!next}
          className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border bg-card disabled:opacity-30 transition-colors active:bg-muted"
          aria-label="Sezione successiva"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div>
        {active === "presenze" && <PresenzeSection category={category} />}
        {active === "matches" && <MatchesSection category={category} />}
        {active === "events" && <EventsSection category={category} />}
        {active === "special" && <SpecialActionsSection category={category} />}
        {active === "quotas" && <QuotasSection />}
      </div>
    </div>
  );
}

/* ----------------------------- Presenze ----------------------------- */

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function generateTrainingDates(days: number[]): string[] {
  if (!days?.length) return [];
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 11, 31);
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (days.includes(d.getDay())) out.push(toLocalDateString(d));
  }
  return out;
}

function PresenzeSection({ category }: { category: string }) {
  const { categories } = useCategories();
  const { user } = useAuth();
  const { seasonId, activeSeason } = useSeason();
  const cat = categories.find((c) => c.name === category);
  const dates = useMemo(() => generateTrainingDates(cat?.training_days || []), [cat?.training_days]);

  const [date, setDate] = useState<string>("");
  const [players, setPlayers] = useState<{ id: string; full_name: string }[]>([]);
  const trainingId = `${date}|${category}`;
  const [presentArr, setPresentArr, clearPresent] = useDraftState<string[]>(`draft_attendance_${trainingId}`, []);
  const present = useMemo(() => new Set(presentArr), [presentArr]);
  const [existing, setExisting] = useState<Map<string, "training_attendance" | "training_absence">>(new Map());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const isPastDate = !!selectedDate && selectedDate < fmtLocalTM(new Date());
  const [isEditingPast, setIsEditingPast] = useState(false);
  const [monthTrainings, setMonthTrainings] = useState<Training[]>([]);
  const [monthMatches, setMonthMatches] = useState<CalendarMatchRow[]>([]);

  // ── Match panel state (convocazioni + risultato nel calendario) ──
  const selectedMatch = selectedDate ? (monthMatches.find((m) => m.match_date === selectedDate) ?? null) : null;
  const matchDraftKey = selectedMatch ? `draft_convocations_${selectedMatch.id}` : "__none__";
  const [matchPicks, setMatchPicks, clearMatchPicks] = useDraftState<Record<string, CallUpRole>>(matchDraftKey, {});
  const matchJerseyKey = selectedMatch ? `draft_jerseys_${selectedMatch.id}` : "__none__";
  const [matchJerseys, setMatchJerseys, clearMatchJerseys] = useDraftState<Record<string, number>>(matchJerseyKey, {});
  const [matchConvCounts, setMatchConvCounts] = useState<Record<string, number>>({});
  const [matchSaving, setMatchSaving] = useState(false);
  const [matchEditing, setMatchEditing] = useState(false);
  const [matchDirty, setMatchDirty] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);

  // Reload match in monthMatches after status change
  const reloadMonthMatches = () => {
    if (!category) return;
    const y = calMonth.getFullYear();
    const mo = calMonth.getMonth();
    const first = fmtLocalTM(new Date(y, mo, 1));
    const last = fmtLocalTM(new Date(y, mo + 1, 0));
    supabase
      .from("matches")
      .select("id,match_date,match_time,opponent,status,home_away,week")
      .eq("category", category)
      .gte("match_date", first)
      .lte("match_date", last)
      .then(({ data }) => setMonthMatches(((data as any[]) || []) as CalendarMatchRow[]));
  };

  // Always load from DB when a match is selected
  useEffect(() => {
    if (!selectedMatch) {
      setMatchEditing(false);
      setMatchDirty(false);
      return;
    }
    setMatchEditing(false);
    setMatchDirty(false);
    setMatchLoading(true);
    supabase
      .from("weekly_events")
      .select("player_id,rule_key,jersey_number")
      .eq("match_id", selectedMatch.id)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"])
      .then(({ data }) => {
        const next: Record<string, CallUpRole> = {};
        const jerseyInit: Record<string, number> = {};
        (data || []).forEach((r: any) => {
          next[r.player_id] =
            r.rule_key === "starting_xv" ? "starter" : r.rule_key === "on_the_bench" ? "bench" : "linesman";
          if (r.jersey_number) jerseyInit[r.player_id] = r.jersey_number;
        });
        setMatchPicks(next);
        setMatchJerseys(jerseyInit);
        setMatchConvCounts((prev) => ({ ...prev, [selectedMatch.id]: Object.keys(next).length }));
        setMatchLoading(false);
        setMatchDirty(false);
        // Auto-open editing if no callups yet
        if (Object.keys(next).length === 0) setMatchEditing(true);
      });
  }, [selectedMatch?.id]);

  const saveMatchCallups = async () => {
    if (!selectedMatch) return;
    const mx = selectedMatch as any;
    setMatchSaving(true);
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", mx.id)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
    const rows: any[] = Object.entries(matchPicks)
      .filter(([_k, r]) => r !== "out")
      .map(([player_id, role]) => ({
        player_id,
        rule_key: role === "starter" ? "starting_xv" : role === "bench" ? "on_the_bench" : "linesman_call",
        week: mx.week ?? weekOf(mx.match_date, activeSeason?.starts_at),
        quantity: 1,
        match_id: mx.id,
        season: SEASON,
        season_id: seasonId ?? null,
        notes: `match:${mx.id}`,
        inserted_by: user?.id ?? null,
        inserted_at: new Date().toISOString(),
        jersey_number: matchJerseys[player_id] ?? null,
      }));
    if (rows.length) {
      const { error } = await supabase.from("weekly_events").insert(rows);
      if (error) {
        setMatchSaving(false);
        return toast.error(error.message);
      }
    }
    if (mx.status === "won" || mx.status === "draw" || mx.status === "lost") {
      await supabase
        .from("weekly_events")
        .delete()
        .eq("match_id", mx.id)
        .in("rule_key", ["match_win", "match_draw", "match_loss"]);
      const rule_key = mx.status === "won" ? "match_win" : mx.status === "draw" ? "match_draw" : "match_loss";
      const conv = Object.entries(matchPicks)
        .filter(([_k, r]) => r === "starter" || r === "bench")
        .map(([player_id]) => ({
          player_id,
          rule_key,
          week: mx.week ?? weekOf(mx.match_date, activeSeason?.starts_at),
          quantity: 1,
          match_id: mx.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${mx.id}`,
          inserted_by: user?.id ?? null,
          inserted_at: new Date().toISOString(),
        }));
      if (conv.length) await supabase.from("weekly_events").insert(conv);
    }
    setMatchSaving(false);
    toast.success(`Convocazioni salvate (${rows.length})`);
    clearMatchPicks();
    clearMatchJerseys();
    setMatchDirty(false);
    setMatchEditing(false);
    setMatchConvCounts((prev) => ({ ...prev, [mx.id]: rows.length }));
  };

  const setMatchStatus = async (status: "won" | "draw" | "lost" | "scheduled") => {
    if (!selectedMatch) return;
    const mx = selectedMatch as any;
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", mx.id)
      .in("rule_key", ["match_win", "match_loss", "match_draw"]);
    if (status !== "scheduled") {
      const { data: callups } = await supabase
        .from("weekly_events")
        .select("player_id")
        .eq("match_id", mx.id)
        .in("rule_key", ["starting_xv", "on_the_bench"]);
      const playerIds = Array.from(new Set((callups || []).map((r: any) => r.player_id)));
      const rule_key = status === "won" ? "match_win" : status === "draw" ? "match_draw" : "match_loss";
      if (playerIds.length) {
        const rows = playerIds.map((player_id) => ({
          player_id,
          rule_key,
          week: mx.week ?? weekOf(mx.match_date, activeSeason?.starts_at),
          quantity: 1,
          match_id: mx.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${mx.id}`,
          inserted_by: user?.id ?? null,
          inserted_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("weekly_events").insert(rows);
        if (error) return toast.error(error.message);
      }
    }
    const { error } = await supabase.from("matches").update({ status }).eq("id", mx.id);
    if (error) return toast.error(error.message);
    toast.success(
      status === "won"
        ? "Vittoria"
        : status === "draw"
          ? "Pareggio"
          : status === "lost"
            ? "Sconfitta"
            : "Risultato azzerato",
    );
    reloadMonthMatches();
  };

  useEffect(() => {
    if (!category) return;
    const y = calMonth.getFullYear();
    const mo = calMonth.getMonth();
    const first = fmtLocalTM(new Date(y, mo, 1));
    const last = fmtLocalTM(new Date(y, mo + 1, 0));
    supabase
      .from("trainings")
      .select("id,training_date,start_time,location,category")
      .eq("category", category)
      .gte("training_date", first)
      .lte("training_date", last)
      .then(({ data }) => setMonthTrainings((data as Training[]) || []));
    supabase
      .from("matches")
      .select("id,match_date,match_time,week,opponent,status,home_away")
      .eq("category", category)
      .gte("match_date", first)
      .lte("match_date", last)
      .then(({ data }) => setMonthMatches((data as CalendarMatchRow[]) || []));
  }, [calMonth, category]);

  useEffect(() => {
    if (!category) return;
    supabase
      .from("players")
      .select("id,full_name")
      .eq("category", category)
      .order("full_name")
      .then(({ data }) => setPlayers(data || []));
  }, [category]);

  useEffect(() => {
    if (!date || !category) return;
    (async () => {
      const trainingId = `${date}|${category}`;
      const { data } = await supabase
        .from("weekly_events")
        .select("player_id,rule_key")
        .eq("training_id", trainingId)
        .in("rule_key", ["training_attendance", "training_absence"]);
      const map = new Map<string, "training_attendance" | "training_absence">();
      (data || []).forEach((r: any) => map.set(r.player_id, r.rule_key));
      setExisting(map);

      const draft = localStorage.getItem(`draft_attendance_${trainingId}`);
      if (!draft) {
        setPresentArr(
          (data || []).filter((r: any) => r.rule_key === "training_attendance").map((r: any) => r.player_id),
        );
        setDirty(false);
      } else {
        setDirty(true);
      }
    })();
  }, [date, category]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        window.dispatchEvent(new Event("storage"));
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const toggle = (id: string) => {
    const next = new Set(present);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPresentArr([...next]);
    setDirty(true);
  };

  const save = async () => {
    if (!date) return toast.error("Seleziona una data");
    setSaving(true);
    const week = weekOf(date, activeSeason?.starts_at);
    const trainingId = `${date}|${category}`;
    const noteTag = `training:${date}`;
    const nowIso = new Date().toISOString();

    // Compute only players whose status has changed
    const changed = players.filter((p) => {
      const prev = existing.get(p.id);
      const next = present.has(p.id) ? "training_attendance" : "training_absence";
      return prev !== next;
    });

    if (changed.length === 0) {
      setSaving(false);
      toast.info("Nessuna variazione da salvare");
      clearPresent();
      setDirty(false);
      return;
    }

    // Delete only changed rows, then insert new ones (preserves created_at for unchanged)
    const changedIds = changed.map((p) => p.id);
    await supabase
      .from("weekly_events")
      .delete()
      .in("rule_key", ["training_attendance", "training_absence"])
      .eq("training_id", trainingId)
      .in("player_id", changedIds);

    const rows = changed.map((p) => ({
      player_id: p.id,
      rule_key: present.has(p.id) ? "training_attendance" : "training_absence",
      week,
      quantity: 1,
      notes: `${noteTag}|${category}`,
      training_id: trainingId,
      season: SEASON,
      season_id: seasonId ?? null,
      inserted_by: user?.id ?? null,
      inserted_at: nowIso,
    }));
    const { error } = await supabase.from("weekly_events").insert(rows);
    setSaving(false);
    if (error) return toast.error(error.message);
    const added = changed.filter((p) => present.has(p.id)).length;
    const removed = changed.filter((p) => !present.has(p.id)).length;
    const parts = [];
    if (added) parts.push(`+${added} presenti`);
    if (removed) parts.push(`-${removed} assenti`);
    toast.success(`Aggiornate: ${parts.join(", ")} (${changed.length} variazioni)`);
    clearPresent();
    const { data: refreshed } = await supabase
      .from("weekly_events")
      .select("player_id,rule_key")
      .eq("training_id", trainingId)
      .in("rule_key", ["training_attendance", "training_absence"]);
    const map = new Map<string, "training_attendance" | "training_absence">();
    (refreshed || []).forEach((r: any) => map.set(r.player_id, r.rule_key));
    setExisting(map);
    setPresentArr(
      (refreshed || []).filter((r: any) => r.rule_key === "training_attendance").map((r: any) => r.player_id),
    );
    setDirty(false);
  };

  const filtered = players.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <TMCalendarGrid
        month={calMonth}
        trainings={monthTrainings}
        scheduledDates={dates}
        matches={monthMatches}
        selectedDate={selectedDate}
        onDayClick={(d) => {
          setSelectedDate(d);
          setDate(d);
          setIsEditingPast(false);
        }}
        onPrevMonth={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        onNextMonth={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
      />

      {selectedDate && (
        <div
          className={[
            "md:static md:translate-y-0 md:shadow-none md:border-0",
            "fixed bottom-0 left-0 right-0 z-[60] bg-background border-t shadow-xl",
            "transition-transform duration-300 max-h-[85vh] overflow-y-auto",
          ].join(" ")}
        >
          <div className="md:hidden flex flex-col items-center pt-2 relative">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="absolute right-3 top-2 p-1 text-muted-foreground"
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 pb-24 md:pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </div>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => setSelectedDate(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Match panel — convocazioni + risultato */}
            {selectedMatch &&
              (() => {
                const mx = selectedMatch as any;
                const label = mx.home_away === "home" ? `Lambro vs ${mx.opponent}` : `${mx.opponent} vs Lambro`;
                const conv = matchConvCounts[mx.id] ?? 0;
                return (
                  <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 space-y-3">
                    {/* Header info */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                          ⚔️ TMMatch{mx.match_time ? ` · ${mx.match_time.slice(0, 5)}` : ""}
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-400 truncate">
                          {label} · {conv} convocati
                        </div>
                      </div>
                    </div>
                    {/* Risultato buttons */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge
                        variant={
                          mx.status === "won"
                            ? "default"
                            : mx.status === "lost"
                              ? "destructive"
                              : mx.status === "draw"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {mx.status === "won"
                          ? "Vinta"
                          : mx.status === "draw"
                            ? "Pareggio"
                            : mx.status === "lost"
                              ? "Persa"
                              : "Programmata"}
                      </Badge>
                      <Button
                        size="sm"
                        variant={mx.status === "won" ? "default" : "outline"}
                        onClick={() => setMatchStatus("won")}
                      >
                        <Trophy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={mx.status === "draw" ? "secondary" : "outline"}
                        onClick={() => setMatchStatus("draw")}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={mx.status === "lost" ? "destructive" : "outline"}
                        onClick={() => setMatchStatus("lost")}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </Button>
                      {mx.status !== "scheduled" && (
                        <Button size="sm" variant="ghost" onClick={() => setMatchStatus("scheduled")}>
                          Azzera
                        </Button>
                      )}
                    </div>
                    {/* Convocazioni */}
                    {matchLoading ? (
                      <div className="text-xs text-muted-foreground py-2">Caricamento convocati…</div>
                    ) : matchEditing ? (
                      /* ── Editing mode ── */
                      <div className="border-t pt-3 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const all: Record<string, CallUpRole> = {};
                              players.forEach((p) => {
                                all[p.id] = "starter";
                              });
                              setMatchPicks(all);
                              setMatchDirty(true);
                            }}
                          >
                            Tutti titolari
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setMatchPicks({});
                              setMatchDirty(true);
                            }}
                          >
                            Azzera
                          </Button>
                          {matchDirty && (
                            <span className="text-xs text-amber-500 font-medium self-center">● Non salvato</span>
                          )}
                        </div>
                        <ul className="divide-y max-h-[40vh] overflow-auto rounded border bg-background">
                          {players.map((p) => {
                            const role = matchPicks[p.id] || "out";
                            const jersey = matchJerseys[p.id];
                            const isConvocato = role !== "out";
                            return (
                              <li key={p.id} className="flex items-center gap-2 py-2 px-3">
                                <span className="flex-1 text-sm font-medium truncate">{p.full_name}</span>
                                {isConvocato && (
                                  <Input
                                    type="number"
                                    min={1}
                                    max={25}
                                    placeholder="#"
                                    value={jersey ?? ""}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value);
                                      setMatchJerseys((prev) => {
                                        const next = { ...prev };
                                        if (e.target.value === "" || isNaN(v)) {
                                          delete next[p.id];
                                          return next;
                                        }
                                        next[p.id] = Math.min(25, Math.max(1, v));
                                        return next;
                                      });
                                      setMatchDirty(true);
                                    }}
                                    className="h-8 w-14 text-center"
                                  />
                                )}
                                <Select
                                  value={role}
                                  onValueChange={(v) => {
                                    setMatchPicks((prev) => ({ ...prev, [p.id]: v as CallUpRole }));
                                    setMatchDirty(true);
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="out">Non convocato</SelectItem>
                                    <SelectItem value="starter">Titolare</SelectItem>
                                    <SelectItem value="bench">Panchina</SelectItem>
                                    <SelectItem value="linesman">Guardalinee</SelectItem>
                                  </SelectContent>
                                </Select>
                              </li>
                            );
                          })}
                          {players.length === 0 && (
                            <li className="p-4 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                          )}
                        </ul>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setMatchEditing(false);
                              setMatchDirty(false);
                            }}
                          >
                            Annulla
                          </Button>
                          <Button onClick={saveMatchCallups} disabled={matchSaving}>
                            {matchSaving ? "Salvataggio…" : "Salva convocazioni"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ── Read-only view ── */
                      <div className="border-t pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Convocati ({conv})
                          </span>
                          <Button size="sm" variant="outline" onClick={() => setMatchEditing(true)}>
                            ✏️ {conv > 0 ? "Modifica" : "Aggiungi convocati"}
                          </Button>
                        </div>
                        {conv === 0 ? (
                          <p className="text-xs text-muted-foreground">Nessun convocato inserito</p>
                        ) : (
                          <ul className="divide-y rounded border bg-background max-h-[30vh] overflow-auto">
                            {players
                              .filter((p) => matchPicks[p.id] && matchPicks[p.id] !== "out")
                              .sort((a, b) => (matchJerseys[a.id] ?? 99) - (matchJerseys[b.id] ?? 99))
                              .map((p) => {
                                const role = matchPicks[p.id];
                                const jersey = matchJerseys[p.id];
                                return (
                                  <li key={p.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                                    {jersey != null && (
                                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                        {jersey}
                                      </span>
                                    )}
                                    <span className="flex-1 font-medium truncate">{p.full_name}</span>
                                    <Badge
                                      variant={
                                        role === "starter" ? "default" : role === "bench" ? "secondary" : "outline"
                                      }
                                      className="text-xs"
                                    >
                                      {role === "starter" ? "Titolare" : role === "bench" ? "Panchina" : "Guardalinee"}
                                    </Badge>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            {!selectedMatch && (
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca giocatore"
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPresentArr(players.map((p) => p.id));
                    setDirty(true);
                  }}
                >
                  Tutti presenti
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPresentArr([]);
                    setDirty(true);
                  }}
                >
                  Tutti assenti
                </Button>
                <Badge variant="secondary">
                  {present.size}/{players.length}
                </Badge>
                {dirty && <span className="text-xs text-amber-500 font-medium">● Non salvato</span>}
              </div>
            )}
            {!selectedMatch &&
              (isPastDate && !isEditingPast ? (
                /* ── Read-only: past training ── */
                <Card className="p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">Presenze registrate</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {[...existing.values()].filter((v) => v === "training_attendance").length}/{players.length}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Pre-populate checkboxes from saved state
                          const presentIds = [...existing.entries()]
                            .filter(([_k, v]) => v === "training_attendance")
                            .map(([k]) => k);
                          setPresentArr(presentIds);
                          setDirty(false);
                          setIsEditingPast(true);
                        }}
                      >
                        ✏️ Modifica
                      </Button>
                    </div>
                  </div>
                  <ul className="divide-y max-h-[50vh] overflow-auto border rounded-md">
                    {filtered.map((p) => {
                      const status = existing.get(p.id);
                      const isPresent = status === "training_attendance";
                      const isAbsent = status === "training_absence";
                      return (
                        <li key={p.id} className="flex items-center gap-3 p-3">
                          <div className="flex-1 min-w-0 font-medium truncate">{p.full_name}</div>
                          {isPresent && <Badge className="bg-emerald-500 text-white">✓ Presente</Badge>}
                          {isAbsent && (
                            <Badge variant="outline" className="text-muted-foreground">
                              ✗ Assente
                            </Badge>
                          )}
                          {!status && (
                            <Badge variant="outline" className="text-muted-foreground opacity-50">
                              —
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                    {filtered.length === 0 && (
                      <li className="p-6 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                    )}
                  </ul>
                </Card>
              ) : (
                /* ── Editable: future/today training ── */
                <>
                  <Card>
                    <ul className="divide-y max-h-[50vh] overflow-auto">
                      {filtered.map((p) => {
                        const on = present.has(p.id);
                        const saved = existing.get(p.id);
                        const savedLabel =
                          saved === "training_attendance"
                            ? "✓ presente"
                            : saved === "training_absence"
                              ? "✗ assente"
                              : "non impostato";
                        return (
                          <li
                            key={p.id}
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40"
                            onClick={() => toggle(p.id)}
                          >
                            <Checkbox checked={on} onCheckedChange={() => toggle(p.id)} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{p.full_name}</div>
                              <div className="text-[10px] text-muted-foreground">Stato salvato: {savedLabel}</div>
                            </div>
                            <Badge variant={on ? "default" : "outline"}>{on ? "Presente" : "Assente"}</Badge>
                          </li>
                        );
                      })}
                      {filtered.length === 0 && (
                        <li className="p-6 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                      )}
                    </ul>
                  </Card>
                  <div className="flex flex-col gap-2">
                    {isPastDate && (
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setIsEditingPast(false)}>
                        Annulla modifica
                      </Button>
                    )}
                    <Button size="lg" onClick={save} disabled={saving || !date} className="w-full md:w-auto">
                      {saving ? "Salvataggio…" : "Salva presenze"}
                    </Button>
                  </div>
                </>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Matches ----------------------------- */

type TMMatch = {
  id: string;
  category: string;
  match_date: string;
  match_time?: string | null;
  week: number;
  opponent: string;
  status: string;
  home_away?: "home" | "away";
};

function MatchesSection({ category }: { category: string }) {
  const { user } = useAuth();
  const { seasonId, activeSeason } = useSeason();
  const [matches, setMatches] = useState<TMMatch[]>([]);
  const [players, setPlayers] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({
    match_date: new Date().toISOString().slice(0, 10),
    match_time: "",
    opponent: "",
    home_away: "home" as "home" | "away",
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const draftKey = openId ? `draft_convocations_${openId}` : "__none__";
  const [picks, setPicks, clearPicks] = useDraftState<Record<string, CallUpRole>>(draftKey, {});
  const jerseyDraftKey = openId ? `draft_jerseys_${openId}` : "__none__";
  const [jerseys, setJerseys, clearJerseys] = useDraftState<Record<string, number>>(jerseyDraftKey, {});
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from("matches").select("*").eq("category", category).order("match_date", { ascending: false }),
      supabase.from("players").select("id,full_name").eq("category", category).order("full_name"),
    ]);
    setMatches(((m as any[]) || []) as TMMatch[]);
    setPlayers(p || []);
    const ids = (((m as any[]) || []) as TMMatch[]).map((x) => x.id);
    if (ids.length) {
      const { data: ev } = await supabase
        .from("weekly_events")
        .select("match_id,player_id,rule_key")
        .in("match_id", ids)
        .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
      const c: Record<string, Set<string>> = {};
      (ev || []).forEach((r: any) => {
        (c[r.match_id] ||= new Set()).add(r.player_id);
      });
      const out: Record<string, number> = {};
      Object.entries(c).forEach(([k, set]) => {
        out[k] = set.size;
      });
      setCounts(out);
    } else {
      setCounts({});
    }
  };

  useEffect(() => {
    load();
  }, [category]);
  useEffect(() => {
    if (!openId) {
      setDirty(false);
      return;
    }
    setDirty(!!localStorage.getItem(`draft_convocations_${openId}`));
  }, [openId]);
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") window.dispatchEvent(new Event("storage"));
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const create = async () => {
    if (!form.opponent.trim()) return toast.error("Inserisci l'avversario");
    const week = weekOf(form.match_date, activeSeason?.starts_at);
    const { error } = await supabase.from("matches").insert({
      category,
      match_date: form.match_date,
      match_time: form.match_time || null,
      opponent: form.opponent.trim(),
      week,
      season: SEASON,
      season_id: seasonId ?? null,
      home_away: form.home_away as string,
    });
    if (error) return toast.error(error.message);
    toast.success("Partita creata");
    setForm({ ...form, opponent: "", match_time: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare la partita?")) return;
    await supabase.from("weekly_events").delete().eq("match_id", id);
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Partita eliminata");
    load();
  };

  const setStatus = async (m: TMMatch, status: "won" | "draw" | "lost" | "scheduled") => {
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", m.id)
      .in("rule_key", ["match_win", "match_loss", "match_draw"]);
    if (status !== "scheduled") {
      const { data: callups } = await supabase
        .from("weekly_events")
        .select("player_id")
        .eq("match_id", m.id)
        .in("rule_key", ["starting_xv", "on_the_bench"]);
      const playerIds = Array.from(new Set((callups || []).map((r: any) => r.player_id)));
      const rule_key = status === "won" ? "match_win" : status === "draw" ? "match_draw" : "match_loss";
      if (playerIds.length) {
        const rows = playerIds.map((player_id) => ({
          player_id,
          rule_key,
          week: m.week,
          quantity: 1,
          match_id: m.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${m.id}`,
          inserted_by: user?.id ?? null,
          inserted_at: new Date().toISOString(),
        }));
        const { error: insErr } = await supabase.from("weekly_events").insert(rows);
        if (insErr) return toast.error(insErr.message);
      }
    }
    const { error } = await supabase.from("matches").update({ status }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(
      status === "won"
        ? "Vittoria"
        : status === "draw"
          ? "Pareggio"
          : status === "lost"
            ? "Sconfitta"
            : "Risultato azzerato",
    );
    load();
  };

  const openMatch = async (m: TMMatch) => {
    if (openId === m.id) {
      setOpenId(null);
      return;
    }
    setOpenId(m.id);
    const { data } = await supabase
      .from("weekly_events")
      .select("player_id,rule_key,jersey_number")
      .eq("match_id", m.id)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
    const next: Record<string, CallUpRole> = {};
    const nextJerseys: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      next[r.player_id] =
        r.rule_key === "starting_xv" ? "starter" : r.rule_key === "on_the_bench" ? "bench" : "linesman";
      if (r.jersey_number) nextJerseys[r.player_id] = r.jersey_number;
    });
    if (!localStorage.getItem(`draft_convocations_${m.id}`)) {
      setPicks(next);
      setJerseys(nextJerseys);
      setDirty(false);
    } else if (!localStorage.getItem(`draft_jerseys_${m.id}`)) {
      // picks draft exists but jerseys draft doesn't — seed jerseys from DB
      setJerseys(nextJerseys);
    }
  };

  const saveCallups = async (m: TMMatch) => {
    setSaving(true);
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", m.id)
      .in("rule_key", ["starting_xv", "on_the_bench", "linesman_call"]);
    const rows: any[] = [];
    Object.entries(picks).forEach(([player_id, role]) => {
      if (role === "out") return;
      const rule_key = role === "starter" ? "starting_xv" : role === "bench" ? "on_the_bench" : "linesman_call";
      rows.push({
        player_id,
        rule_key,
        week: m.week,
        quantity: 1,
        match_id: m.id,
        season: SEASON,
        season_id: seasonId ?? null,
        notes: `match:${m.id}`,
        inserted_by: user?.id ?? null,
        inserted_at: new Date().toISOString(),
        jersey_number: jerseys[player_id] ?? null,
      });
    });
    if (rows.length) {
      const { error } = await supabase.from("weekly_events").insert(rows);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    if (m.status === "won" || m.status === "draw" || m.status === "lost") {
      await supabase
        .from("weekly_events")
        .delete()
        .eq("match_id", m.id)
        .in("rule_key", ["match_win", "match_draw", "match_loss"]);
      const rule_key = m.status === "won" ? "match_win" : m.status === "draw" ? "match_draw" : "match_loss";
      const conv = Object.entries(picks)
        .filter(([_k, r]) => r === "starter" || r === "bench")
        .map(([player_id]) => ({
          player_id,
          rule_key,
          week: m.week,
          quantity: 1,
          match_id: m.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${m.id}`,
          inserted_by: user?.id ?? null,
          inserted_at: new Date().toISOString(),
        }));
      if (conv.length) await supabase.from("weekly_events").insert(conv);
    }
    setSaving(false);
    toast.success(`Convocazioni salvate (${rows.length})`);
    clearPicks();
    clearJerseys();
    setDirty(false);
    setOpenId(null);
    load();
  };

  const setRole = (pid: string, role: CallUpRole) => {
    setPicks((prev) => ({ ...prev, [pid]: role }));
    setDirty(true);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-bold mb-3">Nuova partita</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Data</Label>
            <Input
              type="date"
              value={form.match_date}
              onChange={(e) => setForm({ ...form, match_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Orario kick-off</Label>
            <Input
              type="time"
              value={form.match_time}
              onChange={(e) => setForm({ ...form, match_time: e.target.value })}
              placeholder="es. 15:00"
            />
          </div>
          <div>
            <Label>Avversario</Label>
            <Input
              value={form.opponent}
              onChange={(e) => setForm({ ...form, opponent: e.target.value })}
              placeholder="es. Cernusco Rugby"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() => setForm({ ...form, home_away: "home" })}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                form.home_away === "home"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              🏠 Casa
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, home_away: "away" })}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l ${
                form.home_away === "away"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              ✈️ Trasferta
            </button>
          </div>
          <Button onClick={create} className="w-full md:w-auto">
            Crea partita
          </Button>
        </div>
      </Card>
      <div className="space-y-3">
        {matches.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nessuna partita</Card>}
        {matches.map((m) => {
          const isOpen = openId === m.id;
          const conv = counts[m.id] ?? 0;
          return (
            <Card key={m.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-semibold">{formatTMMatch(m.home_away ?? "home", m.opponent)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.match_date + "T00:00:00").toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {m.match_time && ` · ${m.match_time.slice(0, 5)}`}
                    {` · W${m.week} · ${conv} convocati`}
                  </div>
                </div>
                <Badge
                  variant={
                    m.status === "won"
                      ? "default"
                      : m.status === "lost"
                        ? "destructive"
                        : m.status === "draw"
                          ? "secondary"
                          : "outline"
                  }
                >
                  {m.status === "won"
                    ? "Vinta"
                    : m.status === "draw"
                      ? "Pareggio"
                      : m.status === "lost"
                        ? "Persa"
                        : "Programmata"}
                </Badge>
                <Button
                  size="sm"
                  variant={m.status === "won" ? "default" : "outline"}
                  onClick={() => setStatus(m, "won")}
                >
                  <Trophy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={m.status === "draw" ? "secondary" : "outline"}
                  onClick={() => setStatus(m, "draw")}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={m.status === "lost" ? "destructive" : "outline"}
                  onClick={() => setStatus(m, "lost")}
                >
                  <ShieldAlert className="h-4 w-4" />
                </Button>
                {m.status !== "scheduled" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(m, "scheduled")}>
                    Azzera
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openMatch(m)}>
                  <Users className="h-4 w-4 mr-1" />
                  {isOpen ? "Chiudi" : "Convoca"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {isOpen && (
                <div className="mt-3 border-t pt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const all: Record<string, CallUpRole> = {};
                        players.forEach((p) => {
                          all[p.id] = "starter";
                        });
                        setPicks(all);
                        setDirty(true);
                      }}
                    >
                      Tutti titolari
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPicks({});
                        setDirty(true);
                      }}
                    >
                      Azzera
                    </Button>
                  </div>
                  <ul className="divide-y max-h-[55vh] overflow-auto">
                    {players.map((p) => {
                      const role = picks[p.id] || "out";
                      const isConvocato = role !== "out";
                      return (
                        <li key={p.id} className="flex items-center gap-2 py-2">
                          <span className="flex-1 text-sm font-medium truncate">{p.full_name}</span>
                          {isConvocato && (
                            <Input
                              type="number"
                              min={1}
                              max={25}
                              placeholder="#"
                              value={jerseys[p.id] ?? ""}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                setJerseys((prev) => {
                                  const next = { ...prev };
                                  if (e.target.value === "" || isNaN(v)) {
                                    delete next[p.id];
                                    return next;
                                  }
                                  next[p.id] = Math.min(25, Math.max(1, v));
                                  return next;
                                });
                                setDirty(true);
                              }}
                              className="h-8 w-14 text-center"
                            />
                          )}
                          <Select value={role} onValueChange={(v) => setRole(p.id, v as CallUpRole)}>
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="out">Non convocato</SelectItem>
                              <SelectItem value="starter">Titolare</SelectItem>
                              <SelectItem value="bench">Panchina</SelectItem>
                              <SelectItem value="linesman">Guardalinee</SelectItem>
                            </SelectContent>
                          </Select>
                        </li>
                      );
                    })}
                    {players.length === 0 && (
                      <li className="p-4 text-center text-sm text-muted-foreground">Nessun giocatore</li>
                    )}
                  </ul>
                  <div className="flex justify-end gap-2 items-center">
                    {dirty && <span className="text-xs text-amber-500 font-medium">● Modifiche non salvate</span>}
                    <Button variant="outline" onClick={() => setOpenId(null)}>
                      Annulla
                    </Button>
                    <Button onClick={() => saveCallups(m)} disabled={saving}>
                      {saving ? "Salvataggio…" : "Salva convocazioni"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
/* ----------------------------- Events / Punteggi ----------------------------- */

function EventsSection({ category }: { category: string }) {
  const { user } = useAuth();
  const { seasonId } = useSeason();
  const [players, setPlayers] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState({ player_id: "", rule_key: "", week: 1, quantity: 1 });

  const load = async () => {
    const playerIdsRes = await supabase
      .from("players")
      .select("id,full_name")
      .eq("category", category)
      .order("full_name");
    const ids = (playerIdsRes.data || []).map((p: any) => p.id);
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase
        .from("scoring_rules")
        .select("*")
        .eq("is_active", true)
        .in("applies_to", ["player", "both"])
        .order("sort_order"),
      ids.length
        ? supabase
            .from("weekly_events")
            .select("*,players(full_name),scoring_rules(label,points)")
            .in("player_id", ids)
            .order("week", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setPlayers(playerIdsRes.data || []);
    setRules(r || []);
    setEvents(e || []);
  };
  useEffect(() => {
    load();
  }, [category]);

  const add = async () => {
    if (!form.player_id || !form.rule_key) return toast.error("Compila tutti i campi");
    const { error } = await supabase.from("weekly_events").insert({
      player_id: form.player_id,
      rule_key: form.rule_key,
      week: form.week,
      quantity: form.quantity,
      season: SEASON,
      season_id: seasonId ?? null,
      inserted_by: user?.id ?? null,
      inserted_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Evento registrato");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("weekly_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const grouped = useMemo(() => {
    const m: Record<number, any[]> = {};
    events.forEach((e) => {
      (m[e.week] ||= []).push(e);
    });
    return Object.entries(m).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [events]);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-bold">Registra evento</h3>
        <div>
          <Label>Giocatore</Label>
          <Select value={form.player_id} onValueChange={(v) => setForm({ ...form, player_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona…" />
            </SelectTrigger>
            <SelectContent>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Evento</Label>
          <Select value={form.rule_key} onValueChange={(v) => setForm({ ...form, rule_key: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona…" />
            </SelectTrigger>
            <SelectContent>
              {rules.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label} ({r.points > 0 ? "+" : ""}
                  {r.points})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Settimana</Label>
            <Input
              type="number"
              value={form.week}
              onChange={(e) => setForm({ ...form, week: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Quantità</Label>
            <Input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </div>
        </div>
        <Button onClick={add} className="w-full">
          Aggiungi evento
        </Button>
      </Card>
      <Card>
        <div className="p-4 border-b font-semibold">Eventi recenti</div>
        <div className="max-h-[55vh] overflow-auto">
          {grouped.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nessun evento</div>}
          {grouped.map(([week, list]) => (
            <div key={week}>
              <div className="px-4 py-2 bg-muted/40 text-xs font-semibold">Settimana {week}</div>
              <ul className="divide-y">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{e.players?.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.scoring_rules?.label} ×{e.quantity}
                      </div>
                    </div>
                    <div
                      className={`font-bold ${(e.scoring_rules?.points ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}
                    >
                      {e.quantity * (e.scoring_rules?.points || 0) > 0 ? "+" : ""}
                      {e.quantity * (e.scoring_rules?.points || 0)}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- Special Actions ----------------------------- */

function weekToDateRange(week: number | null | undefined, seasonStart?: string): string {
  if (!week || week <= 0) return "Senza data";
  const start = seasonStart ? new Date(seasonStart) : new Date("2025-09-01T00:00:00Z");
  const weekStart = new Date(start.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmtShort = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const fmtFull = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  return `${fmtShort(weekStart)} – ${fmtFull(weekEnd)}`;
}

function SpecialActionsSection({ category }: { category: string }) {
  const { activeSeason } = useSeason();
  const [players, setPlayers] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", description: "", points: 5 });
  const [pick, setPick] = useState<Record<string, string>>({});
  const [expiryDraft, setExpiryDraft] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data: p }, { data: co }, { data: a }, { data: c }] = await Promise.all([
      supabase.from("players").select("id,full_name").order("full_name"),
      supabase.from("coaches").select("id,full_name").order("full_name"),
      supabase
        .from("special_actions")
        .select("*")
        .eq("season_id", activeSeason?.id ?? "")
        .order("week", { ascending: false }),
      supabase.from("special_action_completions").select("*,players(full_name),coaches(full_name)"),
    ]);
    setPlayers(p || []);
    setCoaches(co || []);
    setActions(a || []);
    setCompletions(c || []);
  };

  useEffect(() => {
    if (activeSeason?.id) load();
  }, [category, activeSeason?.id]);

  const create = async () => {
    if (!form.title) return toast.error("Titolo obbligatorio");
    if (!activeSeason?.id) return toast.error("Nessuna stagione attiva");
    const { error } = await supabase.from("special_actions").insert({
      ...form,
      week: computeCurrentWeek(activeSeason.starts_at),
      season_id: activeSeason.id,
      season: SEASON,
    });
    if (error) return toast.error(error.message);
    toast.success("Azione creata");
    setForm({ ...form, title: "", description: "" });
    load();
  };

  const removeAction = async (id: string) => {
    await supabase.from("special_action_completions").delete().eq("action_id", id);
    await supabase.from("special_actions").delete().eq("id", id);
    load();
  };

  const addCompletion = async (action_id: string) => {
    const value = pick[action_id];
    if (!value) return;
    const [kind, id] = value.split(":");
    const payload: any = { action_id };
    if (kind === "coach") payload.coach_id = id;
    else payload.player_id = id;
    const { error } = await supabase.from("special_action_completions").insert(payload);
    if (error) return toast.error("Già registrato o errore");
    setPick({ ...pick, [action_id]: "" });
    load();
  };

  const removeCompletion = async (id: string) => {
    await supabase.from("special_action_completions").delete().eq("id", id);
    load();
  };

  const saveExpiry = async (id: string) => {
    const value = expiryDraft[id] ?? "";
    const { error } = await supabase
      .from("special_actions")
      .update({ expires_at: value || null } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Scadenza aggiornata");
    load();
  };

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6">
      <Card className="p-5 h-fit">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Nuova azione speciale
        </h3>
        <div className="space-y-3">
          <div>
            <Label>Titolo</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Entra in campo con la maglia al contrario"
            />
          </div>
          <div>
            <Label>Descrizione</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Punti</Label>
              <Input
                type="number"
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Se più di un giocatore completa la stessa azione, i punti diventano malus per tutti.
          </p>
          <Button onClick={create} className="w-full">
            Pubblica
          </Button>
        </div>
      </Card>
      <div className="space-y-4">
        {actions.map((a) => {
          const compls = completions.filter((c) => c.action_id === a.id);
          const isPenalty = compls.length > 1;
          const todayStr = new Date().toISOString().slice(0, 10);
          const expired = a.expires_at && a.expires_at < todayStr;
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{a.title}</span>
                    <Badge variant="outline">{weekToDateRange(a.week, activeSeason?.starts_at)}</Badge>
                    <Badge
                      className={
                        isPenalty ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                      }
                    >
                      {isPenalty ? `−${a.points}` : `+${a.points}`}
                    </Badge>
                    {expired && <Badge variant="destructive">Scaduta</Badge>}
                    {isPenalty && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Penalty: troppi l'hanno fatta
                      </span>
                    )}
                  </div>
                  {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeAction(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Label className="text-xs">Scadenza:</Label>
                <Input
                  type="date"
                  className="w-auto"
                  value={expiryDraft[a.id] ?? a.expires_at ?? ""}
                  onChange={(e) => setExpiryDraft({ ...expiryDraft, [a.id]: e.target.value })}
                />
                <Button size="sm" variant="outline" onClick={() => saveExpiry(a.id)}>
                  Salva scadenza
                </Button>
                {a.expires_at && <span className="text-xs text-muted-foreground">Attuale: {a.expires_at}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {compls.map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1">
                    {c.players?.full_name ?? c.coaches?.full_name}
                    {c.coaches && <span className="text-[10px] opacity-70">(All.)</span>}
                    <button onClick={() => removeCompletion(c.id)} className="ml-1">
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Select value={pick[a.id] || ""} onValueChange={(v) => setPick({ ...pick, [a.id]: v })}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Aggiungi giocatore o allenatore…" />
                  </SelectTrigger>
                  <SelectContent>
                    {players
                      .filter((p) => !compls.some((c) => c.player_id === p.id))
                      .map((p) => (
                        <SelectItem key={`p-${p.id}`} value={`player:${p.id}`}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    {coaches
                      .filter((co) => !compls.some((c) => c.coach_id === co.id))
                      .map((co) => (
                        <SelectItem key={`c-${co.id}`} value={`coach:${co.id}`}>
                          🧢 {co.full_name} (All.)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => addCompletion(a.id)}>
                  +
                </Button>
              </div>
            </Card>
          );
        })}
        {actions.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Ancora nessuna azione speciale.</p>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Quotas (read-only) ----------------------------- */

function QuotasSection() {
  const [config, setConfig] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: cfg }, { data: r }] = await Promise.all([
        supabase.from("team_config").select("*").order("sort_order"),
        supabase.from("scoring_rules").select("*").eq("is_active", true).order("sort_order"),
      ]);
      setConfig(cfg || []);
      setRules(r || []);
    })();
  }, []);

  const grouped = useMemo(() => {
    const m: Record<string, any[]> = {};
    config.forEach((c) => {
      (m[c.group_name || "Altro"] ||= []).push(c);
    });
    return Object.entries(m);
  }, [config]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-4 border-b font-semibold">Configurazione squadra</div>
        {grouped.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nessuna configurazione</div>}
        {grouped.map(([g, items]) => (
          <div key={g} className="border-b last:border-b-0">
            <div className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide">{g}</div>
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.key} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>{it.label}</span>
                  <Badge variant="secondary">{it.value}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
      <Card>
        <div className="p-4 border-b font-semibold">Regole punteggio attive</div>
        <ul className="divide-y max-h-[40vh] overflow-auto">
          {rules.map((r) => (
            <li key={r.key} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{r.label}</span>
              <Badge variant={r.points >= 0 ? "default" : "destructive"}>
                {r.points > 0 ? "+" : ""}
                {r.points}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
