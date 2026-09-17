import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Row = { key: string; value: number; label: string; group_name: string; sort_order: number };

const GROUP_LABELS: Record<string, string> = {
  general: "Generali",
  category: "Minimi per categoria",
  role: "Quote per ruolo",
};

export function TeamConfigAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data }, { data: cats }] = await Promise.all([
      supabase.from("team_config").select("*").order("sort_order"),
      supabase.from("player_categories").select("name,label,sort_order,is_active").eq("is_active", true).order("sort_order"),
    ]);
    const existing = (data as Row[]) || [];
    const byKey = new Map(existing.map((r) => [r.key, r]));
    const baseSort = Math.max(0, ...existing.filter((r) => r.group_name === "category").map((r) => r.sort_order));
    (cats || []).forEach((c: any, idx: number) => {
      const key = `min_${c.name}`;
      if (!byKey.has(key)) {
        existing.push({
          key,
          value: 0,
          label: `Minimi ${c.label || c.name}`,
          group_name: "category",
          sort_order: baseSort + idx + 1,
        });
      }
    });
    existing.sort((a, b) => a.sort_order - b.sort_order);
    setRows(existing);
  };
  useEffect(() => { load(); }, []);

  const update = (key: string, value: number) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, value } : r)));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("team_config")
      .upsert(rows.map((r) => ({ key: r.key, value: r.value, label: r.label, group_name: r.group_name, sort_order: r.sort_order })), { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Quote aggiornate");
    load();
  };

  const groups = Array.from(new Set(rows.map((r) => r.group_name)));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Modifica le quote per la creazione delle squadre. Le modifiche valgono per tutti gli utenti.</p>
      {groups.map((g) => (
        <Card key={g} className="p-5 space-y-3">
          <h3 className="font-semibold">{GROUP_LABELS[g] ?? g}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {rows.filter((r) => r.group_name === g).map((r) => (
              <div key={r.key} className="space-y-1">
                <Label>{r.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={r.value}
                  onChange={(e) => update(r.key, parseInt(e.target.value || "0", 10))}
                />
              </div>
            ))}
          </div>
        </Card>
      ))}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Salvataggio…" : "Salva quote"}</Button>
      </div>
    </div>
  );
}
