import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

type Cat = { id: string; name: string; label: string; sort_order: number; is_active: boolean; training_days: number[] };

const empty = { name: "", label: "", sort_order: 0, is_active: true, training_days: [] as number[] };

const WEEKDAYS: { v: number; label: string }[] = [
  { v: 1, label: "Lunedì" },
  { v: 2, label: "Martedì" },
  { v: 3, label: "Mercoledì" },
  { v: 4, label: "Giovedì" },
  { v: 5, label: "Venerdì" },
  { v: 6, label: "Sabato" },
  { v: 0, label: "Domenica" },
];

export function CategoriesAdmin() {
  const [rows, setRows] = useState<Cat[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Cat | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("player_categories").select("*").order("sort_order");
    setRows((data as Cat[]) || []);
    const { data: ps } = await supabase.from("players").select("category");
    const c: Record<string, number> = {};
    (ps || []).forEach((p: any) => { c[p.category] = (c[p.category] ?? 0) + 1; });
    setCounts(c);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (c: Cat) => { setEditing(c); setForm({ ...c }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.label.trim()) return toast.error("Nome e label richiesti");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      label: form.label.trim(),
      sort_order: Number(form.sort_order) || 0,
      is_active: !!form.is_active,
      training_days: (form.training_days || []).slice().sort((a: number, b: number) => a - b),
    };
    const { error } = editing
      ? await supabase.from("player_categories").update(payload).eq("id", editing.id)
      : await supabase.from("player_categories").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvato"); setOpen(false); load();
  };

  const remove = async (c: Cat) => {
    const n = counts[c.name] ?? 0;
    if (n > 0) return toast.error(`Ci sono ${n} giocatori in questa categoria. Rimuovili prima di eliminarla.`);
    if (!confirm(`Eliminare la categoria "${c.label}"?`)) return;
    const { error } = await supabase.from("player_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminata"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Gestisci le categorie giocatori. Le categorie disattivate restano nello storico ma non possono essere assegnate a nuovi giocatori.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Nuova categoria</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica categoria" : "Nuova categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome (chiave interna, es. U16)</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!!editing} /></div>
              <div><Label>Label (es. Under 16)</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
              <div><Label>Ordinamento</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
              <div>
                <Label>Giorni di allenamento</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {WEEKDAYS.map((d) => {
                    const checked = (form.training_days || []).includes(d.v);
                    return (
                      <label key={d.v} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const set = new Set<number>(form.training_days || []);
                            if (e.target.checked) set.add(d.v); else set.delete(d.v);
                            setForm({ ...form, training_days: Array.from(set) });
                          }}
                        />
                        {d.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Attiva</Label></div>
              <Button onClick={save} disabled={saving} className="w-full">{saving ? "Salvataggio…" : "Salva"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-2">
        {rows.map((c) => (
          <Card key={c.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">{c.label} <span className="text-xs text-muted-foreground">({c.name})</span></div>
              <div className="text-xs text-muted-foreground">
                Ordine: {c.sort_order} · {c.is_active ? "Attiva" : "Disattivata"} · {counts[c.name] ?? 0} giocatori
                {c.training_days?.length ? <> · Allenamenti: {c.training_days.map((d) => WEEKDAYS.find((w) => w.v === d)?.label.slice(0, 3)).join(", ")}</> : null}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}