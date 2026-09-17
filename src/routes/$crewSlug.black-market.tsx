import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useSeason } from "@/contexts/SeasonContext";
import { useCategories } from "@/hooks/useCategories";
import { SEASON, categoryLabel } from "@/lib/constants";
import { ChevronDown, RefreshCw, Skull, Zap, Heart, Crosshair, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/$crewSlug/black-market")({
  component: BlackMarketPage,
  head: () => ({ meta: [{ title: "Black Market 🖤 — Fanta Lambro" }] }),
});

type Player = {
  id: string;
  full_name: string;
  category: string;
  role: string;
  value_zaghetti: number;
};

type Ranked = Player & { stat: number; total: number; ownership: number };

type CategoryData = {
  category: string;
  metaman: Ranked[];
  yellow: Ranked[];
  red: Ranked[];
  cecchini: Ranked[];
  club: Ranked[];
  rookie: Ranked[];
  maledizioni: Ranked[];
};

function topN<T>(arr: T[], n: number, cmp: (a: T, b: T) => number) {
  return [...arr].sort(cmp).slice(0, n);
}

function AdviceCard({
  title,
  emoji,
  icon: Icon,
  rows,
  statLabel,
  description,
  tone = "default",
}: {
  title: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: Ranked[];
  statLabel: string;
  description?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const borderTone =
    tone === "danger"
      ? "border-destructive/40"
      : tone === "warning"
        ? "border-yellow-500/40"
        : tone === "success"
          ? "border-emerald-500/40"
          : "border-border";

  return (
    <Card className={`p-4 border-2 ${borderTone}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" />
        <h3 className="font-semibold text-sm">
          {emoji} {title}
        </h3>
      </div>
      {description && <p className="text-xs text-muted-foreground mb-3 italic">{description}</p>}
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nessun candidato</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
              <span className="flex-1 truncate font-medium">{p.full_name}</span>
              <span className="text-xs text-muted-foreground">
                {p.stat} {statLabel}
              </span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {p.value_zaghetti} Z
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// One section per tipologia, showing all categories inside
type TipologiaKey = "metaman" | "yellow" | "red" | "cecchini" | "club" | "rookie" | "maledizioni";

const TIPOLOGIE: {
  key: TipologiaKey;
  title: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  statLabel: string;
  description: string;
  tone?: "default" | "warning" | "danger" | "success";
}[] = [
  {
    key: "metaman",
    title: "Metaman",
    emoji: "🏉",
    icon: Zap,
    statLabel: "mete",
    description: "I bombardieri della meta. Punti garantiti.",
    tone: "success",
  },
  {
    key: "yellow",
    title: "Cartellini Gialli",
    emoji: "🟨",
    icon: TrendingDown,
    statLabel: "gialli",
    description: "Manesco e indisciplinato. Attento ai malus.",
    tone: "warning",
  },
  {
    key: "red",
    title: "Cartellini Rossi",
    emoji: "🟥",
    icon: TrendingDown,
    statLabel: "rossi",
    description: "Espulsioni che fanno male in classifica.",
    tone: "danger",
  },
  {
    key: "cecchini",
    title: "Cecchini",
    emoji: "🎯",
    icon: Crosshair,
    statLabel: "calci",
    description: "Punti dalla piazzola: piazzati e trasformazioni.",
    tone: "success",
  },
  {
    key: "club",
    title: "Cuore del Club",
    emoji: "💙",
    icon: Heart,
    statLabel: "eventi",
    description: "Sempre presenti agli eventi della società.",
  },
  {
    key: "rookie",
    title: "Rookie",
    emoji: "🌱",
    icon: Sparkles,
    statLabel: "pt",
    description: "Sottovalutato ma forte. Compralo prima degli altri.",
    tone: "success",
  },
  {
    key: "maledizioni",
    title: "Maledizioni",
    emoji: "💀",
    icon: Skull,
    statLabel: "pt",
    description: "Tutti ce l'hanno ma rende poco. Valuta la cessione.",
    tone: "danger",
  },
];

function TipologiaSection({
  tip,
  data,
  labelMap,
}: {
  tip: (typeof TIPOLOGIE)[number];
  data: CategoryData[];
  labelMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(true);

  const borderTone =
    tip.tone === "danger"
      ? "border-destructive/40"
      : tip.tone === "warning"
        ? "border-yellow-500/40"
        : tip.tone === "success"
          ? "border-emerald-500/40"
          : "border-border";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6">
      <CollapsibleTrigger
        className={`w-full flex items-center justify-between p-3 rounded-lg bg-card border-2 ${borderTone} hover:bg-muted/40 transition-colors`}
      >
        <div className="flex items-center gap-2">
          <tip.icon className="h-4 w-4" />
          <h2 className="text-lg font-bold">
            {tip.emoji} {tip.title}
          </h2>
          {tip.description && (
            <span className="text-xs text-muted-foreground italic hidden sm:inline">— {tip.description}</span>
          )}
        </div>
        <ChevronDown className={`h-5 w-5 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map((catData) => {
          const rows = catData[tip.key];
          const catLabel = labelMap[catData.category] || catData.category;
          return (
            <Card key={catData.category} className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{catLabel}</div>
              {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">Nessun candidato</p>
              ) : (
                <ul className="space-y-1.5">
                  {rows.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                      <span className="flex-1 truncate font-medium">{p.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.stat} {tip.statLabel}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {p.value_zaghetti} Z
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function BlackMarketPage() {
  const { seasonId } = useSeason();
  const { categories: cats, labelMap } = useCategories({ activeOnly: true });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CategoryData[]>([]);

  const load = useCallback(async () => {
    setLoading(true);

    // Load all active scoring rules first to resolve rule_keys dynamically
    const { data: rulesData } = await supabase
      .from("scoring_rules")
      .select("key,label,is_malus,score_type,points,is_active");

    const activeRules = (rulesData || []).filter((r: any) => r.is_active !== false);

    // Identify rule_keys by label keywords (robust against Italian/English naming)
    const tryKeys = new Set(
      activeRules.filter((r: any) => /meta|try/i.test(r.label) && !r.is_malus).map((r: any) => r.key),
    );
    const yellowKeys = new Set(activeRules.filter((r: any) => /giall|yellow/i.test(r.label)).map((r: any) => r.key));
    const redKeys = new Set(
      activeRules.filter((r: any) => /ross|red.*cart|cart.*ross|expuls/i.test(r.label)).map((r: any) => r.key),
    );
    const kickKeys = new Set(
      activeRules
        .filter((r: any) => /piazzat|trasform|calcio|conversion|penalty.*kick|kick/i.test(r.label) && !r.is_malus)
        .map((r: any) => r.key),
    );
    const clubKeys = new Set(activeRules.filter((r: any) => r.score_type === "club").map((r: any) => r.key));
    const pointsMap = new Map(activeRules.map((r: any) => [r.key, r.points as number]));

    // Load ALL events without inner join — filter client-side
    const buildEvQ = () => supabase.from("weekly_events").select("player_id,rule_key,quantity");

    const [{ data: players }, { data: events }, { data: tp }, { data: teams }] = await Promise.all([
      supabase.from("players").select("id,full_name,category,role,value_zaghetti"),
      seasonId ? buildEvQ().or(`season_id.eq.${seasonId},season.eq.${SEASON}`) : buildEvQ().eq("season", SEASON),
      supabase.from("team_players").select("player_id"),
      supabase
        .from("teams")
        .select("id")
        .eq(seasonId ? "season_id" : "season", seasonId ?? SEASON),
    ]);

    const totalTeams = Math.max(1, (teams || []).length);

    // Ownership counts
    const ownCount = new Map<string, number>();
    (tp || []).forEach((r: any) => {
      ownCount.set(r.player_id, (ownCount.get(r.player_id) ?? 0) + 1);
    });

    // Aggregate per player
    const totals = new Map<string, number>();
    const tries = new Map<string, number>();
    const yellows = new Map<string, number>();
    const reds = new Map<string, number>();
    const kicks = new Map<string, number>();
    const club = new Map<string, number>();

    (events as any[] | null)?.forEach((e) => {
      const q = e.quantity || 1;
      const pts = (pointsMap.get(e.rule_key) ?? 0) * q;
      totals.set(e.player_id, (totals.get(e.player_id) ?? 0) + pts);
      if (tryKeys.has(e.rule_key)) tries.set(e.player_id, (tries.get(e.player_id) ?? 0) + q);
      if (yellowKeys.has(e.rule_key)) yellows.set(e.player_id, (yellows.get(e.player_id) ?? 0) + q);
      if (redKeys.has(e.rule_key)) reds.set(e.player_id, (reds.get(e.player_id) ?? 0) + q);
      if (kickKeys.has(e.rule_key)) kicks.set(e.player_id, (kicks.get(e.player_id) ?? 0) + q);
      if (clubKeys.has(e.rule_key)) club.set(e.player_id, (club.get(e.player_id) ?? 0) + q);
    });

    const buildRanked = (p: Player, stat: number): Ranked => ({
      ...p,
      stat,
      total: totals.get(p.id) ?? 0,
      ownership: ((ownCount.get(p.id) ?? 0) / totalTeams) * 100,
    });

    const allPlayers = (players || []) as Player[];
    const allRanked = allPlayers.map((p) => buildRanked(p, 0));
    const overallRank = new Map<string, number>();
    [...allRanked].sort((a, b) => b.total - a.total).forEach((p, i) => overallRank.set(p.id, i + 1));

    const categoryList = Array.from(new Set(allPlayers.map((p) => p.category))).filter(Boolean);

    const result: CategoryData[] = categoryList.map((category) => {
      const inCat = allPlayers.filter((p) => p.category === category);
      const ranked = inCat.map((p) => buildRanked(p, 0));
      const catRank = new Map<string, number>();
      [...ranked].sort((a, b) => b.total - a.total).forEach((p, i) => catRank.set(p.id, i + 1));
      const catSize = ranked.length;

      const withStat = (m: Map<string, number>) =>
        inCat.map((p) => buildRanked(p, m.get(p.id) ?? 0)).filter((p) => p.stat > 0);

      const metaman = topN(withStat(tries), 3, (a, b) => b.stat - a.stat);
      const yellow = topN(withStat(yellows), 3, (a, b) => b.stat - a.stat);
      const red = topN(withStat(reds), 3, (a, b) => b.stat - a.stat);
      const cecchini = topN(withStat(kicks), 3, (a, b) => b.stat - a.stat);
      const clubTop = topN(withStat(club), 3, (a, b) => b.stat - a.stat);

      const rookie = ranked
        .map((p) => ({ ...p, stat: p.total }))
        .filter((p) => p.ownership < 10 && ((catRank.get(p.id) ?? 999) <= 15 || (overallRank.get(p.id) ?? 999) <= 30))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      const maledizioni = ranked
        .map((p) => ({ ...p, stat: p.total }))
        .filter((p) => p.ownership > 50 && (catRank.get(p.id) ?? 0) > catSize / 2)
        .sort((a, b) => a.total - b.total)
        .slice(0, 3);

      return { category, metaman, yellow, red, cecchini, club: clubTop, rookie, maledizioni };
    });

    // Sort by category sort_order from cats
    const order = new Map(cats.map((c, i) => [c.name, i]));
    result.sort((a, b) => (order.get(a.category) ?? 999) - (order.get(b.category) ?? 999));

    setData(result);
    setLoading(false);
  }, [seasonId, cats]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skull className="h-7 w-7" />
          <div>
            <h1 className="text-3xl font-bold">Black Market 🖤</h1>
            <p className="text-sm text-muted-foreground">
              Consigli per il mercato: chi comprare, chi vendere, chi tenere d'occhio.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nessun dato disponibile.</Card>
      ) : (
        TIPOLOGIE.map((tip) => <TipologiaSection key={tip.key} tip={tip} data={data} labelMap={labelMap ?? {}} />)
      )}
    </PageShell>
  );
}
