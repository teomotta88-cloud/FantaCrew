import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { computeAllTeamScores, type TeamScore } from "@/lib/scoring";
import { Trophy } from "lucide-react";

import { useCrew } from "@/contexts/CrewContext";
export const Route = createFileRoute("/$crewSlug/championship/")({
  component: ChampionshipPage,
  head: () => ({
    meta: [
      { title: "Campionato — Fanta Lambro" },
      { name: "description", content: "Il campionato unico di Fanta Lambro con tutte le squadre iscritte." },
    ],
  }),
});

function ChampionshipPage() {
  const { crewSlug } = useCrew();
  const [rows, setRows] = useState<TeamScore[]>([]);
  useEffect(() => { computeAllTeamScores().then(setRows); }, []);
  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-3">
        <Trophy className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Campionato</h1>
          <p className="text-sm text-muted-foreground">Tutte le squadre degli utenti iscritti competono in un unico campionato.</p>
        </div>
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Ancora nessuna squadra iscritta al campionato.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((r, i) => (
              <li key={r.team_id}>
                <Link to="/$crewSlug/championship/$teamId" params={{ crewSlug, teamId: r.team_id }} className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold ${i < 3 ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.team_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.manager_name}</div>
                </div>
                <div className="text-xl font-bold text-primary">{r.total}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
