import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

type BadgeDef = {
  id: string;
  key: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  threshold: number | null;
  is_active: boolean;
  sort_order: number;
};

export function BadgesAdmin() {
  const [defs, setDefs] = useState<BadgeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("badge_definitions").select("*").order("sort_order");
    setDefs(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = async (key: string, patch: Partial<BadgeDef>) => {
    const { error } = await (supabase as any).from("badge_definitions").update(patch).eq("key", key);
    if (error) return toast.error(error.message);
    setDefs((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const recompute = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("compute-badges");
    setRunning(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success(`Ricalcolo completato — ${(data as any)?.inserted ?? 0} badge assegnati`);
  };

  const grouped = defs.reduce<Record<string, BadgeDef[]>>((acc, d) => {
    (acc[d.category] ||= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Badge</h2>
          <p className="text-sm text-muted-foreground">Configura le soglie e ricalcola i badge dei giocatori.</p>
        </div>
        <Button onClick={recompute} disabled={running} className="min-h-11">
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          {running ? "Ricalcolo…" : "Ricalcola badge"}
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Caricamento…</p> : null}

      {Object.entries(grouped).map(([cat, items]) => (
        <Card key={cat} className="p-4">
          <h3 className="font-semibold mb-3">{cat}</h3>
          <div className="space-y-2">
            {items.map((d) => (
              <div key={d.key} className="grid grid-cols-1 md:grid-cols-[auto,1fr,auto,auto] gap-3 items-center border-b last:border-b-0 pb-2">
                <div className="text-2xl">{d.emoji}</div>
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Soglia</label>
                  <Input
                    type="number"
                    className="w-20"
                    value={d.threshold ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setDefs((rows) => rows.map((r) => (r.key === d.key ? { ...r, threshold: v } : r)));
                    }}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      update(d.key, { threshold: v });
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={d.is_active} onCheckedChange={(v) => update(d.key, { is_active: v })} />
                  <Badge variant={d.is_active ? "default" : "secondary"}>{d.is_active ? "Attivo" : "Off"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}