import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut, Plus, ExternalLink, Trash2, ChevronDown, ChevronUp, UserPlus, Settings2, ArrowUp, ArrowDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { extractDominantColor } from "@/lib/dominantColor";

export const Route = createFileRoute("/superadmin/dashboard")({
  component: SuperAdminDashboard,
  head: () => ({ meta: [{ title: "FantaCrew · Super Admin Dashboard" }] }),
});

type Sport = { id: string; name: string; slug: string; icon: string | null; is_active: boolean };
type Crew = {
  id: string;
  name: string;
  slug: string;
  sport_id: string;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
  owner_user_id?: string | null;
  invite_code?: string | null;
};

type CrewMember = {
  id: string;
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
};

type SportRule = {
  id: string;
  sport_id: string;
  key: string;
  label: string;
  points: number;
  is_malus: boolean;
  sort_order: number;
  applies_to: string;
  is_active: boolean;
  score_type: "bonus" | "malus" | "club";
};

function slugifyKey(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, loading, signOut } = useAuth();
  const [sports, setSports] = useState<Sport[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [sportName, setSportName] = useState("");
  const [sportIcon, setSportIcon] = useState("");
  const [crewName, setCrewName] = useState("");
  const [crewSlug, setCrewSlug] = useState("");
  const [crewSport, setCrewSport] = useState("");
  const [crewColor, setCrewColor] = useState("#1a5d3a");
  const [crewOwnerEmail, setCrewOwnerEmail] = useState("");
  const [crewLogoFile, setCrewLogoFile] = useState<File | null>(null);
  const [crewLogoPreview, setCrewLogoPreview] = useState<string | null>(null);
  const [extractingColor, setExtractingColor] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, CrewMember[]>>({});
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminGlobal, setNewAdminGlobal] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [editingSportId, setEditingSportId] = useState<string | null>(null);
  const [sportRules, setSportRules] = useState<SportRule[]>([]);
  const [editCrew, setEditCrew] = useState<{
    name: string;
    slug: string;
    sport_id: string;
    primary_color: string;
    logo_url: string | null;
    logoFile: File | null;
    logoPreview: string | null;
  } | null>(null);
  const [savingCrew, setSavingCrew] = useState(false);
  const [newRule, setNewRule] = useState<{ label: string; points: number; score_type: SportRule["score_type"]; applies_to: string }>({
    label: "",
    points: 0,
    score_type: "bonus",
    applies_to: "player",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/superadmin", replace: true });
    else if (!isSuperAdmin) navigate({ to: "/superadmin", replace: true });
  }, [user, isSuperAdmin, loading, navigate]);

  const load = async () => {
    const [s, c] = await Promise.all([
      supabase.from("sports").select("*").order("name"),
      supabase.from("crews").select("*").order("name"),
    ]);
    setSports((s.data as Sport[]) || []);
    setCrews((c.data as Crew[]) || []);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  const createSport = async () => {
    if (!sportName) return;
    const slug = sportName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const { error } = await supabase.from("sports").insert({ name: sportName, slug, icon: sportIcon || null });
    if (error) return toast.error(error.message);
    setSportName("");
    setSportIcon("");
    toast.success("Sport creato");
    load();
  };

  const deleteSport = async (id: string) => {
    if (!confirm("Eliminare questo sport?")) return;
    const { error } = await supabase.from("sports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const openSportRules = async (id: string) => {
    if (editingSportId === id) {
      setEditingSportId(null);
      setSportRules([]);
      return;
    }
    setEditingSportId(id);
    const { data, error } = await supabase
      .from("sport_scoring_rules")
      .select("*")
      .eq("sport_id", id)
      .order("sort_order");
    if (error) return toast.error(error.message);
    setSportRules((data as SportRule[]) || []);
  };

  const reloadSportRules = async (id: string) => {
    const { data } = await supabase
      .from("sport_scoring_rules")
      .select("*")
      .eq("sport_id", id)
      .order("sort_order");
    setSportRules((data as SportRule[]) || []);
  };

  const updateSportRule = async (id: string, patch: Partial<SportRule>) => {
    const { error } = await supabase.from("sport_scoring_rules").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    if (editingSportId) reloadSportRules(editingSportId);
  };

  const deleteSportRule = async (id: string) => {
    if (!confirm("Eliminare questa regola preset?")) return;
    const { error } = await supabase.from("sport_scoring_rules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (editingSportId) reloadSportRules(editingSportId);
  };

  const moveSportRule = async (rule: SportRule, dir: -1 | 1) => {
    const sorted = [...sportRules].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((r) => r.id === rule.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await supabase.from("sport_scoring_rules").update({ sort_order: swap.sort_order }).eq("id", rule.id);
    await supabase.from("sport_scoring_rules").update({ sort_order: rule.sort_order }).eq("id", swap.id);
    if (editingSportId) reloadSportRules(editingSportId);
  };

  const createSportRule = async () => {
    if (!editingSportId) return;
    if (!newRule.label.trim()) return toast.error("Label richiesta");
    const key = slugifyKey(newRule.label);
    if (!key) return toast.error("Key non valida");
    const maxOrder = sportRules.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const score_type: SportRule["score_type"] = newRule.points < 0 ? "malus" : newRule.score_type;
    const { error } = await supabase.from("sport_scoring_rules").insert({
      sport_id: editingSportId,
      key,
      label: newRule.label.trim(),
      points: newRule.points,
      is_malus: score_type === "malus",
      score_type,
      applies_to: newRule.applies_to,
      sort_order: maxOrder + 10,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    setNewRule({ label: "", points: 0, score_type: "bonus", applies_to: "player" });
    reloadSportRules(editingSportId);
  };

  const createCrew = async () => {
    if (!crewName || !crewSlug || !crewSport) {
      toast.error("Compila nome, slug e sport");
      return;
    }
    const slug = crewSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let logoUrl: string | null = null;
    if (crewLogoFile) {
      const ext = (crewLogoFile.name.split(".").pop() || "png").toLowerCase();
      const path = `crews/${slug}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, crewLogoFile, { upsert: true, contentType: crewLogoFile.type || "image/png" });
      if (upErr) return toast.error("Upload logo: " + upErr.message);
      logoUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }

    const { data: inserted, error } = await supabase.from("crews").insert({
      name: crewName,
      slug,
      sport_id: crewSport,
      primary_color: crewColor,
      logo_url: logoUrl,
    } as any).select("id").single();
    if (error) return toast.error(error.message);
    if (crewOwnerEmail && inserted?.id) {
      const { error: ownErr } = await supabase.functions.invoke("crew-manage", {
        body: { action: "assign_owner", crew_id: inserted.id, email: crewOwnerEmail },
      });
      if (ownErr) toast.error("Team creato, ma owner non assegnato: " + ownErr.message);
    }
    setCrewName("");
    setCrewSlug("");
    setCrewOwnerEmail("");
    setCrewLogoFile(null);
    setCrewLogoPreview(null);
    toast.success("Team creato");
    load();
  };

  const onLogoSelected = async (file: File | null) => {
    setCrewLogoFile(file);
    if (!file) {
      setCrewLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setCrewLogoPreview(url);
    setExtractingColor(true);
    try {
      const color = await extractDominantColor(url);
      if (color) {
        setCrewColor(color);
        toast.success(`Colore principale rilevato: ${color}`);
      }
    } finally {
      setExtractingColor(false);
    }
  };

  const deleteCrew = async (id: string) => {
    if (!confirm("Eliminare questo team? Tutti i dati associati restano ma diventano orfani.")) return;
    const { error } = await supabase.from("crews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const loadMembers = async (crewId: string) => {
    const { data, error } = await supabase.functions.invoke("crew-manage", {
      body: { action: "list_members", crew_id: crewId },
    });
    if (error) return toast.error(error.message);
    setMembers((m) => ({ ...m, [crewId]: (data as any)?.members || [] }));
  };

  const toggleExpand = async (crewId: string) => {
    if (expanded === crewId) {
      setExpanded(null);
      setEditCrew(null);
    } else {
      setExpanded(crewId);
      if (!members[crewId]) await loadMembers(crewId);
      const c = crews.find((x) => x.id === crewId);
      if (c) {
        setEditCrew({
          name: c.name,
          slug: c.slug,
          sport_id: c.sport_id,
          primary_color: c.primary_color || "#1a5d3a",
          logo_url: c.logo_url,
          logoFile: null,
          logoPreview: null,
        });
      }
    }
    setNewAdminEmail("");
    setNewOwnerEmail("");
    setNewAdminGlobal(false);
  };

  const onEditLogoSelected = async (file: File | null) => {
    if (!editCrew) return;
    if (!file) {
      setEditCrew({ ...editCrew, logoFile: null, logoPreview: null });
      return;
    }
    const url = URL.createObjectURL(file);
    setEditCrew({ ...editCrew, logoFile: file, logoPreview: url });
    try {
      const color = await extractDominantColor(url);
      if (color) {
        setEditCrew((prev) => (prev ? { ...prev, logoFile: file, logoPreview: url, primary_color: color } : prev));
        toast.success(`Colore principale rilevato: ${color}`);
      }
    } catch {}
  };

  const saveCrewEdits = async (crewId: string) => {
    if (!editCrew) return;
    setSavingCrew(true);
    try {
      const slug = editCrew.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      let logoUrl = editCrew.logo_url;
      if (editCrew.logoFile) {
        const ext = (editCrew.logoFile.name.split(".").pop() || "png").toLowerCase();
        const path = `crews/${slug}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, editCrew.logoFile, { upsert: true, contentType: editCrew.logoFile.type || "image/png" });
        if (upErr) {
          toast.error("Upload logo: " + upErr.message);
          return;
        }
        logoUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase
        .from("crews")
        .update({
          name: editCrew.name,
          slug,
          sport_id: editCrew.sport_id,
          primary_color: editCrew.primary_color,
          logo_url: logoUrl,
        })
        .eq("id", crewId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Team aggiornato");
      await load();
      setEditCrew((prev) => (prev ? { ...prev, slug, logo_url: logoUrl, logoFile: null, logoPreview: null } : prev));
    } finally {
      setSavingCrew(false);
    }
  };

  const addAdmin = async (crewId: string) => {
    if (!newAdminEmail) return;
    const { error } = await supabase.functions.invoke("crew-manage", {
      body: { action: "add_admin", crew_id: crewId, email: newAdminEmail, is_global_admin: newAdminGlobal },
    });
    if (error) return toast.error(error.message);
    toast.success("Admin aggiunto");
    setNewAdminEmail("");
    setNewAdminGlobal(false);
    loadMembers(crewId);
  };

  const removeAdmin = async (crewId: string, userId: string) => {
    if (!confirm("Rimuovere questo admin dalla crew?")) return;
    const { error } = await supabase.functions.invoke("crew-manage", {
      body: { action: "remove_admin", crew_id: crewId, user_id: userId },
    });
    if (error) return toast.error(error.message);
    loadMembers(crewId);
  };

  const assignOwner = async (crewId: string) => {
    if (!newOwnerEmail) return;
    const { error } = await supabase.functions.invoke("crew-manage", {
      body: { action: "assign_owner", crew_id: crewId, email: newOwnerEmail },
    });
    if (error) return toast.error(error.message);
    toast.success("Owner assegnato");
    setNewOwnerEmail("");
    load();
    loadMembers(crewId);
  };

  if (loading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">FantaCrew · Super Admin</h1>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate({ to: "/superadmin" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Esci
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-bold mb-3">Sport</h2>
          <Card className="p-4 mb-4">
            <div className="flex gap-2 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
                <Label>Nome</Label>
                <Input value={sportName} onChange={(e) => setSportName(e.target.value)} placeholder="Calcio" />
              </div>
              <div className="w-32">
                <Label>Icona</Label>
                <Input value={sportIcon} onChange={(e) => setSportIcon(e.target.value)} placeholder="⚽" />
              </div>
              <Button onClick={createSport}>
                <Plus className="h-4 w-4 mr-1" /> Aggiungi
              </Button>
            </div>
          </Card>
          <div className="grid gap-2">
            {sports.map((s) => (
              <Card key={s.id} className="p-3">
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center text-left flex-1 hover:opacity-80"
                    onClick={() => openSportRules(s.id)}
                  >
                    <span className="text-2xl mr-2">{s.icon}</span>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">/{s.slug}</span>
                    <Settings2 className="h-4 w-4 ml-2 text-muted-foreground" />
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => deleteSport(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {editingSportId === s.id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="text-sm font-semibold">Punteggi standard preimpostati</div>
                    <p className="text-xs text-muted-foreground">
                      Queste regole vengono copiate automaticamente in ogni nuovo team creato per questo sport.
                    </p>
                    <ul className="divide-y border rounded-md">
                      {sportRules.length === 0 && (
                        <li className="p-3 text-xs text-muted-foreground">Nessuna regola preimpostata.</li>
                      )}
                      {sportRules.map((r, idx) => (
                        <li key={r.id} className="flex flex-col md:flex-row md:items-center gap-2 p-2">
                          <Input
                            defaultValue={r.label}
                            className="flex-1"
                            onBlur={(e) =>
                              e.target.value !== r.label && updateSportRule(r.id, { label: e.target.value })
                            }
                          />
                          <Input
                            type="number"
                            defaultValue={r.points}
                            className="w-24"
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== r.points) updateSportRule(r.id, { points: v });
                            }}
                          />
                          <Select
                            value={r.score_type}
                            onValueChange={(v) =>
                              updateSportRule(r.id, { score_type: v as SportRule["score_type"], is_malus: v === "malus" })
                            }
                          >
                            <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bonus">Bonus</SelectItem>
                              <SelectItem value="malus">Malus</SelectItem>
                              <SelectItem value="club">Club</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={r.applies_to} onValueChange={(v) => updateSportRule(r.id, { applies_to: v })}>
                            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="player">Giocatore</SelectItem>
                              <SelectItem value="coach">Allenatore</SelectItem>
                              <SelectItem value="both">Entrambi</SelectItem>
                              <SelectItem value="team">Team</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={idx === 0}
                              onClick={() => moveSportRule(r, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={idx === sportRules.length - 1}
                              onClick={() => moveSportRule(r, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={r.is_active}
                              onCheckedChange={(v) => updateSportRule(r.id, { is_active: v })}
                            />
                            <Button size="icon" variant="ghost" onClick={() => deleteSportRule(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="bg-muted/30 rounded-md p-3 space-y-2">
                      <div className="text-xs font-semibold">Nuova regola preset</div>
                      <div className="grid md:grid-cols-4 gap-2">
                        <Input
                          placeholder="Label"
                          value={newRule.label}
                          onChange={(e) => setNewRule({ ...newRule, label: e.target.value })}
                        />
                        <Input
                          type="number"
                          placeholder="Punti"
                          value={newRule.points}
                          onChange={(e) => setNewRule({ ...newRule, points: Number(e.target.value) })}
                        />
                        <Select
                          value={newRule.score_type}
                          onValueChange={(v) => setNewRule({ ...newRule, score_type: v as SportRule["score_type"] })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bonus">Bonus</SelectItem>
                            <SelectItem value="malus">Malus</SelectItem>
                            <SelectItem value="club">Club</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={newRule.applies_to}
                          onValueChange={(v) => setNewRule({ ...newRule, applies_to: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="player">Giocatore</SelectItem>
                            <SelectItem value="coach">Allenatore</SelectItem>
                            <SelectItem value="both">Entrambi</SelectItem>
                            <SelectItem value="team">Team</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" onClick={createSportRule}>
                        <Plus className="h-4 w-4 mr-1" /> Aggiungi regola
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-3">Team della piattaforma</h2>
          <Card className="p-4 mb-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Nome team</Label>
                <Input value={crewName} onChange={(e) => setCrewName(e.target.value)} placeholder="Milano Rugby" />
              </div>
              <div>
                <Label>Slug URL</Label>
                <Input
                  value={crewSlug}
                  onChange={(e) => setCrewSlug(e.target.value)}
                  placeholder="milano-rugby"
                />
              </div>
              <div>
                <Label>Sport</Label>
                <Select value={crewSport} onValueChange={setCrewSport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Scegli lo sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {sports.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.icon} {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Colore primario</Label>
                <Input type="color" value={crewColor} onChange={(e) => setCrewColor(e.target.value)} />
                {extractingColor && (
                  <p className="text-xs text-muted-foreground mt-1">Rilevo il colore dal logo…</p>
                )}
              </div>
              <div className="md:col-span-2">
                <Label>Logo team</Label>
                <div className="flex items-center gap-3 mt-1">
                  {crewLogoPreview && (
                    <img
                      src={crewLogoPreview}
                      alt="Anteprima logo"
                      className="h-16 w-16 rounded-md object-cover border"
                    />
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onLogoSelected(e.target.files?.[0] ?? null)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Il colore principale viene rilevato automaticamente dal logo.
                </p>
              </div>
              <div className="md:col-span-2">
                <Label>Email owner (opzionale)</Label>
                <Input
                  value={crewOwnerEmail}
                  onChange={(e) => setCrewOwnerEmail(e.target.value)}
                  placeholder="owner@example.com — l'utente deve essersi già registrato"
                />
              </div>
            </div>
            <Button onClick={createCrew} className="mt-3">
              <Plus className="h-4 w-4 mr-1" /> Crea team
            </Button>
          </Card>

          <div className="grid gap-2">
            {crews.map((c) => {
              const sport = sports.find((s) => s.id === c.sport_id);
              const isOpen = expanded === c.id;
              const crewMembers = members[c.id] || [];
              return (
                <Card key={c.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-md flex items-center justify-center text-white font-bold"
                        style={{ background: c.primary_color || "#1a5d3a" }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          /{c.slug} · {sport?.name || "?"}
                          {c.owner_user_id ? " · owner ✓" : " · senza owner"}
                        </div>
                        {c.invite_code && (
                          <div className="text-xs mt-1">
                            Codice invito:{" "}
                            <button
                              type="button"
                              className="font-mono font-bold text-primary hover:underline"
                              onClick={() => {
                                navigator.clipboard?.writeText(c.invite_code!);
                                toast.success("Codice copiato");
                              }}
                            >
                              {c.invite_code}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(c.id)}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/$crewSlug" params={{ crewSlug: c.slug }}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteCrew(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      {editCrew && (
                        <div className="space-y-3">
                          <Label className="text-xs">Info team</Label>
                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Nome</Label>
                              <Input
                                value={editCrew.name}
                                onChange={(e) => setEditCrew({ ...editCrew, name: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Slug URL</Label>
                              <Input
                                value={editCrew.slug}
                                onChange={(e) => setEditCrew({ ...editCrew, slug: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Sport</Label>
                              <Select
                                value={editCrew.sport_id}
                                onValueChange={(v) => setEditCrew({ ...editCrew, sport_id: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {sports.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.icon} {s.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Colore primario</Label>
                              <Input
                                type="color"
                                value={editCrew.primary_color}
                                onChange={(e) => setEditCrew({ ...editCrew, primary_color: e.target.value })}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-xs">Logo team</Label>
                              <div className="flex items-center gap-3 mt-1">
                                {(editCrew.logoPreview || editCrew.logo_url) && (
                                  <img
                                    src={editCrew.logoPreview || editCrew.logo_url || ""}
                                    alt="Logo"
                                    className="h-16 w-16 rounded-md object-cover border"
                                  />
                                )}
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => onEditLogoSelected(e.target.files?.[0] ?? null)}
                                />
                              </div>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => saveCrewEdits(c.id)} disabled={savingCrew}>
                            {savingCrew ? "Salvataggio…" : "Salva modifiche"}
                          </Button>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Cambia owner</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={newOwnerEmail}
                            onChange={(e) => setNewOwnerEmail(e.target.value)}
                            placeholder="email@example.com"
                          />
                          <Button size="sm" onClick={() => assignOwner(c.id)}>
                            Assegna
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Admin della crew</Label>
                        <div className="grid gap-1 mt-1">
                          {crewMembers.filter((m) => m.role === "admin").map((m) => (
                            <div key={m.id} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1">
                              <span>{m.display_name || m.email || m.user_id}</span>
                              <Button variant="ghost" size="sm" onClick={() => removeAdmin(c.id, m.user_id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          {crewMembers.filter((m) => m.role === "admin").length === 0 && (
                            <p className="text-xs text-muted-foreground">Nessun admin assegnato.</p>
                          )}
                        </div>
                        <div className="flex gap-2 mt-2 items-center">
                          <Input
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            placeholder="email@example.com"
                          />
                          <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={newAdminGlobal}
                              onChange={(e) => setNewAdminGlobal(e.target.checked)}
                            />
                            accesso /admin
                          </label>
                          <Button size="sm" onClick={() => addAdmin(c.id)}>
                            <UserPlus className="h-4 w-4 mr-1" /> Aggiungi
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
