import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { ZaghettoIcon } from "@/components/ZaghettoIcon";
import { categoryLabel } from "@/lib/constants";
import { useSeason } from "@/contexts/SeasonContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Download, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
export const Route = createFileRoute("/$crewSlug/player/$id")({
  component: PlayerProfilePage,
  head: () => ({ meta: [{ title: "Report giocatore — Fanta Lambro" }] }),
});

type Player = {
  id: string;
  full_name: string;
  photo_url: string | null;
  category: string;
  role: string;
  value_zaghetti: number;
};
type EventRow = {
  id: string;
  player_id: string;
  event_label: string;
  event_key: string;
  is_malus: boolean;
  score_type?: "bonus" | "malus" | "club" | null;
  points: number;
  week: number;
  season_id: string | null;
  event_date: string;
  source: string;
};
type TeamRef = { team_id: string; team_name: string; manager_name: string | null };

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PlayerProfilePage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { seasonId, activeSeason } = useSeason();
  const { isAdmin } = useAuth();

  const [player, setPlayer] = useState<Player | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [delta, setDelta] = useState<number | null>(null);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterWeek, setFilterWeek] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [{ data: p }, { data: zh }] = await Promise.all([
        supabase
          .from("players")
          .select("id,full_name,photo_url,category,role,value_zaghetti")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("zaghetti_history")
          .select("delta,created_at")
          .eq("player_id", id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;
      setPlayer((p as Player) ?? null);
      setDelta(zh?.[0]?.delta ?? null);

      if (seasonId) {
        const { data: ev } = await supabase
          .from("player_event_log")
          .select("*")
          .eq("player_id", id)
          .eq("season_id", seasonId)
          .order("event_date", { ascending: false });
        if (!cancelled) setEvents((ev as EventRow[]) || []);

        const { data: tp } = await supabase
          .from("team_players")
          .select("team_id, teams!inner(id,name,manager_id,season_id)")
          .eq("player_id", id);
        const filtered = (tp || []).filter((r: any) => r.teams?.season_id === seasonId);
        const managerIds = filtered.map((r: any) => r.teams.manager_id).filter(Boolean);
        let profMap: Record<string, string> = {};
        if (managerIds.length) {
          const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", managerIds);
          (profs || []).forEach((p: any) => {
            profMap[p.id] = p.display_name;
          });
        }
        if (!cancelled) {
          setTeams(
            filtered.map((r: any) => ({
              team_id: r.teams.id,
              team_name: r.teams.name,
              manager_name: profMap[r.teams.manager_id] ?? null,
            })),
          );
        }
      } else {
        setEvents([]);
        setTeams([]);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  const totalPoints = useMemo(() => events.reduce((s, e) => s + (e.points || 0), 0), [events]);
  const bonusPoints = useMemo(() => events.filter((e) => e.points > 0).reduce((s, e) => s + e.points, 0), [events]);
  const malusPoints = useMemo(
    () => Math.abs(events.filter((e) => e.points < 0).reduce((s, e) => s + e.points, 0)),
    [events],
  );

  const countKey = (k: string) => events.filter((e) => e.event_key === k).length;
  const stats = [
    { label: "Allenamenti presenti", value: countKey("training_attendance") },
    { label: "Allenamenti assenti", value: countKey("training_absence") },
    { label: "Partite convocato", value: countKey("match_call_up") },
    { label: "Titolare", value: countKey("starting_xv") },
    { label: "In panchina", value: countKey("on_the_bench") },
    { label: "Mete segnate", value: countKey("try_scored") },
    { label: "Calci piazzati", value: countKey("penalty_kick") },
    { label: "Drop", value: countKey("drop_goal") },
    { label: "Man of the Match 🏆", value: countKey("motm") },
    { label: "Merd of the Match 💩", value: countKey("merdtm") },
    {
      label: "Azioni speciali completate",
      value: events.filter((e) => e.source === "special_action" && !e.is_malus).length,
    },
    {
      label: "Azioni speciali penalizzate",
      value: events.filter((e) => e.source === "special_action" && e.is_malus).length,
    },
  ];

  const weeklyData = useMemo(() => {
    const m = new Map<number, { week: number; bonus: number; malus: number }>();
    events.forEach((e) => {
      const cur = m.get(e.week) || { week: e.week, bonus: 0, malus: 0 };
      if (e.points >= 0) cur.bonus += e.points;
      else cur.malus += Math.abs(e.points);
      m.set(e.week, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.week - b.week);
  }, [events]);

  const weeks = useMemo(() => Array.from(new Set(events.map((e) => e.week))).sort((a, b) => b - a), [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterWeek !== "all" && String(e.week) !== filterWeek) return false;
      if (filterType === "bonus" && e.points <= 0) return false;
      if (filterType === "malus" && e.points >= 0) return false;
      if (filterType === "training" && !["training_attendance", "training_absence"].includes(e.event_key)) return false;
      if (
        filterType === "match" &&
        ![
          "match_call_up",
          "starting_xv",
          "on_the_bench",
          "try_scored",
          "penalty_kick",
          "drop_goal",
          "motm",
          "merdtm",
          "match_win",
          "match_loss",
          "yellow_card",
          "red_card",
        ].includes(e.event_key)
      )
        return false;
      if (filterType === "special" && e.source !== "special_action") return false;
      return true;
    });
  }, [events, filterType, filterWeek]);

  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setPage(1);
  }, [filterType, filterWeek]);

  const exportCsv = () => {
    const header = ["Periodo", "Data", "Evento", "Tipo", "Punti"];
    const rows = filtered.map((e) =>
      [
        weekToDateRange(e.week, activeSeason?.starts_at),
        new Date(e.event_date).toLocaleDateString("it-IT"),
        `"${e.event_label.replace(/"/g, '""')}"`,
        e.points >= 0 ? "Bonus" : "Malus",
        e.points,
      ].join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${player?.full_name?.replace(/\s+/g, "_") || "player"}_eventi.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading)
    return (
      <PageShell>
        <div className="text-muted-foreground">Caricamento…</div>
      </PageShell>
    );
  if (!isAdmin)
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-bold">Accesso riservato</h2>
          <p className="text-muted-foreground text-sm">Questa pagina è visibile solo agli amministratori.</p>
          <Button variant="outline" onClick={() => router.history.back()}>
            Torna indietro
          </Button>
        </div>
      </PageShell>
    );
  if (!player)
    return (
      <PageShell>
        <div className="text-muted-foreground">Giocatore non trovato.</div>
      </PageShell>
    );

  const bonusPct =
    totalPoints > 0 || bonusPoints + malusPoints > 0 ? (bonusPoints / Math.max(1, bonusPoints + malusPoints)) * 100 : 0;

  return (
    <PageShell>
      <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
      </Button>

      {/* Header */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="h-32 w-32 md:h-40 md:w-40 rounded-xl bg-gradient-to-br from-secondary to-accent overflow-hidden flex items-center justify-center text-4xl font-bold text-muted-foreground shrink-0">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.full_name} className="h-full w-full object-cover" />
            ) : (
              <span>{initials(player.full_name)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold">{player.full_name}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge>{categoryLabel(player.category)}</Badge>
              <Badge variant="secondary">{player.role}</Badge>
              <Badge variant="outline" className="inline-flex items-center gap-1">
                <ZaghettoIcon /> {player.value_zaghetti}
                {delta != null && delta !== 0 && (
                  <span className={delta > 0 ? "text-emerald-600" : "text-destructive"}>
                    {delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
                  </span>
                )}
              </Badge>
            </div>
            <div className="mt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Totale stagione</div>
              <div className="text-4xl md:text-5xl font-bold text-primary">{totalPoints}</div>
            </div>
            {bonusPoints + malusPoints > 0 && (
              <div className="mt-3">
                <div className="h-3 w-full rounded-full overflow-hidden bg-muted flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${bonusPct}%` }} />
                  <div className="h-full bg-destructive" style={{ width: `${100 - bonusPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span className="text-emerald-600">+{bonusPoints} bonus</span>
                  <span className="text-destructive">-{malusPoints} malus</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {events.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nessun evento registrato per questa stagione.</Card>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {stats.map((s) => (
              <Card key={s.label} className="p-3">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-bold">{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Weekly chart */}
          <Card className="p-4 mb-6">
            <h2 className="font-semibold mb-3">Punti per periodo</h2>
            <div className="w-full h-64 overflow-x-auto">
              <div style={{ minWidth: Math.max(weeklyData.length * 50, 320), height: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <XAxis
                      dataKey="week"
                      tickFormatter={(w) => {
                        const d = new Date(
                          (activeSeason?.starts_at
                            ? new Date(activeSeason.starts_at)
                            : new Date("2025-09-01")
                          ).getTime() +
                            (Number(w) - 1) * 7 * 86400000,
                        );
                        return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
                      }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="bonus" stackId="a" fill="hsl(142 76% 36%)" name="Bonus" />
                    <Bar dataKey="malus" stackId="a" fill="hsl(0 84% 60%)" name="Malus" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          {/* Filters + Export */}
          <div className="flex flex-col md:flex-row gap-3 mb-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="bonus">Solo bonus</SelectItem>
                <SelectItem value="malus">Solo malus</SelectItem>
                <SelectItem value="training">Allenamenti</SelectItem>
                <SelectItem value="match">Partite</SelectItem>
                <SelectItem value="special">Azioni speciali</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterWeek} onValueChange={setFilterWeek}>
              <SelectTrigger className="md:w-40">
                <SelectValue placeholder="Settimana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le settimane</SelectItem>
                {weeks.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    Settimana {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button variant="outline" onClick={exportCsv} className="md:ml-auto">
                <Download className="h-4 w-4 mr-1" /> Esporta CSV
              </Button>
            )}
          </div>

          {/* Event log */}
          <Card className="mb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Settimana</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Punti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>S{e.week}</TableCell>
                    <TableCell>{new Date(e.event_date).toLocaleDateString("it-IT")}</TableCell>
                    <TableCell>{e.event_label}</TableCell>
                    <TableCell>
                      {e.score_type === "club" ? (
                        <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/20">Club</Badge>
                      ) : e.points >= 0 ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">Bonus</Badge>
                      ) : (
                        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">Malus</Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${e.points >= 0 ? "text-emerald-600" : "text-destructive"}`}
                    >
                      {e.points > 0 ? `+${e.points}` : e.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pages > 1 && (
              <div className="flex items-center justify-between p-3 border-t">
                <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Precedente
                </Button>
                <span className="text-sm text-muted-foreground">
                  Pagina {page} di {pages}
                </span>
                <Button variant="ghost" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>
                  Successiva
                </Button>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Teams owning this player */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3 inline-flex items-center gap-2">
          <Trophy className="h-4 w-4" /> Squadre attuali
        </h2>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna squadra ha attualmente questo giocatore.</p>
        ) : (
          <ul className="divide-y">
            {teams.map((t) => (
              <li key={t.team_id} className="py-2 flex items-center justify-between">
                <span className="font-medium">{t.team_name}</span>
                <span className="text-sm text-muted-foreground">{t.manager_name ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
