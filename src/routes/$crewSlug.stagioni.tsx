import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { categoryLabel } from "@/lib/constants";

type Season = { id: string; name: string; starts_at: string; ends_at: string; is_active: boolean; is_archived: boolean };
type TeamRes = { team_name: string; manager_name: string | null; final_rank: number; final_points: number };
type PlayerRes = { full_name: string; category: string; final_rank: number; final_points: number };

export const Route = createFileRoute("/$crewSlug/stagioni")({
  component: SeasonsPage,
  head: () => ({
    meta: [
      { title: "Stagioni — Fanta Lambro" },
      { name: "description", content: "Storico delle stagioni e classifiche finali del Fanta Lambro." },
    ],
  }),
});

function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [teamRes, setTeamRes] = useState<TeamRes[]>([]);
  const [playerRes, setPlayerRes] = useState<PlayerRes[]>([]);

  useEffect(() => {
    supabase.from("seasons").select("*").order("starts_at", { ascending: false }).then(({ data }) => {
      const list = (data as Season[]) || [];
      setSeasons(list);
      if (list.length && !selected) setSelected(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    Promise.all([
      supabase.from("season_results").select("*").eq("season_id", selected).order("final_rank"),
      supabase.from("season_player_results").select("*").eq("season_id", selected).order("final_rank"),
    ]).then(([t, p]) => {
      setTeamRes((t.data as TeamRes[]) || []);
      setPlayerRes((p.data as PlayerRes[]) || []);
    });
  }, [selected]);

  const current = seasons.find((s) => s.id === selected);
  const topPlayers = playerRes.slice(0, 10);
  const byCat = new Map<string, PlayerRes[]>();
  for (const p of playerRes) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category)!.push(p);
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-2">Stagioni</h1>
      <p className="text-sm text-muted-foreground mb-6">Storico delle stagioni e classifiche finali.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {seasons.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${selected === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
          >
            {s.name} {s.is_active && <Badge variant="secondary" className="ml-1">attiva</Badge>}
          </button>
        ))}
      </div>

      {current && (
        <>
          {current.is_active && teamRes.length === 0 && (
            <Card className="p-5 mb-4">
              <p className="text-sm">Stagione in corso. Le classifiche finali saranno disponibili al termine.</p>
            </Card>
          )}

          {teamRes.length > 0 && (
            <Tabs defaultValue="teams" className="w-full">
              <TabsList>
                <TabsTrigger value="teams">Squadre</TabsTrigger>
                <TabsTrigger value="players">Giocatori</TabsTrigger>
              </TabsList>
              <TabsContent value="teams" className="mt-4">
                <Card className="p-5">
                  <h3 className="font-semibold mb-3">Top 10 squadre</h3>
                  <ul className="space-y-2">
                    {teamRes.slice(0, 10).map((t) => (
                      <li key={t.final_rank} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="font-bold w-8">{t.final_rank}.</span>
                          <div>
                            <p className="font-medium">{t.team_name}</p>
                            {t.manager_name && <p className="text-xs text-muted-foreground">{t.manager_name}</p>}
                          </div>
                        </div>
                        <span className="font-bold">{t.final_points} pt</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </TabsContent>
              <TabsContent value="players" className="mt-4 space-y-4">
                <Card className="p-5">
                  <h3 className="font-semibold mb-3">Top 10 giocatori</h3>
                  <ul className="space-y-2">
                    {topPlayers.map((p) => (
                      <li key={p.final_rank} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="font-bold w-8">{p.final_rank}.</span>
                          <div>
                            <p className="font-medium">{p.full_name}</p>
                            <Badge variant="outline">{categoryLabel(p.category)}</Badge>
                          </div>
                        </div>
                        <span className="font-bold">{p.final_points} pt</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                {Array.from(byCat.entries()).map(([cat, ps]) => (
                  <Card key={cat} className="p-5">
                    <h3 className="font-semibold mb-3">Top 3 {categoryLabel(cat)}</h3>
                    <ul className="space-y-2">
                      {ps.slice(0, 3).map((p, i) => (
                        <li key={p.final_rank} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="font-bold w-8">{i + 1}.</span>
                            <p className="font-medium">{p.full_name}</p>
                          </div>
                          <span className="font-bold">{p.final_points} pt</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </PageShell>
  );
}