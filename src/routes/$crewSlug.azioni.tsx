import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBlockTM } from "@/hooks/useBlockTM";
import { SEASON } from "@/lib/constants";
import { useSeason } from "@/contexts/SeasonContext";
import { ZaghettoIcon } from "@/components/ZaghettoIcon";
import { Zap, AlertTriangle, Users } from "lucide-react";

// Converts week number to date range string (e.g. "19 mag – 25 mag 2026")
function weekToDateRange(week: number | null | undefined, seasonStart?: string): string {
  if (!week || week <= 0) return "Senza data";
  const start = seasonStart ? new Date(seasonStart) : new Date("2025-09-01T00:00:00Z");
  const weekStart = new Date(start.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  const fmtShort = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  // If same year, show short for start
  return `${fmtShort(weekStart)} – ${fmt(weekEnd)}`;
}
export const Route = createFileRoute("/$crewSlug/azioni")({
  component: AzioniPage,
  head: () => ({
    meta: [
      { title: "⚡ Azioni Speciali — Fanta Lambro" },
      { name: "description", content: "Le azioni speciali della settimana. Fai punti… ma occhio al malus!" },
    ],
  }),
});

type Action = { id: string; title: string; description: string | null; points: number; week: number };
type Completion = {
  id: string;
  action_id: string;
  player_id: string | null;
  coach_id: string | null;
  players: { id: string; full_name: string; photo_url: string | null } | null;
  coaches: { id: string; full_name: string; photo_url: string | null } | null;
};

function AzioniPage() {
  useBlockTM();
  const { user } = useAuth();
  const { seasonId, activeSeason } = useSeason();
  const [actions, setActions] = useState<Action[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [myPlayerIds, setMyPlayerIds] = useState<Set<string>>(new Set());
  const [myCoachIds, setMyCoachIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const actionsQ = supabase
        .from("special_actions")
        .select("*")
        .or(`expires_at.is.null,expires_at.gte.${todayStr}`)
        .order("week", { ascending: false });
      const [{ data: a }, { data: c }] = await Promise.all([
        seasonId ? actionsQ.eq("season_id", seasonId) : actionsQ.eq("season", SEASON),
        supabase
          .from("special_action_completions")
          .select("id,action_id,player_id,coach_id,players(id,full_name,photo_url),coaches(id,full_name,photo_url)"),
      ]);
      setActions((a as Action[]) || []);
      setCompletions((c as unknown as Completion[]) || []);
    })();
  }, [seasonId]);

  useEffect(() => {
    if (!user) {
      setMyPlayerIds(new Set());
      setMyCoachIds(new Set());
      return;
    }
    (async () => {
      const teamQ = supabase.from("teams").select("id").eq("manager_id", user.id);
      const { data: team } = await (
        seasonId ? teamQ.eq("season_id", seasonId) : teamQ.eq("season", SEASON)
      ).maybeSingle();
      if (!team) return;
      const [{ data: tp }, { data: tc }] = await Promise.all([
        supabase.from("team_players").select("player_id").eq("team_id", team.id),
        supabase.from("team_coaches").select("coach_id").eq("team_id", team.id),
      ]);
      setMyPlayerIds(new Set((tp || []).map((r: any) => r.player_id)));
      setMyCoachIds(new Set((tc || []).map((r: any) => r.coach_id)));
    })();
  }, [user, seasonId]);

  const renderAction = (a: Action, dimmed = false) => {
    const compls = completions.filter((c) => c.action_id === a.id);
    const isPenalty = compls.length > 1;
    const myDoers = compls.filter(
      (c) => (c.player_id && myPlayerIds.has(c.player_id)) || (c.coach_id && myCoachIds.has(c.coach_id)),
    );
    return (
      <Card key={a.id} className={`p-5 ${dimmed ? "opacity-60" : ""} ${isPenalty ? "border-destructive/50" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline">{weekToDateRange(a.week, activeSeason?.starts_at)}</Badge>
              {isPenalty && (
                <Badge className="bg-destructive text-destructive-foreground gap-1">
                  <AlertTriangle className="h-3 w-3" /> MALUS attivo
                </Badge>
              )}
            </div>
            <h3 className="text-xl font-bold leading-tight">{a.title}</h3>
            {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
          </div>
          <div className="text-right shrink-0">
            <div
              className={`text-3xl font-extrabold flex items-center gap-1 ${isPenalty ? "text-destructive" : "text-primary"}`}
            >
              {isPenalty ? "−" : "+"}
              {a.points}
              <ZaghettoIcon className="h-[1em] w-[1em]" />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Attenzione: se la fanno in più di uno, diventano malus per tutti!
        </div>
        {compls.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Users className="h-3 w-3" /> Hanno completato ({compls.length}):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {compls.map((c) => {
                const subject = c.players ?? c.coaches;
                const mine =
                  (c.player_id && myPlayerIds.has(c.player_id)) || (c.coach_id && myCoachIds.has(c.coach_id));
                const isCoach = !!c.coach_id;
                return (
                  <Badge key={c.id} variant={mine ? "default" : "secondary"} className="gap-1.5 pl-1">
                    <Avatar className="h-5 w-5">
                      {subject?.photo_url && <AvatarImage src={subject.photo_url} />}
                      <AvatarFallback className="text-[9px]">
                        {subject?.full_name?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {subject?.full_name}
                    {isCoach && <span className="text-[9px] opacity-70">All.</span>}
                  </Badge>
                );
              })}
            </div>
            {user && myDoers.length > 0 && (
              <div className="mt-2 text-xs text-primary font-semibold">
                ⚡ {myDoers.length} {myDoers.length === 1 ? "tuo giocatore ha" : "tuoi giocatori hanno"} completato
                questa azione
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-2">
          <Zap className="h-8 w-8 text-primary" />
          Azioni Speciali
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Completa un'azione e guadagni punti. Ma se lo fanno in troppi… è malus per tutti 😈
        </p>
      </div>

      {actions.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nessuna azione speciale attiva.</Card>
      ) : (
        <div className="grid gap-4">{actions.map((a) => renderAction(a, false))}</div>
      )}
    </PageShell>
  );
}
