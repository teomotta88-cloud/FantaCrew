import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/layout/PageShell";
import { PlayerCard, type PlayerLite } from "@/components/players/PlayerCard";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategories } from "@/hooks/useCategories";
import { useBlockTM } from "@/hooks/useBlockTM";

export const Route = createFileRoute("/$crewSlug/players")({
  component: PlayersPage,
  head: () => ({ meta: [{ title: "Giocatori — Fanta Lambro" }] }),
});

function PlayersPage() {
  useBlockTM();
  const { categories } = useCategories({ activeOnly: true });
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    supabase.from("players").select("id,full_name,photo_url,category,role,value_zaghetti").order("value_zaghetti", { ascending: false })
      .then(({ data }) => setPlayers((data as PlayerLite[]) || []));
    supabase.from("zaghetti_history")
      .select("player_id,delta,month,season,created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const m: Record<string, number> = {};
        (data || []).forEach((r: any) => { if (!(r.player_id in m)) m[r.player_id] = r.delta; });
        setDeltas(m);
      });
  }, []);

  const filtered = players.filter((p) =>
    (cat === "all" || p.category === cat) && p.full_name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Listone giocatori</h1>
        <p className="text-muted-foreground">Tutti i giocatori del Lambro Rugby con il loro valore in Zaghetti.</p>
      </div>
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <Input placeholder="Cerca un giocatore…" value={q} onChange={(e) => setQ(e.target.value)} className="md:max-w-sm" />
        <Tabs value={cat} onValueChange={setCat}>
          <TabsList>
            <TabsTrigger value="all">Tutti</TabsTrigger>
            {categories.map((c) => <TabsTrigger key={c.name} value={c.name}>{c.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nessun giocatore. L'admin deve ancora aggiungerli.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((p) => <PlayerCard key={p.id} player={p} zaghettiDelta={deltas[p.id] ?? null} />)}
        </div>
      )}
    </PageShell>
  );
}