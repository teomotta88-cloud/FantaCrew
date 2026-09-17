import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { SEASON } from "@/lib/constants";
import { useSeason } from "@/contexts/SeasonContext";
import { Upload } from "lucide-react";
import { ImageCropper, readFileAsDataURL } from "@/components/ImageCropper";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { Bell, BellOff } from "lucide-react";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/$crewSlug/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profilo — Fanta Lambro" }] }),
});

function ProfilePage() {
  const { user, loading, profile, refreshProfile } = useAuth();
  const push = usePushSubscription();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [matchingPlayers, setMatchingPlayers] = useState<
    { id: string; full_name: string; category: string; role: string }[]
  >([]);
  const [claimedPlayer, setClaimedPlayer] = useState<{
    id: string;
    full_name: string;
    category: string;
    role: string;
  } | null>(null);
  const [matchingCoaches, setMatchingCoaches] = useState<{ id: string; full_name: string; category: string }[]>([]);
  const [claimedCoach, setClaimedCoach] = useState<{ id: string; full_name: string; category: string } | null>(null);
  const { seasonId } = useSeason();
  const [playerEvents, setPlayerEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [missingSlots, setMissingSlots] = useState<{ id: string; title: string; ends_at: string }[]>([]);
  const [penalties, setPenalties] = useState<
    { id: string; mandatory_slot_id: string | null; points: number; reason: string }[]
  >([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const teamQ = supabase.from("teams").select("id,name").eq("manager_id", user.id);
    (seasonId ? teamQ.eq("season_id", seasonId) : teamQ.eq("season", SEASON)).maybeSingle().then(({ data }) => {
      if (data) {
        setTeamId(data.id);
        setTeamName(data.name);
      }
    });
  }, [user, seasonId]);

  useEffect(() => {
    if (!teamId) {
      setMissingSlots([]);
      setPenalties([]);
      return;
    }
    (async () => {
      const { data: slots } = await supabase
        .from("mandatory_slots")
        .select("id,title,eligible_player_ids,starts_at,ends_at")
        .gte("ends_at", new Date().toISOString());
      const { data: tp } = await supabase.from("team_players").select("player_id").eq("team_id", teamId);
      const ids = new Set((tp || []).map((r: any) => r.player_id));
      const now = Date.now();
      const active = ((slots as any[]) || []).filter((s) => new Date(s.starts_at).getTime() <= now);
      setMissingSlots(
        active
          .filter((s) => !(s.eligible_player_ids || []).some((pid: string) => ids.has(pid)))
          .map((s) => ({ id: s.id, title: s.title, ends_at: s.ends_at })),
      );
      const { data: pen } = await supabase
        .from("team_penalties")
        .select("id,mandatory_slot_id,points,reason")
        .eq("team_id", teamId);
      setPenalties((pen as any) || []);
    })();
  }, [teamId]);

  const fmtEnd = (iso: string) =>
    new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const reloadPlayerLink = async () => {
    if (!user || !profile?.display_name) return;
    const { data: claimed } = await supabase
      .from("players")
      .select("id,full_name,category,role")
      .eq("user_id", user.id)
      .maybeSingle();
    setClaimedPlayer(claimed ?? null);
    const target = profile.display_name.trim().toLowerCase();
    if (claimed) {
      setMatchingPlayers([]);
    } else {
      const { data: candidates } = await supabase
        .from("players")
        .select("id,full_name,category,role,user_id")
        .is("user_id", null);
      setMatchingPlayers((candidates || []).filter((p) => p.full_name.trim().toLowerCase() === target));
    }
    const { data: claimedC } = await supabase
      .from("coaches")
      .select("id,full_name,category")
      .eq("user_id", user.id)
      .maybeSingle();
    setClaimedCoach(claimedC ?? null);
    if (claimedC) {
      setMatchingCoaches([]);
      return;
    }
    const { data: cand } = await supabase.from("coaches").select("id,full_name,category,user_id").is("user_id", null);
    setMatchingCoaches((cand || []).filter((c) => c.full_name.trim().toLowerCase() === target));
  };

  useEffect(() => {
    reloadPlayerLink();
  }, [user, profile?.display_name]);

  useEffect(() => {
    if (!claimedPlayer || !seasonId) {
      setPlayerEvents([]);
      return;
    }
    setLoadingEvents(true);
    (async () => {
      const { data: we } = await supabase
        .from("weekly_events")
        .select("id,week,created_at,quantity,rule_key,scoring_rules(label,points,is_malus,key)")
        .eq("player_id", claimedPlayer.id)
        .eq("season_id", seasonId);
      const { data: sac } = await supabase
        .from("special_action_completions")
        .select("id,created_at,action_id,special_actions(title,points,week,season_id)")
        .eq("player_id", claimedPlayer.id);
      const actionCounts: Record<string, number> = {};
      (sac || []).forEach((s: any) => {
        actionCounts[s.action_id] = (actionCounts[s.action_id] ?? 0) + 1;
      });
      const weNorm = ((we || []) as any[]).map((e) => ({
        id: e.id,
        week: e.week,
        event_date: e.created_at,
        event_label: e.scoring_rules?.label ?? e.rule_key,
        event_key: e.scoring_rules?.key ?? e.rule_key,
        is_malus: e.scoring_rules?.is_malus ?? false,
        points: (e.scoring_rules?.points ?? 0) * (e.quantity ?? 1),
        source: "weekly_event",
      }));
      const sacNorm = ((sac || []) as any[])
        .filter((s: any) => s.special_actions?.season_id === seasonId)
        .map((s: any) => {
          const dup = (actionCounts[s.action_id] ?? 1) > 1;
          return {
            id: s.id,
            week: s.special_actions?.week ?? 0,
            event_date: s.created_at,
            event_label: s.special_actions?.title ?? "Azione speciale",
            event_key: "special_action",
            is_malus: dup,
            points: dup ? -(s.special_actions?.points ?? 0) : (s.special_actions?.points ?? 0),
            source: "special_action",
          };
        });
      const all = [...weNorm, ...sacNorm].sort(
        (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
      );
      setPlayerEvents(all);
      setLoadingEvents(false);
    })();
  }, [claimedPlayer?.id, seasonId]);

  const claimPlayer = async (playerId: string) => {
    if (!user) return;
    const { error } = await supabase.from("players").update({ user_id: user.id }).eq("id", playerId);
    if (error) return toast.error(error.message);
    toast.success("Sei stato collegato al giocatore");
    reloadPlayerLink();
  };

  const releasePlayer = async () => {
    if (!user || !claimedPlayer) return;
    const { error } = await supabase.from("players").update({ user_id: null }).eq("id", claimedPlayer.id);
    if (error) return toast.error(error.message);
    toast.success("Collegamento rimosso");
    reloadPlayerLink();
  };

  const claimCoach = async (coachId: string) => {
    if (!user) return;
    const { error } = await supabase.from("coaches").update({ user_id: user.id }).eq("id", coachId);
    if (error) return toast.error(error.message);
    toast.success("Sei stato collegato all'allenatore");
    reloadPlayerLink();
  };

  const releaseCoach = async () => {
    if (!user || !claimedCoach) return;
    const { error } = await supabase.from("coaches").update({ user_id: null }).eq("id", claimedCoach.id);
    if (error) return toast.error(error.message);
    toast.success("Collegamento rimosso");
    reloadPlayerLink();
  };

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFileAsDataURL(file);
    setCropSrc(data);
    e.target.value = "";
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!user) return;
    setCropSrc(null);
    setUploading(true);
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    setUploading(false);
    toast.success("Foto caricata, ricordati di salvare");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName.trim() || user.email!.split("@")[0],
      avatar_url: avatarUrl,
    });
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    if (teamId && teamName.trim()) {
      const { error: te } = await supabase.from("teams").update({ name: teamName.trim() }).eq("id", teamId);
      if (te) {
        setSaving(false);
        return toast.error(te.message);
      }
    }
    await refreshProfile();
    setSaving(false);
    toast.success("Profilo aggiornato");
  };

  const initials = (displayName || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Il tuo profilo</h1>

        {missingSlots.length > 0 && (
          <Card className="p-4 border-destructive/50 bg-destructive/5 space-y-1">
            {missingSlots.map((s) => (
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
        {penalties.filter((p) => p.mandatory_slot_id !== null).length > 0 && (
          <Card className="p-4 border-destructive bg-destructive/10 space-y-1">
            {penalties
              .filter((p) => p.mandatory_slot_id !== null)
              .map((p) => (
                <div key={p.id} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>
                    ❌ Penalità applicata: <strong>{p.points} punti</strong> — {p.reason}
                  </span>
                </div>
              ))}
          </Card>
        )}

        <Card className="p-6 space-y-5">
          <h2 className="font-semibold text-lg">Account</h2>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-2" /> {uploading ? "Caricamento…" : "Cambia foto"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">JPG o PNG, max 2MB consigliato</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome utente</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Il tuo nome da fanta-allenatore"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">L'email non è modificabile da qui</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-lg">La tua squadra</h2>
          {teamId ? (
            <div className="space-y-2">
              <Label>Nome squadra</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Non hai ancora creato una squadra. Vai in{" "}
              <a className="text-primary underline" href="/team">
                La mia squadra
              </a>{" "}
              per crearne una.
            </p>
          )}
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-semibold text-lg inline-flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifiche push
          </h2>
          {!push.supported ? (
            <p className="text-sm text-muted-foreground">Il tuo browser non supporta le notifiche push.</p>
          ) : push.permission === "denied" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Notifiche disattivate</p>
              <p className="text-xs text-muted-foreground">
                Hai bloccato le notifiche dal browser. Per riattivarle apri le impostazioni del sito (l'icona del
                lucchetto vicino all'URL) → Notifiche → Consenti, poi ricarica la pagina.
              </p>
            </div>
          ) : push.subscribed ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Notifiche attive ✓</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => push.unsubscribe().then(() => toast.success("Notifiche disattivate"))}
                disabled={push.busy}
              >
                <BellOff className="h-4 w-4 mr-1" /> Disattiva
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Notifiche disattivate. Ricevi aggiornamenti su mercato, classifica e azioni speciali.
              </p>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const ok = await push.subscribe();
                    ok ? toast.success("Attivate") : toast.error("Permesso negato");
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
                disabled={push.busy}
              >
                <Bell className="h-4 w-4 mr-1" /> Attiva
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-lg">Sei un giocatore?</h2>
          {claimedPlayer ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {claimedPlayer.full_name}
                  <Badge variant="secondary">
                    {claimedPlayer.category} · {claimedPlayer.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Sei collegato a questo giocatore.</p>
              </div>
              <Button variant="outline" size="sm" onClick={releasePlayer}>
                Rimuovi collegamento
              </Button>
            </div>
          ) : matchingPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun giocatore corrisponde al tuo nome utente. Aggiorna il nome utente con il tuo nome e cognome esatto
              come compare nella rosa.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">Abbiamo trovato un giocatore con il tuo nome:</p>
              {matchingPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.category} · {p.role}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => claimPlayer(p.id)}>
                    Sei tu questo giocatore?
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-lg">Sei un allenatore?</h2>
          {claimedCoach ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {claimedCoach.full_name}
                  <Badge variant="secondary">{claimedCoach.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Sei collegato a questo allenatore.</p>
              </div>
              <Button variant="outline" size="sm" onClick={releaseCoach}>
                Rimuovi collegamento
              </Button>
            </div>
          ) : matchingCoaches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun allenatore corrisponde al tuo nome utente.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">Abbiamo trovato un allenatore con il tuo nome:</p>
              {matchingCoaches.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">{c.category}</div>
                  </div>
                  <Button size="sm" onClick={() => claimCoach(c.id)}>
                    Sei tu questo allenatore?
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={save} disabled={saving}>
            {saving ? "Salvataggio…" : "Salva modifiche"}
          </Button>
        </div>
      </div>
      <ImageCropper
        open={!!cropSrc}
        src={cropSrc}
        aspect={1}
        cropShape="round"
        title="Ritaglia foto profilo"
        onCancel={() => setCropSrc(null)}
        onConfirm={handleCropConfirm}
      />
    </PageShell>
  );
}
