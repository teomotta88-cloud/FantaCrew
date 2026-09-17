import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

type ScoreType = "bonus" | "malus" | "club";
type Rule = {
  key: string; label: string; points: number; is_malus: boolean;
  sort_order: number; applies_to: string; is_active: boolean;
  score_type: ScoreType;
};
type Multiplier = { key: string; label: string; value: number };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function RulesAdmin() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [multipliers, setMultipliers] = useState<Multiplier[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Rule>({
    key: "", label: "", points: 0, is_malus: false, sort_order: 100, applies_to: "player", is_active: true, score_type: "bonus",
  });

  const load = async () => {
    const { data } = await supabase.from("scoring_rules").select("*").order("sort_order");
    setRules((data as Rule[]) || []);
    const { data: m } = await supabase
      .from("team_config")
      .select("key,label,value")
      .in("key", ["multiplier_captain", "multiplier_talisman", "multiplier_silverback"])
      .order("sort_order");
    setMultipliers((m as Multiplier[]) || []);
  };
  useEffect(() => { load(); }, []);

  const update = async (key: string, patch: Partial<Rule>) => {
    const { error } = await supabase.from("scoring_rules").update(patch).eq("key", key);
    if (error) return toast.error(error.message);
    toast.success("Aggiornato"); load();
  };

  const updatePoints = async (r: Rule, points: number) => {
    if (points < 0 && r.score_type !== "malus") {
      if (confirm("Punti negativi: vuoi marcare la regola come malus?")) {
        await update(r.key, { points, is_malus: true, score_type: "malus" } as Partial<Rule>); return;
      }
    }
    await update(r.key, { points });
  };

  const updateScoreType = async (r: Rule, score_type: ScoreType) => {
    await update(r.key, { score_type, is_malus: score_type === "malus" } as Partial<Rule>);
  };

  const updateMultiplier = async (key: string, value: number) => {
    const { error } = await supabase.from("team_config").update({ value }).eq("key", key);
    if (error) return toast.error(error.message);
    toast.success("Aggiornato");
  };

  const move = async (r: Rule, dir: -1 | 1) => {
    const sorted = [...rules].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.key === r.key);
    const swap = sorted[idx + dir]; if (!swap) return;
    await supabase.from("scoring_rules").update({ sort_order: swap.sort_order }).eq("key", r.key);
    await supabase.from("scoring_rules").update({ sort_order: r.sort_order }).eq("key", swap.key);
    load();
  };

  const remove = async (r: Rule) => {
    const { count } = await supabase.from("weekly_events").select("id", { count: "exact", head: true }).eq("rule_key", r.key);
    if ((count || 0) > 0) {
      toast.error(`Questa regola è usata in ${count} eventi. Disattivala invece di eliminarla.`); return;
    }
    if (!confirm(`Eliminare definitivamente "${r.label}"?`)) return;
    const { error } = await supabase.from("scoring_rules").delete().eq("key", r.key);
    if (error) return toast.error(error.message);
    toast.success("Regola eliminata"); load();
  };

  const create = async () => {
    if (!form.label.trim()) return toast.error("Label richiesta");
    const key = (form.key || slugify(form.label)).trim();
    if (!key) return toast.error("Key non valida");
    const score_type: ScoreType = form.points < 0 ? "malus" : form.score_type;
    const payload = { ...form, key, score_type, is_malus: score_type === "malus" };
    const { error } = await supabase.from("scoring_rules").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Regola creata");
    setCreating(false);
    setForm({ key: "", label: "", points: 0, is_malus: false, sort_order: 100, applies_to: "player", is_active: true, score_type: "bonus" });
    load();
  };

  const active = rules.filter((r) => r.is_active);
  const inactive = rules.filter((r) => !r.is_active);

  const renderRow = (r: Rule, idx: number, total: number) => (
    <li key={r.key} className="flex flex-col md:flex-row md:items-center gap-2 p-3">
      <div className="flex-1">
        <Input defaultValue={r.label} className="font-medium" onBlur={(e) => e.target.value !== r.label && update(r.key, { label: e.target.value })} />
        <div className="text-xs text-muted-foreground mt-1 flex gap-2 items-center">
          <code>{r.key}</code>
          <Select value={r.score_type ?? (r.is_malus ? "malus" : "bonus")} onValueChange={(v) => updateScoreType(r, v as ScoreType)}>
            <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bonus">Bonus</SelectItem>
              <SelectItem value="malus">Malus</SelectItem>
              <SelectItem value="club">Club</SelectItem>
            </SelectContent>
          </Select>
          <Select value={r.applies_to} onValueChange={(v) => update(r.key, { applies_to: v })}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="player">Giocatore</SelectItem>
              <SelectItem value="coach">Allenatore</SelectItem>
              <SelectItem value="both">Entrambi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Input type="number" defaultValue={r.points} className="w-24" onBlur={(e) => Number(e.target.value) !== r.points && updatePoints(r, Number(e.target.value))} />
      {r.is_active && (
        <div className="flex">
          <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(r, -1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" disabled={idx === total - 1} onClick={() => move(r, 1)}><ArrowDown className="h-4 w-4" /></Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Switch checked={r.is_active} onCheckedChange={(v) => update(r.key, { is_active: v })} />
        <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Tabella punteggi</h2>
        <p className="text-sm text-muted-foreground">Crea, modifica o disattiva le regole di punteggio.</p>
      </div>

      <Card>
        <div className="p-3 border-b">
          <div className="font-semibold">Moltiplicatori ruoli speciali</div>
          <div className="text-xs text-muted-foreground">I punti del giocatore vengono moltiplicati per questo valore.</div>
        </div>
        <ul className="divide-y">
          {multipliers.map((m) => (
            <li key={m.key} className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="font-medium">{m.label}</div>
                <div className="text-xs text-muted-foreground">{m.key}</div>
              </div>
              <Input type="number" min={1} defaultValue={m.value} className="w-24" onBlur={(e) => updateMultiplier(m.key, Number(e.target.value))} />
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-semibold">Regole attive ({active.length})</div>
          <Button size="sm" onClick={() => setCreating((c) => !c)}><Plus className="h-4 w-4 mr-1" /> Nuova regola</Button>
        </div>
        {creating && (
          <div className="p-4 border-b bg-muted/30 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value, key: form.key || slugify(e.target.value) })} /></div>
              <div><Label>Key</Label><Input value={form.key} onChange={(e) => setForm({ ...form, key: slugify(e.target.value) })} /></div>
              <div><Label>Punti</Label><Input type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value), is_malus: Number(e.target.value) < 0 })} /></div>
              <div><Label>Applica a</Label>
                <Select value={form.applies_to} onValueChange={(v) => setForm({ ...form, applies_to: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Giocatore</SelectItem>
                    <SelectItem value="coach">Allenatore</SelectItem>
                    <SelectItem value="both">Entrambi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.score_type} onValueChange={(v) => setForm({ ...form, score_type: v as ScoreType, is_malus: v === "malus" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">Bonus</SelectItem>
                    <SelectItem value="malus">Malus</SelectItem>
                    <SelectItem value="club">Club</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={create}>Crea</Button>
              <Button variant="outline" onClick={() => setCreating(false)}>Annulla</Button>
            </div>
          </div>
        )}
        <ul className="divide-y">{active.map((r, i) => renderRow(r, i, active.length))}</ul>
      </Card>

      {inactive.length > 0 && (
        <Card>
          <div className="p-3 border-b font-semibold text-muted-foreground">Regole disattivate ({inactive.length})</div>
          <ul className="divide-y opacity-70">{inactive.map((r, i) => renderRow(r, i, inactive.length))}</ul>
        </Card>
      )}
    </div>
  );
}
