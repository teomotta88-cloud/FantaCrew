import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBlockTM } from "@/hooks/useBlockTM";
import { PageShell } from "@/components/layout/PageShell";
import { PlayerCard, type PlayerLite } from "@/components/players/PlayerCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEASON, ROLE_GROUPS, getRoleGroup, type RoleGroupKey } from "@/lib/constants";
import { useSeason } from "@/contexts/SeasonContext";
import { useTeamConfig } from "@/hooks/useTeamConfig";
import { useCategories, categoryLabelOf } from "@/hooks/useCategories";
import { toast } from "sonner";
import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZaghettoIcon } from "@/components/ZaghettoIcon";
import { Megaphone } from "lucide-react";
import { AlertTriangle, Star } from "lucide-react";

type MandatorySlot = {
  id: string;
  title: string;
  description: string | null;
  eligible_player_ids: string[];
  starts_at: string;
  ends_at: string;
  penalties_applied?: boolean;
};

type TeamPenalty = {
  id: string;
  mandatory_slot_id: string | null;
  points: number;
  reason: string;
  applied_at: string;
};

export const Route = createFileRoute("/$crewSlug/team")({
  component: TeamPage,
  head: () => ({ meta: [{ title: "La mia squadra — Fanta Lambro" }] }),
});

function TeamPage() {
  useBlockTM();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { seasonId } = useSeason();
  const { config } = useTeamConfig();
  const { categories } = useCategories({ activeOnly: true });
  const { budget: BUDGET, squadSize: SQUAD_SIZE, minPerCategory, groupRequired, coachesRequired, multipliers } = config;
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [coaches, setCoaches] = useState<
    { id: string; full_name: string; photo_url: string | null; category: string }[]
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedCoaches, setSelectedCoaches] = useState<Set<string>>(new Set());
  const [captain, setCaptain] = useState<string | null>(null);
  const [talisman, setTalisman] = useState<string | null>(null);
  const [silverback, setSilverback] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [captainChangedAt, setCaptainChangedAt] = useState<string | null>(null);
  const [talismanChangedAt, setTalismanChangedAt] = useState<string | null>(null);
  const [silverbackChangedAt, setSilverbackChangedAt] = useState<string | null>(null);
  const [initialCaptain, setInitialCaptain] = useState<string | null>(null);
  const [initialTalisman, setInitialTalisman] = useState<string | null>(null);
  const [initialSilverback, setInitialSilverback] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [mandatorySlots, setMandatorySlots] = useState<MandatorySlot[]>([]);
  const [allRecentSlots, setAllRecentSlots] = useState<MandatorySlot[]>([]);
  const [teamPenalties, setTeamPenalties] = useState<TeamPenalty[]>([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const [playerJoinedMap, setPlayerJoinedMap] = useState<Map<string, string>>(new Map());
  const [freeTransfersThisMonth, setFreeTransfersThisMonth] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("mandatory_slots")
      .select("id,title,description,eligible_player_ids,starts_at,ends_at,penalties_applied")
      .order("starts_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        const all = ((data as any[]) || []) as MandatorySlot[];
        setAllRecentSlots(all);
        const now = Date.now();
        const active = all.filter((s) => new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() > now);
        setMandatorySlots(active as MandatorySlot[]);
      });
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  useEffect(() => {
    if (!teamId) {
      setTeamPenalties([]);
      return;
    }
    supabase
      .from("team_penalties")
      .select("id,mandatory_slot_id,points,reason,applied_at")
      .eq("team_id", teamId)
      .then(({ data }) => setTeamPenalties((data as TeamPenalty[]) || []));
  }, [teamId]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    supabase
      .from("players")
      .select("id,full_name,photo_url,category,role,value_zaghetti")
      .order("category")
      .order("value_zaghetti", { ascending: false })
      .then(({ data }) => setPlayers((data as PlayerLite[]) || []));
    supabase
      .from("coaches")
      .select("id,full_name,photo_url,category")
      .order("full_name")
      .then(({ data }) => setCoaches((data as any) || []));
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const teamQ = supabase
        .from("teams")
        .select(
          "id,name,captain_player_id,talisman_player_id,silverback_player_id,captain_changed_at,talisman_changed_at,silverback_changed_at",
        )
        .eq("manager_id", user.id);
      const { data: team } = await (
        seasonId ? teamQ.eq("season_id", seasonId) : teamQ.eq("season", SEASON)
      ).maybeSingle();
      if (team) {
        setTeamId(team.id);
        setTeamName(team.name);
        setCaptain(team.captain_player_id);
        setTalisman((team as any).talisman_player_id ?? null);
        setSilverback((team as any).silverback_player_id ?? null);
        setInitialCaptain(team.captain_player_id);
        setInitialTalisman((team as any).talisman_player_id ?? null);
        setInitialSilverback((team as any).silverback_player_id ?? null);
        setCaptainChangedAt((team as any).captain_changed_at ?? null);
        setTalismanChangedAt((team as any).talisman_changed_at ?? null);
        setSilverbackChangedAt((team as any).silverback_changed_at ?? null);
        const { data: tp } = await supabase.from("team_players").select("player_id").eq("team_id", team.id);
        setSelected(new Set((tp || []).map((r) => r.player_id)));
        const { data: tc } = await supabase.from("team_coaches").select("coach_id").eq("team_id", team.id);
        setSelectedCoaches(new Set((tc || []).map((r) => r.coach_id)));
        const { data: tph } = await supabase
          .from("team_player_history")
          .select("player_id,joined_at")
          .eq("team_id", team.id)
          .is("left_at", null);
        setPlayerJoinedMap(new Map(((tph as any[]) || []).map((r) => [r.player_id, r.joined_at])));
        const _mPrefix = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
        const { data: _sessions } = await supabase
          .from("transfer_sessions" as any)
          .select("id,saved_at,transfer_type")
          .eq("team_id", team.id)
          .eq("transfer_type", "free")
          .gte("saved_at", `${_mPrefix}-01T00:00:00Z`);
        setFreeTransfersThisMonth(((_sessions as any[]) || []).length);
      } else {
        setTeamName(`Squadra di ${user.email?.split("@")[0]}`);
      }
    })();
  }, [user?.id, seasonId]);

  const selectedPlayers = useMemo(() => players.filter((p) => selected.has(p.id)), [players, selected]);
  const spent = selectedPlayers.reduce((s, p) => s + p.value_zaghetti, 0);
  const remaining = BUDGET - spent;
  const counts: Record<string, number> = {};
  categories.forEach((c) => {
    counts[c.name] = 0;
  });
  selectedPlayers.forEach((p) => {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  });

  // Transfer window: 2 transfers per calendar month, no date restrictions
  const today = new Date();
  const isFirstTimeSquad = !teamId;
  const transfersThisMonth = freeTransfersThisMonth;
  const MAX_TRANSFERS_PER_MONTH = 2;
  const transfersLeft = Math.max(0, MAX_TRANSFERS_PER_MONTH - transfersThisMonth);
  const transferWindowOpen = isFirstTimeSquad || transfersLeft > 0;
  // Mandatory slot opens an extra 48h transfer window from starts_at
  const mandatoryWindowSlot = mandatorySlots.find((s) => {
    const startMs = new Date(s.starts_at).getTime();
    return nowTick - startMs < 48 * 60 * 60 * 1000;
  });
  const mandatoryWindowOpen = !!mandatoryWindowSlot;
  const canEditRosterWithoutMandatory = isFirstTimeSquad || transfersLeft > 0;
  const canEditRoster = canEditRosterWithoutMandatory || mandatoryWindowOpen;

  const mandatoryCountdown = (() => {
    if (!mandatoryWindowSlot) return null;
    const endMs = new Date(mandatoryWindowSlot.starts_at).getTime() + 48 * 60 * 60 * 1000;
    const diff = Math.max(0, endMs - nowTick);
    const h = Math.floor(diff / 3600_000);
    const m = Math.floor((diff % 3600_000) / 60_000);
    return `${h}h ${m}m`;
  })();

  // Validation: every active mandatory slot needs at least one of its eligible players in the squad
  const missingMandatory = mandatorySlots.filter((s) => !s.eligible_player_ids.some((pid) => selected.has(pid)));

  // Date formatter for warning banners
  const fmtEnd = (iso: string) =>
    new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const monthNames = [
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre",
  ];
  const nextWindow = (() => {
    if (transferWindowOpen) return null;
    // Window resets on the 1st of next month
    const next = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    return `1 ${monthNames[next.getUTCMonth()]}`;
  })();

  const canChangeRole = (changedAt: string | null) => {
    if (!changedAt) return { ok: true, daysLeft: 0 };
    const ms = Date.now() - new Date(changedAt).getTime();
    const days = ms / (1000 * 60 * 60 * 24);
    if (days >= 7) return { ok: true, daysLeft: 0 };
    return { ok: false, daysLeft: Math.ceil(7 - days) };
  };

  const tryChangeRole = (
    role: "captain" | "talisman" | "silverback",
    changedAt: string | null,
    label: string,
    apply: () => void,
  ) => {
    if (!isFirstTimeSquad) {
      const c = canChangeRole(changedAt);
      if (!c.ok) {
        toast.error(
          `Hai già cambiato il ${label} questa settimana. Riprova tra ${c.daysLeft} giorn${c.daysLeft === 1 ? "o" : "i"}.`,
        );
        return;
      }
    }
    apply();
  };

  const groupCounts: Record<RoleGroupKey, number> = {
    Mischia: 0,
    "Mediano di mischia": 0,
    "Mediano di apertura": 0,
    Trequarti: 0,
  };
  selectedPlayers.forEach((p) => {
    const g = getRoleGroup(p.role);
    if (g) groupCounts[g]++;
  });

  const toggle = (p: PlayerLite) => {
    if (!canEditRoster) {
      toast.error(
        `Hai già usato ${MAX_TRANSFERS_PER_MONTH} modifiche di mercato questo mese. Prossima finestra: ${nextWindow}.`,
      );
      return;
    }
    const next = new Set(selected);
    if (next.has(p.id)) {
      next.delete(p.id);
      if (captain === p.id) setCaptain(null);
      if (talisman === p.id) setTalisman(null);
      if (silverback === p.id) setSilverback(null);
    } else {
      if (next.size >= SQUAD_SIZE) {
        toast.error(`Massimo ${SQUAD_SIZE} giocatori`);
        return;
      }
      if (spent + p.value_zaghetti > BUDGET) {
        toast.error("Budget Zaghetti esaurito");
        return;
      }
      const g = getRoleGroup(p.role);
      if (g) {
        const required = groupRequired[g];
        if (groupCounts[g] >= required) {
          toast.error(`${g}: massimo ${required} giocatori`);
          return;
        }
      }
      next.add(p.id);
    }
    setSelected(next);
  };

  const toggleCoach = (c: { id: string }) => {
    if (!canEditRoster) {
      toast.error(
        `Hai già usato ${MAX_TRANSFERS_PER_MONTH} modifiche di mercato questo mese. Prossima finestra: ${nextWindow}.`,
      );
      return;
    }
    const next = new Set(selectedCoaches);
    if (next.has(c.id)) {
      next.delete(c.id);
    } else {
      next.add(c.id);
    }
    setSelectedCoaches(next);
  };

  const validate = () => {
    if (selected.size !== SQUAD_SIZE) return `Devi selezionare ${SQUAD_SIZE} giocatori (ne hai ${selected.size})`;
    if (selectedCoaches.size < coachesRequired)
      return `Devi scegliere almeno ${coachesRequired} allenatore (ne hai ${selectedCoaches.size})`;
    const missing: string[] = [];
    for (const g of ROLE_GROUPS) {
      const required = groupRequired[g.key];
      const diff = required - groupCounts[g.key];
      if (diff > 0) missing.push(`${diff} ${g.label}`);
      if (diff < 0) return `Troppi ${g.label} (${groupCounts[g.key]}/${required})`;
    }
    if (missing.length) return `Mancano ${missing.join(", ")}`;
    for (const c of categories) {
      const min = minPerCategory[c.name] ?? 0;
      const have = counts[c.name] ?? 0;
      if (have < min) return `Almeno ${min} ${c.label} (ne hai ${have})`;
    }
    if (!captain) return "Scegli un capitano";
    if (!talisman) return "Scegli un Talismano";
    if (!silverback) return "Scegli un Silverback";
    if (talisman === captain) return "Il Talismano non può essere anche il Capitano";
    if (silverback === captain) return "Il Silverback non può essere anche il Capitano";
    if (silverback === talisman) return "Il Silverback non può essere anche il Talismano";
    if (spent > BUDGET) return "Budget superato";
    if (!teamName.trim()) return "Dai un nome alla squadra";
    if (missingMandatory.length > 0)
      return `Slot obbligatorio mancante: ${missingMandatory.map((s) => s.title).join(", ")}`;
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      setShowErrors(true);
      return toast.error(err);
    }
    if (!user) return;
    setSaving(true);
    let id = teamId;
    const nowIso = new Date().toISOString();
    const previousSelected = new Set(playerJoinedMap.keys());
    const sessionType: "initial" | "mandatory" | "free" = isFirstTimeSquad
      ? "initial"
      : mandatoryWindowOpen && !canEditRosterWithoutMandatory
        ? "mandatory"
        : "free";
    const captainTouched = captain !== initialCaptain;
    const talismanTouched = talisman !== initialTalisman;
    const silverbackTouched = silverback !== initialSilverback;
    const updateRoleHistory = async (
      teamId2: string,
      role: "captain" | "talisman" | "silverback",
      newPlayerId: string | null,
    ) => {
      await supabase
        .from("role_assignment_history")
        .update({ removed_at: nowIso })
        .eq("team_id", teamId2)
        .eq("role", role)
        .is("removed_at", null);
      if (newPlayerId) {
        await supabase.from("role_assignment_history").insert({
          team_id: teamId2,
          player_id: newPlayerId,
          role,
          assigned_at: nowIso,
          removed_at: null,
        });
      }
    };
    if (!id) {
      const { data, error } = await supabase
        .from("teams")
        .insert({
          manager_id: user.id,
          name: teamName,
          captain_player_id: captain,
          talisman_player_id: talisman,
          silverback_player_id: silverback,
          captain_changed_at: nowIso,
          talisman_changed_at: nowIso,
          silverback_changed_at: nowIso,
          season: SEASON,
          season_id: seasonId,
        })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      id = data.id;
      setTeamId(id);
      setInitialCaptain(captain);
      setInitialTalisman(talisman);
      setInitialSilverback(silverback);
      setCaptainChangedAt(nowIso);
      setTalismanChangedAt(nowIso);
      setSilverbackChangedAt(nowIso);
      if (captain) await updateRoleHistory(id, "captain", captain);
      if (talisman) await updateRoleHistory(id, "talisman", talisman);
      if (silverback) await updateRoleHistory(id, "silverback", silverback);
      // First squad creation: insert all players into history with joined_at = now
      const histRows = Array.from(selected).map((player_id) => ({
        team_id: id!,
        player_id,
        joined_at: nowIso,
        transfer_type: sessionType,
        season: SEASON,
        season_id_ref: seasonId,
      }));
      if (histRows.length) await supabase.from("team_player_history").insert(histRows);
      setPlayerJoinedMap(new Map(histRows.map((r) => [r.player_id, nowIso])));
    } else {
      const update: any = {
        name: teamName,
        captain_player_id: captain,
        talisman_player_id: talisman,
        silverback_player_id: silverback,
      };
      if (captainTouched) update.captain_changed_at = nowIso;
      if (talismanTouched) update.talisman_changed_at = nowIso;
      if (silverbackTouched) update.silverback_changed_at = nowIso;
      const { error } = await supabase.from("teams").update(update).eq("id", id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      if (captainTouched) await updateRoleHistory(id, "captain", captain);
      if (talismanTouched) await updateRoleHistory(id, "talisman", talisman);
      if (silverbackTouched) await updateRoleHistory(id, "silverback", silverback);
      if (canEditRoster) {
        await supabase.from("team_players").delete().eq("team_id", id);
        await supabase.from("team_coaches").delete().eq("team_id", id);
        // Diff history: close removed, open added
        const removed = Array.from(previousSelected).filter((pid) => !selected.has(pid));
        const added = Array.from(selected).filter((pid) => !previousSelected.has(pid));
        for (const pid of removed) {
          await supabase
            .from("team_player_history")
            .update({ left_at: nowIso })
            .eq("team_id", id)
            .eq("player_id", pid)
            .is("left_at", null);
        }
        if (added.length) {
          await supabase.from("team_player_history").insert(
            added.map((player_id) => ({
              team_id: id!,
              player_id,
              joined_at: nowIso,
              transfer_type: sessionType,
              season: SEASON,
              season_id_ref: seasonId,
            })),
          );
        }
        const nextMap = new Map(playerJoinedMap);
        for (const pid of removed) nextMap.delete(pid);
        for (const pid of added) nextMap.set(pid, nowIso);
        setPlayerJoinedMap(nextMap);
      }
      if (captainTouched) setCaptainChangedAt(nowIso);
      if (talismanTouched) setTalismanChangedAt(nowIso);
      if (silverbackTouched) setSilverbackChangedAt(nowIso);
      setInitialCaptain(captain);
      setInitialTalisman(talisman);
      setInitialSilverback(silverback);
    }
    if (canEditRoster) {
      const rows = Array.from(selected).map((player_id) => ({ team_id: id!, player_id }));
      const { error: e2 } = await supabase.from("team_players").insert(rows);
      if (e2) {
        setSaving(false);
        return toast.error(e2.message);
      }
      if (selectedCoaches.size) {
        const cRows = Array.from(selectedCoaches).map((coach_id) => ({ team_id: id!, coach_id }));
        const { error: e3 } = await supabase.from("team_coaches").insert(cRows);
        if (e3) {
          setSaving(false);
          return toast.error(e3.message);
        }
      }
    }
    if (!isFirstTimeSquad && canEditRoster && id) {
      await supabase.from("transfer_sessions" as any).insert({
        team_id: id,
        saved_at: nowIso,
        transfer_type: sessionType,
        season_id: seasonId,
      });
      if (sessionType === "free") {
        setFreeTransfersThisMonth((n) => n + 1);
      }
    }
    setSaving(false);
    toast.success("Squadra salvata!");
  };

  const validation = validate();

  return (
    <PageShell>
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div>
          {mandatorySlots.length > 0 && (
            <Card className="p-4 mb-4 border-amber-500/40 bg-amber-500/5">
              <div className="flex items-start gap-3">
                <Star className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  {mandatorySlots.map((s) => (
                    <div key={s.id}>
                      <div className="font-semibold">{s.title}</div>
                      {s.description && <div className="text-sm text-muted-foreground">{s.description}</div>}
                      <div className="text-xs text-muted-foreground mt-1">
                        Devi includere uno tra:{" "}
                        {s.eligible_player_ids
                          .map((pid) => players.find((p) => p.id === pid)?.full_name || "?")
                          .join(", ")}
                      </div>
                    </div>
                  ))}
                  {mandatoryCountdown && (
                    <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      🚨 Finestra di mercato aperta: hai ancora {mandatoryCountdown} per aggiornare la rosa.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
          {teamId && missingMandatory.length > 0 && (
            <Card className="p-3 mb-4 border-destructive/50 bg-destructive/5 space-y-1">
              {missingMandatory.map((s) => (
                <div key={s.id} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>
                    ⚠️ Non hai rispettato l'obbligatorietà <strong>"{s.title}"</strong>. Se non aggiorni la rosa entro{" "}
                    <strong>{fmtEnd(s.ends_at)}</strong>, perderai 50 punti.
                  </span>
                </div>
              ))}
            </Card>
          )}
          {teamId &&
            teamPenalties.filter((p) => {
              // Only show penalties for active or recently-expired mandatory slots
              // (within last 7 days). Ignore challenge bonuses (mandatory_slot_id = null).
              if (!p.mandatory_slot_id) return false;
              const slot = allRecentSlots.find((s) => s.id === p.mandatory_slot_id);
              if (!slot) return false;
              const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
              return new Date(slot.ends_at).getTime() > sevenDaysAgo;
            }).length > 0 && (
              <Card className="p-3 mb-4 border-destructive bg-destructive/10 space-y-1">
                {teamPenalties
                  .filter((p) => {
                    if (!p.mandatory_slot_id) return false;
                    const slot = allRecentSlots.find((s) => s.id === p.mandatory_slot_id);
                    if (!slot) return false;
                    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                    return new Date(slot.ends_at).getTime() > sevenDaysAgo;
                  })
                  .map((p) => {
                    const slot = allRecentSlots.find((s) => s.id === p.mandatory_slot_id);
                    return (
                      <div key={p.id} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <span>
                          ❌ Penalità applicata: <strong>{p.points} punti</strong> per obbligatorietà non rispettata
                          {slot ? ` (${slot.title})` : ""}.
                        </span>
                      </div>
                    );
                  })}
              </Card>
            )}
          {mandatorySlots.length > 0 && (
            <Card className="p-4 mb-6 border">
              <h3 className="font-bold mb-3 inline-flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> Slot obbligatorio
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from(new Set(mandatorySlots.flatMap((s) => s.eligible_player_ids)))
                  .map((pid) => players.find((p) => p.id === pid))
                  .filter((p): p is PlayerLite => !!p)
                  .map((p) => {
                    const isSel = selected.has(p.id);
                    return (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        selected={isSel}
                        captainMult={multipliers.captain}
                        talismanMult={multipliers.talisman}
                        silverbackMult={multipliers.silverback}
                        onClick={() => toggle(p)}
                      />
                    );
                  })}
              </div>
            </Card>
          )}
          <Input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Nome squadra"
            className="text-2xl font-bold h-12 mb-4"
          />
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <Input
              placeholder="Cerca giocatore…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="md:max-w-xs"
            />
            <Tabs value={catFilter} onValueChange={setCatFilter}>
              <TabsList>
                <TabsTrigger value="all">Tutti</TabsTrigger>
                {categories.map((c) => (
                  <TabsTrigger key={c.name} value={c.name}>
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-6">
            {ROLE_GROUPS.map((group) => {
              const groupPlayers = players.filter(
                (p) =>
                  (group.roles as readonly string[]).includes(p.role) &&
                  (catFilter === "all" || p.category === catFilter) &&
                  p.full_name.toLowerCase().includes(q.toLowerCase()),
              );
              const count = groupCounts[group.key];
              const required = groupRequired[group.key];
              const incomplete = count !== required;
              const isFull = count >= required;
              return (
                <Card
                  key={group.key}
                  className={cn("p-4 border", showErrors && incomplete && "border-destructive bg-destructive/5")}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">{group.label}</h3>
                    <Badge
                      variant={count === required ? "default" : "outline"}
                      className={cn(showErrors && incomplete && "border-destructive text-destructive")}
                    >
                      {count}/{required}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {groupPlayers.map((p) => {
                      const isSel = selected.has(p.id);
                      const isCap = captain === p.id;
                      const isTal = talisman === p.id;
                      const isSil = silverback === p.id;
                      const disabled = !isSel && isFull;
                      return (
                        <div key={p.id} className="flex flex-col gap-1">
                          <PlayerCard
                            key={p.id}
                            player={p}
                            selected={isSel}
                            captain={isCap}
                            talisman={isTal}
                            silverback={isSil}
                            captainMult={multipliers.captain}
                            talismanMult={multipliers.talisman}
                            silverbackMult={multipliers.silverback}
                            disabled={disabled}
                            onClick={() => toggle(p)}
                            action={
                              isSel ? (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant={isCap ? "default" : "ghost"}
                                    className="h-7 px-2"
                                    title={`Capitano (×${multipliers.captain})`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isTal) return toast.error("Già Talismano");
                                      if (isSil) return toast.error("Già Silverback");
                                      tryChangeRole("captain", captainChangedAt, "Capitano", () =>
                                        setCaptain(isCap ? null : p.id),
                                      );
                                    }}
                                  >
                                    <Crown className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={isTal ? "default" : "ghost"}
                                    className={cn(
                                      "h-7 px-2",
                                      isTal && "bg-fuchsia-500 hover:bg-fuchsia-600 text-white",
                                    )}
                                    title={`Talismano (×${multipliers.talisman})`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isCap) return toast.error("Già Capitano");
                                      if (isSil) return toast.error("Già Silverback");
                                      tryChangeRole("talisman", talismanChangedAt, "Talismano", () =>
                                        setTalisman(isTal ? null : p.id),
                                      );
                                    }}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={isSil ? "default" : "ghost"}
                                    className={cn(
                                      "h-7 px-2",
                                      isSil && "bg-emerald-500 hover:bg-emerald-600 text-white",
                                    )}
                                    title={`Silverback (×${multipliers.silverback})`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isCap) return toast.error("Già Capitano");
                                      if (isTal) return toast.error("Già Talismano");
                                      tryChangeRole("silverback", silverbackChangedAt, "Silverback", () =>
                                        setSilverback(isSil ? null : p.id),
                                      );
                                    }}
                                  >
                                    <span className="text-base leading-none" aria-label="Silverback">
                                      🦍
                                    </span>
                                  </Button>
                                </div>
                              ) : null
                            }
                          />
                          {isSel && playerJoinedMap.get(p.id) && (
                            <div className="text-[10px] text-muted-foreground text-center">
                              In rosa dal {new Date(playerJoinedMap.get(p.id)!).toLocaleDateString("it-IT")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {groupPlayers.length === 0 && (
                      <div className="col-span-full text-sm text-muted-foreground">Nessun giocatore</div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card
            className={cn(
              "p-4 border mt-6",
              showErrors && selectedCoaches.size < coachesRequired && "border-destructive bg-destructive/5",
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold inline-flex items-center gap-2">
                <Megaphone className="h-4 w-4" /> Allenatori
              </h3>
              <Badge
                variant={selectedCoaches.size >= coachesRequired ? "default" : "outline"}
                className={cn(
                  showErrors && selectedCoaches.size < coachesRequired && "border-destructive text-destructive",
                )}
              >
                {selectedCoaches.size} / min {coachesRequired}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {coaches
                .filter((c) => c.full_name.toLowerCase().includes(q.toLowerCase()))
                .map((c) => {
                  const isSel = selectedCoaches.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCoach(c)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-3 transition text-left",
                        isSel ? "border-primary bg-primary/5" : "hover:border-primary/50",
                      )}
                    >
                      <div className="h-12 w-12 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                        {c.photo_url ? (
                          <img src={c.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Megaphone className="h-5 w-5" />
                        )}
                      </div>
                      <div className="text-sm font-medium text-center truncate w-full">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground">{c.category} · Gratis</div>
                    </button>
                  );
                })}
              {coaches.length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground">Nessun allenatore disponibile</div>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">Budget Zaghetti</div>
              <div className="text-2xl font-bold text-primary inline-flex items-center gap-1">
                <ZaghettoIcon /> {remaining}
              </div>
            </div>
            <Progress value={(spent / BUDGET) * 100} className="mt-2" />
            <div className="mt-1 text-xs text-muted-foreground">
              Spesi {spent} / {BUDGET}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">Ruoli</div>
            <div className="space-y-2">
              {ROLE_GROUPS.map((g) => (
                <div key={g.key} className="flex items-center justify-between text-sm">
                  <span>{g.label}</span>
                  <Badge
                    variant={groupCounts[g.key] === groupRequired[g.key] ? "default" : "outline"}
                    className={cn(
                      showErrors &&
                        groupCounts[g.key] !== groupRequired[g.key] &&
                        "border-destructive text-destructive",
                    )}
                  >
                    {groupCounts[g.key]} / {groupRequired[g.key]}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">
              Composizione ({selected.size}/{SQUAD_SIZE})
            </div>
            <div className="space-y-2">
              {categories.map((c) => {
                const min = minPerCategory[c.name] ?? 0;
                const have = counts[c.name] ?? 0;
                return (
                  <div key={c.name} className="flex items-center justify-between text-sm">
                    <span>{c.label}</span>
                    <Badge variant={have >= min ? "default" : "outline"}>
                      {have} / min {min}
                    </Badge>
                  </div>
                );
              })}
              <div className="flex items-center justify-between text-sm">
                <span>Allenatori</span>
                <Badge variant={selectedCoaches.size >= coachesRequired ? "default" : "outline"}>
                  {selectedCoaches.size} / min {coachesRequired}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t">
                <span>Capitano</span>
                <Badge variant={captain ? "default" : "outline"}>{captain ? "✓" : "manca"}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Talismano</span>
                <Badge variant={talisman ? "default" : "outline"}>{talisman ? "✓" : "manca"}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Silverback</span>
                <Badge variant={silverback ? "default" : "outline"}>{silverback ? "✓" : "manca"}</Badge>
              </div>
            </div>
          </Card>
          {!isFirstTimeSquad && transferWindowOpen && !mandatoryWindowOpen && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              🛒 Modifiche di mercato disponibili:{" "}
              <strong>
                {transfersLeft}/{MAX_TRANSFERS_PER_MONTH}
              </strong>{" "}
              questo mese
            </div>
          )}
          {!isFirstTimeSquad && !transferWindowOpen && (
            <Card className="p-3 text-xs text-muted-foreground border-dashed">
              Hai esaurito le modifiche di mercato per questo mese ({MAX_TRANSFERS_PER_MONTH}/{MAX_TRANSFERS_PER_MONTH}
              ). Prossima finestra: <strong>{nextWindow}</strong>. Puoi comunque cambiare Capitano, Talismano e
              Silverback (una volta a settimana).
            </Card>
          )}
          <Card className="p-3 text-xs text-muted-foreground border-dashed">
            Il punteggio include solo i punti maturati da ogni giocatore durante la sua permanenza in rosa.
          </Card>
          <Button className="w-full" size="lg" onClick={save} disabled={saving || !!validation}>
            {saving ? "Salvataggio…" : teamId ? "Aggiorna squadra" : "Salva squadra"}
          </Button>
          {validation && <p className="text-xs text-destructive text-center">{validation}</p>}
        </aside>
      </div>
    </PageShell>
  );
}
