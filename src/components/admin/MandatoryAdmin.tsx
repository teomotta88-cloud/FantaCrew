import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";

type Slot = {
  id: string;
  title: string;
  description: string | null;
  eligible_player_ids: string[];
  duration_type: "1_week" | "2_weeks" | "1_month";
  starts_at: string;
  ends_at: string;
  season: string;
  created_at: string;
  penalties_applied?: boolean;
};

type Player = { id: string; full_name: string; category: string; role: string };
type Team = { id: string; name: string };
type Penalty = { id: string; team_id: string; mandatory_slot_id: string | null; points: number };

const empty = {
  title: "",
  description: "",
  eligible_player_ids: [] as string[],
  duration_type: "1_week" as const,
  starts_at: new Date().toISOString().slice(0, 16),
};

export function MandatoryAdmin() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [drilldown, setDrilldown] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("mandatory_slots").select("*").order("starts_at", { ascending: false });
    setSlots((data as Slot[]) || []);
    const { data: pen } = await supabase.from("team_penalties").select("id,team_id,mandatory_slot_id,points");
    setPenalties((pen as Penalty[]) || []);
    const { data: t } = await supabase.from("teams").select("id,name");
    setTeams((t as Team[]) || []);
  };
  useEffect(() => {
    load();
    supabase.from("players").select("id,full_name,category,role").order("full_name").then(({ data }) => setPlayers((data as Player[]) || []));
  }, []);

  const startNew = () => { setForm(empty); setSearch(""); setOpen(true); };

  const togglePlayer = (id: string) => {
    setForm((f: any) => ({
      ...f,
      eligible_player_ids: f.eligible_player_ids.includes(id)
        ? f.eligible_player_ids.filter((x: string) => x !== id)
        : [...f.eligible_player_ids, id],
    }));
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Inserisci un titolo");
    if (form.eligible_player_ids.length === 0) return toast.error("Scegli almeno un giocatore");
    setSaving(true);
    const { error } = await supabase.from("mandatory_slots").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      eligible_player_ids: form.eligible_player_ids,
      duration_type: form.duration_type,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.starts_at).toISOString(), // overwritten by trigger
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Slot obbligatorio creato");
    setOpen(false);
    load();
  };

  const deactivate = async (id: string) => {
    const { error } = await supabase.from("mandatory_slots").update({ ends_at: new Date().toISOString() } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Slot disattivato"); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare slot?")) return;
    const { error } = await supabase.from("mandatory_slots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Slot eliminato"); load();
  };

  const filteredPlayers = players.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    p.role.toLowerCase().includes(search.toLowerCase())
  );

  const now = Date.now();
  const isActive = (s: Slot) => new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() > now;
  const isExpired = (s: Slot) => new Date(s.ends_at).getTime() <= now;

  const slotStats = (s: Slot) => {
    const penalized = penalties.filter((p) => p.mandatory_slot_id === s.id);
    const penalizedTeams = new Set(penalized.map((p) => p.team_id));
    const compliant = teams.filter((t) => !penalizedTeams.has(t.id)).length;
    const penalizedTeamsList = teams.filter((t) => penalizedTeams.has(t.id));
    return { penalized: penalized.length, compliant, penalizedTeams: penalizedTeamsList };
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Obbligatorietà ({slots.length})</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Nuovo slot</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo slot obbligatorio</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titolo</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Spotlight U16 — Maggio" /></div>
              <div><Label>Descrizione (opzionale)</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Durata</Label>
                  <Select value={form.duration_type} onValueChange={(v) => setForm({ ...form, duration_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1_week">1 settimana</SelectItem>
                      <SelectItem value="2_weeks">2 settimane</SelectItem>
                      <SelectItem value="1_month">1 mese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Inizio</Label>
                  <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Giocatori ammessi ({form.eligible_player_ids.length} selezionati)</Label>
                <Input placeholder="Cerca giocatore…" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1" />
                <div className="mt-2 max-h-64 overflow-y-auto border rounded-md divide-y">
                  {filteredPlayers.map((p) => {
                    const sel = form.eligible_player_ids.includes(p.id);
                    return (
                      <button key={p.id} type="button" onClick={() => togglePlayer(p.id)}
                        className={`flex items-center justify-between w-full p-2 text-left text-sm ${sel ? "bg-primary/10" : "hover:bg-muted"}`}>
                        <span>{p.full_name} <span className="text-xs text-muted-foreground">· {p.category} · {p.role}</span></span>
                        {sel && <Badge>✓</Badge>}
                      </button>
                    );
                  })}
                  {filteredPlayers.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nessun giocatore</div>}
                </div>
              </div>
              <Button onClick={save} className="w-full" disabled={saving}>{saving ? "Salvataggio…" : "Crea slot"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <ul className="divide-y">
          {slots.map((s) => {
            const active = isActive(s);
            return (
              <li key={s.id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium">{s.title}</div>
                    {active ? <Badge className="bg-emerald-500">Attivo</Badge> : <Badge variant="outline">Scaduto</Badge>}
                    <Badge variant="secondary">{s.duration_type.replace("_", " ")}</Badge>
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(s.starts_at).toLocaleString("it-IT")} → {new Date(s.ends_at).toLocaleString("it-IT")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{s.eligible_player_ids.length} giocatori ammessi</p>
                  {isExpired(s) && (() => {
                    const stats = slotStats(s);
                    return (
                      <div className="mt-2 text-xs">
                        <button className="underline text-destructive" onClick={() => setDrilldown(drilldown === s.id ? null : s.id)}>
                          {stats.penalized} squadre penalizzate / {stats.compliant} squadre conformi
                        </button>
                        {drilldown === s.id && (
                          <div className="mt-1 pl-2 border-l-2 border-destructive/30 space-y-0.5">
                            {stats.penalizedTeams.length === 0 && <div className="text-muted-foreground">Nessuna squadra penalizzata</div>}
                            {stats.penalizedTeams.map((t) => (
                              <div key={t.id}>• {t.name}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {active && <Button size="sm" variant="ghost" onClick={() => deactivate(s.id)} title="Disattiva"><X className="h-4 w-4" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)} title="Elimina"><Trash2 className="h-4 w-4" /></Button>
              </li>
            );
          })}
          {slots.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nessuno slot configurato</li>}
        </ul>
      </Card>
    </div>
  );
}