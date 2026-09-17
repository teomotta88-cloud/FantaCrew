import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useDraftState } from "@/hooks/useDraftState";
import { useAuth } from "@/contexts/AuthContext";
import { useTeamManager } from "@/hooks/useTeamManager";
import { useSeason } from "@/contexts/SeasonContext";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { toast } from "sonner";
import { currentWeek, weekOf } from "@/lib/week";
import { SEASON } from "@/lib/constants";
import { Trash2, Trophy, ShieldAlert, Minus, Users, Sparkles, AlertTriangle } from "lucide-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { useCrew } from "@/contexts/CrewContext";
type Training = {
  id: string;
  training_date: string;
  start_time: string | null;
  location: string | null;
  category: string;
};

type CallUpRole = "out" | "starter" | "bench" | "linesman";

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

function fmtLocal(d: Date): string {
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

type CalendarGridProps = {
  month: Date;
  trainings: Training[];
  scheduledDates: string[];
  matches: CalendarMatchRow[];
  selectedDate: string | null;
  onDayClick: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function CalendarGrid({
  month,
  trainings,
  scheduledDates,
  matches,
  selectedDate,
  onDayClick,
  onPrevMonth,
  onNextMonth,
}: CalendarGridProps) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const todayStr = fmtLocal(new Date());
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
          const ds = fmtLocal(date);
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

export const Route = createFileRoute("/$crewSlug/tm")({
  component: TMPage,
  head: () => ({ meta: [{ title: "Team Manager — Fanta Lambro" }] }),
});

function formatMatch(homeAway: "home" | "away", opponent: string): string {
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

function TMPage() {
  const { crewSlug } = useCrew();
  const { user, loading: authLoading } = useAuth();
  const { tm, isTeamManager, loading: tmLoading } = useTeamManager();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || tmLoading) return;
    if (!user) navigate({ to: "/login", replace: true });
    else if (!isTeamManager) navigate({ to: "/$crewSlug/dashboard", replace: true, params: { crewSlug }});
  }, [authLoading, tmLoading, user, isTeamManager, navigate]);

  if (authLoading || tmLoading || !tm) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto p-6 text-sm text-muted-foreground">Caricamento…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <main className="container mx-auto px-3 md:px-6 py-4 md:py-8 space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Team Manager</h1>
            <p className="text-sm text-muted-foreground">Gestisci la tua categoria pitchside.</p>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1">
            {tm.category}
          </Badge>
        </header>

        <Card className="p-3 md:p-4 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5">
          <div className="text-sm">
            <span className="font-semibold">Sei anche un manager Fanta! 🏉</span>
            <span className="text-muted-foreground"> Gestisci la tua rosa e sfida gli altri.</span>
          </div>
          <Button asChild size="sm">
            <Link to="/$crewSlug/team" params={{ crewSlug }}>Vai alla tua squadra →</Link>
          </Button>
        </Card>

        <TMTabs category={tm.category} />
      </main>
      <MobileBottomNav />
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
  const isPastDate = !!selectedDate && selectedDate < fmtLocal(new Date());
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
    const first = fmtLocal(new Date(y, mo, 1));
    const last = fmtLocal(new Date(y, mo + 1, 0));
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
    const first = fmtLocal(new Date(y, mo, 1));
    const last = fmtLocal(new Date(y, mo + 1, 0));
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
      <CalendarGrid
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
                          ⚔️ Match{mx.match_time ? ` · ${mx.match_time.slice(0, 5)}` : ""}
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
                              players.forEach((p) => { all[p.id] = "starter"; });
                              setMatchPicks(all);
                              setMatchDirty(true);
                            }}
                          >
                            Tutti titolari
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setMatchPicks({}); setMatchDirty(true); }}
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
                                    type="number" min={1} max={25} placeholder="#"
                                    value={jersey ?? ""}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value);
                                      setMatchJerseys((prev) => {
                                        const next = { ...prev };
                                        if (e.target.value === "" || isNaN(v)) { delete next[p.id]; return next; }
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
                                  <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
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
                          <Button variant="outline" onClick={() => { setMatchEditing(false); setMatchDirty(false); }}>
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
                                    <Badge variant={role === "starter" ? "default" : role === "bench" ? "secondary" : "outline"} className="text-xs">
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
            {!selectedMatch && (isPastDate && !isEditingPast ? (
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

function MatchesSection({ category }: { category: string }) {
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
      // picks draft exists but jerseys draft doesn't — seed jerseys from DB
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
                  <div className="font-semibold">{formatMatch(m.home_away ?? "home", m.opponent)}</div>
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
      week: currentWeek(activeSeason.starts_at),
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