import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCategories } from "@/hooks/useCategories";
import { useSeason } from "@/contexts/SeasonContext";

const DAYS = [
  { idx: 1, label: "L" },
  { idx: 2, label: "M" },
  { idx: 3, label: "M" },
  { idx: 4, label: "G" },
  { idx: 5, label: "V" },
  { idx: 6, label: "S" },
  { idx: 0, label: "D" },
];

type Schedule = { id: string; category: string; day_of_week: number; is_active: boolean };

export function SchedulesAdmin() {
  const { categories } = useCategories({ activeOnly: true });
  const { activeSeason } = useSeason();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("training_schedules").select("id,category,day_of_week,is_active").eq("is_active", true);
    setSchedules((data as Schedule[]) || []);
  };

  useEffect(() => { load(); }, []);

  const isOn = (category: string, day: number) =>
    schedules.some((s) => s.category === category && s.day_of_week === day);

  const toggle = async (category: string, day: number) => {
    const key = `${category}:${day}`;
    setBusy(key);
    try {
      const existing = schedules.find((s) => s.category === category && s.day_of_week === day);
      if (existing) {
        const { error } = await supabase.from("training_schedules").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_schedules").insert({ category, day_of_week: day });
        if (error) throw error;
      }
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const generate = async (category: string) => {
    setGenerating(category);
    try {
      const { data, error } = await supabase.functions.invoke("generate-trainings", {
        body: { category, season_id: activeSeason?.id },
      });
      if (error) throw error;
      toast.success(`Generati ${data?.generated ?? 0} allenamenti per ${category}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Configura regole allenamenti</h2>
        <p className="text-sm text-muted-foreground">
          Imposta i giorni della settimana in cui si allena ogni categoria, poi genera le date per la stagione.
        </p>
      </div>

      {categories.map((c) => (
        <Card key={c.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="font-semibold">{c.label}</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generate(c.name)}
              disabled={generating === c.name}
            >
              {generating === c.name ? "Generazione…" : "Genera allenamenti stagione"}
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => {
              const on = isOn(c.name, d.idx);
              const key = `${c.name}:${d.idx}`;
              return (
                <button
                  key={d.idx}
                  type="button"
                  onClick={() => toggle(c.name, d.idx)}
                  disabled={busy === key}
                  className={`h-10 w-10 rounded-md border text-sm font-semibold transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  } ${busy === key ? "opacity-50" : ""}`}
                  aria-pressed={on}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}