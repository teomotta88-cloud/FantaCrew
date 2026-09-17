import { useEffect, useState } from "react";
import { useSeason } from "@/contexts/SeasonContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { SEASON } from "@/lib/constants";
import { currentWeek } from "@/lib/week";

// Converts week number to date range string
function weekToDateRange(week: number | null | undefined, seasonStart?: string): string {
  if (!week || week <= 0) return "Senza data";
  const start = seasonStart ? new Date(seasonStart) : new Date("2025-09-01T00:00:00Z");
  const weekStart = new Date(start.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmtShort = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const fmtFull = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  return `${fmtShort(weekStart)} – ${fmtFull(weekEnd)}`;
}

export function ActionsAdmin() {
  const { activeSeason, seasonId } = useSeason();
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
      seasonId
        ? supabase.from("special_actions").select("*").eq("season_id", seasonId).order("week", { ascending: false })
        : supabase.from("special_actions").select("*").eq("season", SEASON).order("week", { ascending: false }),
      supabase.from("special_action_completions").select("*,players(full_name),coaches(full_name)"),
    ]);
    setPlayers(p || []);
    setCoaches(co || []);
    setActions(a || []);
    setCompletions(c || []);
  };
  useEffect(() => {
    load();
  }, [seasonId]);

  const create = async () => {
    if (!form.title) return toast.error("Titolo obbligatorio");
    const { error } = await supabase.from("special_actions").insert({
      ...form,
      week: currentWeek(activeSeason?.starts_at),
      season_id: seasonId,
      season: activeSeason?.name ?? SEASON,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Azione creata");
    setForm({ ...form, title: "", description: "" });
    load();
  };
  const removeAction = async (id: string) => {
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
                    {expired && (
                      <Badge variant="destructive">Scaduta</Badge>
                    )}
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
                {a.expires_at && (
                  <span className="text-xs text-muted-foreground">Attuale: {a.expires_at}</span>
                )}
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
