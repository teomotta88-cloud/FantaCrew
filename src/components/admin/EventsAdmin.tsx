import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { weekOf } from "@/lib/week";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeason } from "@/contexts/SeasonContext";

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDateShort = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export function EventsAdmin() {
  const { user } = useAuth();
  const { activeSeason, seasonId } = useSeason();
  const [players, setPlayers] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [profMap, setProfMap] = useState<Map<string, string>>(new Map());
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [form, setForm] = useState({
    target: "player" as "player" | "coach",
    subject_id: "",
    rule_key: "",
    date: todayStr(),
    quantity: 1,
  });

  const load = async () => {
    const [{ data: p }, { data: r }, { data: e }, { data: c }] = await Promise.all([
      supabase.from("players").select("id,full_name").order("full_name"),
      supabase.from("scoring_rules").select("*").eq("is_active", true).order("sort_order"),
      supabase
        .from("weekly_events")
        .select("*,players(full_name),scoring_rules(label,points)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("coaches").select("id,full_name").order("full_name"),
    ]);
    setPlayers(p || []);
    setRules(r || []);
    setEvents(e || []);
    setCoaches(c || []);
    const userIds = [...new Set((e || []).map((x: any) => x.inserted_by).filter(Boolean))] as string[];
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", userIds);
      setProfMap(new Map((profs || []).map((pr: any) => [pr.id, pr.display_name])));
    } else {
      setProfMap(new Map());
    }
  };
  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!form.subject_id || !form.rule_key || !form.date) return toast.error("Compila tutti i campi");
    const week = weekOf(form.date, activeSeason?.starts_at);
    const payload = { rule_key: form.rule_key, week, quantity: form.quantity };
    const audit = { inserted_by: user?.id ?? null, inserted_at: new Date(form.date).toISOString() };
    const { error } =
      form.target === "coach"
        ? await supabase.from("coach_events").insert({ ...payload, coach_id: form.subject_id })
        : await supabase
            .from("weekly_events")
            .insert({ ...payload, ...audit, player_id: form.subject_id, season_id: seasonId ?? null });
    if (error) return toast.error(error.message);
    toast.success("Evento registrato");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("weekly_events").delete().eq("id", id);
    load();
  };

  const datesAvailable = Array.from(
    new Set(
      events
        .map((e: any) => (e.inserted_at ? new Date(e.inserted_at).toISOString().slice(0, 10) : null))
        .filter((d): d is string => !!d),
    ),
  ).sort((a, b) => (a < b ? 1 : -1));
  const visibleEvents =
    dateFilter === "all"
      ? events
      : events.filter((e: any) => e.inserted_at && new Date(e.inserted_at).toISOString().slice(0, 10) === dateFilter);

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6">
      <Card className="p-5 h-fit">
        <h3 className="font-bold mb-3">Registra evento</h3>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select
              value={form.target}
              onValueChange={(v) => setForm({ ...form, target: v as "player" | "coach", subject_id: "" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Giocatore</SelectItem>
                <SelectItem value="coach">Allenatore</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{form.target === "coach" ? "Allenatore" : "Giocatore"}</Label>
            <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona…" />
              </SelectTrigger>
              <SelectContent>
                {(form.target === "coach" ? coaches : players).map((p) => (
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
                {rules
                  .filter((r) => r.applies_to === "both" || r.applies_to === form.target)
                  .map((r) => (
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
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
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
            Registra
          </Button>
        </div>
      </Card>
      <Card>
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div className="font-semibold">Ultimi eventi</div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Filtra per data</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le date</SelectItem>
                {datesAvailable.map((d) => (
                  <SelectItem key={d} value={d}>
                    {fmtDateShort(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ul className="divide-y max-h-[600px] overflow-auto">
          {visibleEvents.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.players?.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDateShort(e.inserted_at)} · {e.scoring_rules?.label} ×{e.quantity}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Inserito da <span className="font-medium">{profMap.get(e.inserted_by) ?? "—"}</span> ·{" "}
                  {fmtDate(e.inserted_at)}
                </div>
              </div>
              <div className={`font-bold ${e.scoring_rules?.points >= 0 ? "text-primary" : "text-destructive"}`}>
                {e.quantity * (e.scoring_rules?.points || 0) > 0 ? "+" : ""}
                {e.quantity * (e.scoring_rules?.points || 0)}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(e.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {visibleEvents.length === 0 && (
            <li className="p-6 text-center text-muted-foreground text-sm">Nessun evento registrato</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
