import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCrew } from "@/contexts/CrewContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { readableTextColor } from "@/lib/dominantColor";
import { Coins, Trophy, Users, Sparkles, Rocket, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/$crewSlug/")({
  component: CrewHome,
});

function CrewHome() {
  const { crewSlug } = useParams({ from: "/$crewSlug/" });
  const { crew } = useCrew();
  const primary = crew?.primary_color || "#1a5d3a";
  const onPrimary = readableTextColor(primary);
  const title = `Fanta ${crew?.name ?? crewSlug}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${primary}cc 60%, ${primary}99 100%)`,
          color: onPrimary,
        }}
      >
        <div className="container mx-auto px-4 py-16 md:py-24 flex flex-col md:flex-row items-center gap-8">
          {crew?.logo_url && (
            <img
              src={crew.logo_url}
              alt={`Logo ${crew.name}`}
              className="h-32 w-32 md:h-40 md:w-40 rounded-2xl object-cover shadow-xl bg-white/20 backdrop-blur"
            />
          )}
          <div className="text-center md:text-left flex-1">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{title}</h1>
            <p className="mt-4 text-lg md:text-xl opacity-90 max-w-2xl">
              Crea la tua squadra, gioca con i tuoi amici e spendi i tuoi Crewcoin per costruire la rosa
              perfetta.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center md:justify-start">
              <Button asChild size="lg" style={{ background: onPrimary, color: primary }}>
                <Link to="/$crewSlug/dashboard" params={{ crewSlug }}>
                  <Rocket className="h-5 w-5 mr-2" /> Entra nel team
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                style={{ borderColor: onPrimary, color: onPrimary, background: "transparent" }}
              >
                <Link to="/$crewSlug/players" params={{ crewSlug }}>
                  Esplora i giocatori
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <main className="container mx-auto px-4 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Users, title: "La tua crew", desc: "Sfida gli amici e scopri chi è il manager migliore." },
            { icon: Coins, title: "Crewcoin", desc: "Spendi i tuoi Crewcoin per assemblare la rosa." },
            { icon: Trophy, title: "Classifica live", desc: "Punteggi aggiornati di settimana in settimana." },
            { icon: Sparkles, title: "Azioni speciali", desc: "Bonus e missioni per accumulare punti extra." },
            { icon: ShieldCheck, title: "Obbligatorietà", desc: "Mantieni la rosa in regola con le quote stagionali." },
            { icon: Rocket, title: "Sempre attivo", desc: "Allenamenti, partite e premi durante tutta la stagione." },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-6 hover:shadow-lg transition-shadow">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${primary}22`, color: primary }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>

        <Card
          className="mt-12 p-8 md:p-12 text-center"
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${primary}dd 100%)`,
            color: onPrimary,
            border: "none",
          }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Pronto a giocare con {crew?.name ?? "noi"}?</h2>
          <p className="opacity-90 mb-6 max-w-xl mx-auto">
            Accedi al tuo team e inizia subito a gestire la tua rosa.
          </p>
          <Button asChild size="lg" style={{ background: onPrimary, color: primary }}>
            <Link to="/$crewSlug/dashboard" params={{ crewSlug }}>
              Vai alla dashboard
            </Link>
          </Button>
        </Card>
      </main>
    </div>
  );
}