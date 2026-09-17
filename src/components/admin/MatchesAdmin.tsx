import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { weekOf } from "@/lib/week";
import { SEASON } from "@/lib/constants";
import { useCategories } from "@/hooks/useCategories";
import { useSeason } from "@/contexts/SeasonContext";
import { Trash2, Trophy, ShieldAlert, Minus } from "lucide-react";

function formatMatch(homeAway: "home" | "away", opponent: string): string {
  return homeAway === "home" ? `Lambro vs ${opponent}` : `${opponent} vs Lambro`;
}

type Match = {
  id: string;
  category: string;
  match_date: string;
  match_time?: string | null;
  week: number;
  opponent: string;
  status: string;
  home_away?: "home" | "away";
  coach_id: string | null;
};
type CallUp = { id: string; match_id: string; player_id: string; squad_role: string; jersey_number?: number | null };
type Coach = { id: string; full_name: string; category: string };

type SquadRole = "starter" | "bench" | "linesman" | "out";

export function MatchesAdmin() {
  const { categories } = useCategories({ activeOnly: true });
  const { seasonId, activeSeason } = useSeason();
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<{ id: string; full_name: string; category: string }[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [callUps, setCallUps] = useState<Record<string, CallUp[]>>({});
  const [form, setForm] = useState<{
    category: string;
    match_date: string;
    match_time: string;
    opponent: string;
    home_away: "home" | "away";
  }>({
    category: "",
    match_date: new Date().toISOString().slice(0, 10),
    match_time: "",
    opponent: "",
    home_away: "home",
  });
  useEffect(() => {
    if (!form.category && categories.length) setForm((f) => ({ ...f, category: categories[0].name }));
  }, [categories, form.category]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, SquadRole>>({});
  const [jerseys, setJerseys] = useState<Record<string, number>>({});

  const load = async () => {
    const [{ data: m }, { data: p }, { data: c }, { data: co }] = await Promise.all([
      supabase.from("matches").select("*").order("match_date", { ascending: false }),
      supabase.from("players").select("id,full_name,category").order("full_name"),
      supabase.from("match_call_ups").select("*"),
      supabase.from("coaches").select("id,full_name,category").order("full_name"),
    ]);
    setMatches(((m as any[]) || []) as Match[]);
    setPlayers(p || []);
    setCoaches((co as Coach[]) || []);
    const byMatch: Record<string, CallUp[]> = {};
    (c || []).forEach((r: any) => {
      (byMatch[r.match_id] ||= []).push(r);
    });
    setCallUps(byMatch);
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.category) return toast.error("Seleziona una categoria");
    if (!form.opponent.trim()) return toast.error("Inserisci l'avversario");
    const week = weekOf(form.match_date, activeSeason?.starts_at);
    const { error } = await supabase.from("matches").insert({
      category: form.category,
      match_date: form.match_date,
      match_time: form.match_time || null,
      opponent: form.opponent.trim(),
      week,
      season: SEASON,
      season_id: seasonId ?? null,
      home_away: form.home_away as string,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Partita creata");
    setForm({ ...form, opponent: "", match_time: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare la partita e annullare tutti i punti collegati?")) return;
    await supabase.from("weekly_events").delete().eq("match_id", id);
    await supabase.from("matches").delete().eq("id", id);
    toast.success("Partita eliminata");
    load();
  };

  const openCallUps = (m: Match) => {
    setOpenId(openId === m.id ? null : m.id);
    const map: Record<string, SquadRole> = {};
    const jerseyMap: Record<string, number> = {};
    (callUps[m.id] || []).forEach((c) => {
      map[c.player_id] = c.squad_role as SquadRole;
      if (c.jersey_number) jerseyMap[c.player_id] = c.jersey_number;
    });
    setPicks(map);
    setJerseys(jerseyMap);
  };

  const saveCallUps = async (m: Match) => {
    await supabase.from("match_call_ups").delete().eq("match_id", m.id);
    const rows = Object.entries(picks)
      .filter(([_k, v]) => v === "starter" || v === "bench" || v === "linesman")
      .map(([player_id, squad_role]) => ({
        match_id: m.id,
        player_id,
        squad_role,
        jersey_number: jerseys[player_id] ?? null,
      }));
    if (rows.length) {
      const { error } = await supabase.from("match_call_ups").insert(rows as any);
      if (error) return toast.error(error.message);
    }
    // Also generate call-up weekly events (clean+regenerate)
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", m.id)
      .in("rule_key", ["match_call_up", "linesman_call"]);
    if (rows.length) {
      const evRows = rows.map((r) => ({
        player_id: r.player_id,
        rule_key: r.squad_role === "linesman" ? "linesman_call" : "match_call_up",
        week: m.week,
        quantity: 1,
        match_id: m.id,
        season: SEASON,
        season_id: seasonId ?? null,
        notes: `match:${m.id}`,
        jersey_number: r.jersey_number,
      }));
      await supabase.from("weekly_events").insert(evRows as any);
    }
    toast.success(`${rows.length} convocati salvati`);
    load();
  };

  const setMatchCoach = async (m: Match, coachId: string | null) => {
    await supabase.from("matches").update({ coach_id: coachId }).eq("id", m.id);
    // If the match already has a result, regenerate coach events for the new coach
    if (m.status === "won" || m.status === "lost") {
      await supabase
        .from("coach_events")
        .delete()
        .eq("match_id", m.id)
        .in("rule_key", ["coach_match_win", "coach_match_loss"]);
      if (coachId) {
        const key = m.status === "won" ? "coach_match_win" : "coach_match_loss";
        await supabase.from("coach_events").insert({
          coach_id: coachId,
          rule_key: key,
          week: m.week,
          quantity: 1,
          match_id: m.id,
          season: SEASON,
          notes: `match:${m.id}`,
        });
      }
    }
    toast.success(coachId ? "Allenatore assegnato" : "Allenatore rimosso");
    load();
  };

  const setStatus = async (m: Match, status: "won" | "lost" | "draw" | "scheduled") => {
    // Remove all auto-generated win/loss/starting/bench events for this match
    await supabase
      .from("weekly_events")
      .delete()
      .eq("match_id", m.id)
      .in("rule_key", ["match_win", "match_loss", "match_draw", "starting_xv", "on_the_bench"]);
    await supabase
      .from("coach_events")
      .delete()
      .eq("match_id", m.id)
      .in("rule_key", ["coach_match_win", "coach_match_loss"]);
    if (status !== "scheduled") {
      const calls = callUps[m.id] || [];
      const resultKey = status === "won" ? "match_win" : status === "draw" ? "match_draw" : "match_loss";
      const rows: any[] = [];
      for (const c of calls) {
        if (c.squad_role === "linesman") continue;
        rows.push({
          player_id: c.player_id,
          rule_key: resultKey,
          week: m.week,
          quantity: 1,
          match_id: m.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${m.id}`,
        });
        rows.push({
          player_id: c.player_id,
          rule_key: c.squad_role === "starter" ? "starting_xv" : "on_the_bench",
          week: m.week,
          quantity: 1,
          match_id: m.id,
          season: SEASON,
          season_id: seasonId ?? null,
          notes: `match:${m.id}`,
        });
      }
      if (rows.length) {
        const { error } = await supabase.from("weekly_events").insert(rows);
        if (error) return toast.error(error.message);
      }
      if (m.coach_id && status !== "draw") {
        const coachKey = status === "won" ? "coach_match_win" : "coach_match_loss";
        await supabase.from("coach_events").insert({
          coach_id: m.coach_id,
          rule_key: coachKey,
          week: m.week,
          quantity: 1,
          match_id: m.id,
          season: SEASON,
          notes: `match:${m.id}`,
        });
      }
    }
    await supabase.from("matches").update({ status }).eq("id", m.id);
    toast.success(
      status === "won"
        ? "Vittoria registrata"
        : status === "draw"
          ? "Pareggio registrato"
          : status === "lost"
            ? "Sconfitta registrata"
            : "Risultato azzerato",
    );
    load();
  };

  const playersByCat = useMemo(() => {
    const map: Record<string, typeof players> = {};
    players.forEach((p) => {
      (map[p.category] ||= []).push(p);
    });
    return map;
  }, [players]);

  const coachesByCat = useMemo(() => {
    const map: Record<string, Coach[]> = {};
    coaches.forEach((c) => {
      (map[c.category] ||= []).push(c);
    });
    return map;
  }, [coaches]);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="font-bold mb-3">Crea partita</h3>
        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
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
          <Button onClick={create}>Crea partita</Button>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b font-semibold">Partite</div>
        <ul className="divide-y">
          {matches.map((m) => {
            const calls = callUps[m.id] || [];
            const isOpen = openId === m.id;
            const catPlayers = playersByCat[m.category] || [];
            return (
              <li key={m.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold">
                      {m.category} · {formatMatch(m.home_away ?? "home", m.opponent)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.match_date + "T00:00:00").toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}
                      {m.match_time && ` · ${m.match_time.slice(0, 5)}`}
                      {` · ${calls.length} convocati`}
                    </div>
                  </div>
                  <Select value={m.coach_id ?? "none"} onValueChange={(v) => setMatchCoach(m, v === "none" ? null : v)}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue placeholder="Allenatore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun allenatore</SelectItem>
                      {(coachesByCat[m.category] || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Button size="sm" variant="outline" onClick={() => openCallUps(m)}>
                    {isOpen ? "Chiudi" : "Convocati"}
                  </Button>
                  <Button
                    size="sm"
                    variant={m.status === "won" ? "default" : "outline"}
                    onClick={() => setStatus(m, "won")}
                    disabled={!calls.length}
                  >
                    <Trophy className="h-4 w-4 mr-1" /> Vinta
                  </Button>
                  <Button
                    size="sm"
                    variant={m.status === "draw" ? "secondary" : "outline"}
                    onClick={() => setStatus(m, "draw")}
                    disabled={!calls.length}
                  >
                    <Minus className="h-4 w-4 mr-1" /> Pareggio
                  </Button>
                  <Button
                    size="sm"
                    variant={m.status === "lost" ? "destructive" : "outline"}
                    onClick={() => setStatus(m, "lost")}
                    disabled={!calls.length}
                  >
                    <ShieldAlert className="h-4 w-4 mr-1" /> Persa
                  </Button>
                  {m.status !== "scheduled" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(m, "scheduled")}>
                      Azzera
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {isOpen && (
                  <div className="mt-4 border-t pt-4 space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Seleziona i convocati e indica titolari / panchina. Salvando si registrano le convocazioni;
                      titolare/panchina e vittoria/sconfitta vengono assegnati al cambio di stato della partita.
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 max-h-[400px] overflow-auto pr-2">
                      {catPlayers.map((p) => {
                        const v = picks[p.id] || "out";
                        const isConvocato = v !== "out";
                        return (
                          <div key={p.id} className="flex items-center gap-2 border rounded-md p-2">
                            <Checkbox
                              checked={isConvocato}
                              onCheckedChange={(c) => setPicks({ ...picks, [p.id]: c ? "starter" : "out" })}
                            />
                            <span className="flex-1 text-sm font-medium truncate">{p.full_name}</span>
                            {isConvocato && (
                              <>
                                <Input
                                  type="number"
                                  min={1}
                                  max={25}
                                  placeholder="#"
                                  value={jerseys[p.id] ?? ""}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setJerseys((prev) => {
                                      const next = { ...prev };
                                      if (e.target.value === "" || isNaN(val)) {
                                        delete next[p.id];
                                        return next;
                                      }
                                      next[p.id] = Math.min(25, Math.max(1, val));
                                      return next;
                                    });
                                  }}
                                  className="h-7 w-14 text-center"
                                />
                                <Select
                                  value={v}
                                  onValueChange={(nv) => setPicks({ ...picks, [p.id]: nv as SquadRole })}
                                >
                                  <SelectTrigger className="h-7 w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="starter">Titolare</SelectItem>
                                    <SelectItem value="bench">Panchina</SelectItem>
                                    <SelectItem value="linesman">Guardalinee</SelectItem>
                                  </SelectContent>
                                </Select>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const all: Record<string, "starter"> = {};
                          catPlayers.forEach((p) => {
                            all[p.id] = "starter";
                          });
                          setPicks(all);
                        }}
                      >
                        Convoca tutti
                      </Button>
                      <Button onClick={() => saveCallUps(m)}>Salva convocati</Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {matches.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nessuna partita</li>}
        </ul>
      </Card>
    </div>
  );
}
