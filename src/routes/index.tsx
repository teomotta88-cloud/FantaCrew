import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, Sparkles, Coins, ShieldCheck, Rocket } from "lucide-react";

export const Route = createFileRoute("/")({
  component: FantacrewHome,
  head: () => ({
    meta: [
      { title: "Fantacrew — Il fantasy della tua crew" },
      {
        name: "description",
        content:
          "Fantacrew è la piattaforma fantasy per la tua crew: costruisci la rosa, sfida gli amici e spendi Crewcoin in azioni speciali.",
      },
    ],
  }),
});

function FantacrewHome() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="text-xl font-black tracking-tight">
          Fanta<span className="italic text-primary">crew</span>
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Accedi / Registrati</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/crea-club">Crea il tuo club</Link>
          </Button>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="relative container mx-auto px-4 py-20 md:py-32 text-primary-foreground">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              ✨ La piattaforma fantasy per la tua crew
            </div>
            <h1 className="mt-6 text-5xl md:text-7xl font-black tracking-tight">
              Fanta <span className="italic">crew</span>
            </h1>
            <p className="mt-4 text-lg md:text-xl text-white/85 max-w-xl">
              Crea la tua squadra, sfida gli amici e vivi ogni stagione come un vero protagonista.
              Spendi <strong>Crewcoin</strong> per costruire la rosa e attivare azioni speciali.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link to="/login">Accedi / Registrati</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent text-white border-white/40 hover:bg-white/10 hover:text-white"
              >
                <Link to="/crea-club">Crea il tuo club</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Users,
              title: "Costruisci la rosa",
              text: "Scegli i tuoi giocatori e componi la squadra che ti rappresenta.",
            },
            {
              icon: Coins,
              title: "Economia in Crewcoin",
              text: "Usa i Crewcoin per acquisti, scambi e azioni speciali durante la stagione.",
            },
            {
              icon: Trophy,
              title: "Sfide e classifiche",
              text: "Affronta gli altri membri della crew e scala la leaderboard.",
            },
            {
              icon: Sparkles,
              title: "Azioni speciali",
              text: "Bonus, malus e jolly per ribaltare la giornata.",
            },
            {
              icon: ShieldCheck,
              title: "Gestione semplice",
              text: "Strumenti pensati per gli admin della crew e per chi gioca.",
            },
            {
              icon: Rocket,
              title: "Pensata per le crew",
              text: "Un'esperienza fantasy su misura per il tuo gruppo.",
            },
          ].map((f) => (
            <Card key={f.title} className="p-6" style={{ background: "var(--gradient-card)" }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-lg">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-10 p-8 md:p-12 text-center" style={{ background: "var(--gradient-hero)" }}>
          <ShieldCheck className="mx-auto h-10 w-10 text-white/90" />
          <h2 className="mt-4 text-3xl md:text-4xl font-bold text-primary-foreground">
            Pronto a giocare con la tua crew?
          </h2>
          <p className="mt-2 text-primary-foreground/80">
            Registrati gratis, entra nella tua crew e inizia a spendere Crewcoin.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/crea-club">Crea il tuo club</Link>
          </Button>
        </Card>
      </section>
    </div>
  );
}