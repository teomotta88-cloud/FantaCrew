import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useCategories } from "@/hooks/useCategories";
import { useAdminPermissions } from "@/contexts/AdminPermissionsContext";
import { useCrew } from "@/contexts/CrewContext";
import { Trash2 } from "lucide-react";

type Row = {
  id: string;
  user_id: string;
  display_name: string | null;
  is_super_admin: boolean;
  allowed_categories: string[] | null;
};

type TMRow = {
  id: string;
  user_id: string;
  category: string;
  display_name: string | null;
};

export function AdminsAdmin() {
  const { categories } = useCategories();
  const { isSuperAdmin, refresh } = useAdminPermissions();
  const { crewId, crewSlug } = useCrew();
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [makeSuper, setMakeSuper] = useState(false);
  const [editing, setEditing] = useState<Record<string, Set<string>>>({});

  const [tms, setTms] = useState<TMRow[]>([]);
  const [tmEmail, setTmEmail] = useState("");
  const [tmCategory, setTmCategory] = useState<string>("");
  const [tmEditing, setTmEditing] = useState<Record<string, string>>({});

  const load = async () => {
    if (!crewId) return;

    // admin_permissions filtered by current crew
    const { data } = await supabase
      .from("admin_permissions")
      .select("*")
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) || []);

    // team_manager_assignments filtered by current crew
    const { data: tmData } = await supabase
      .from("team_manager_assignments" as any)
      .select("id,user_id,category")
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false });
    const list = (tmData as any[]) || [];
    if (list.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in(
          "id",
          list.map((r) => r.user_id),
        );
      const nameById: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        nameById[p.id] = p.display_name;
      });
      setTms(list.map((r) => ({ ...r, display_name: nameById[r.user_id] ?? null })));
    } else {
      setTms([]);
    }
  };

  useEffect(() => {
    load();
  }, [crewId]);

  if (!isSuperAdmin) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">Solo i super admin possono gestire gli amministratori.</Card>
    );
  }

  // Invoke admin-invite with x-crew-slug header so the function knows which crew
  const invokeAdminInvite = async (body: object) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("admin-invite", {
      body,
      headers: { "x-crew-slug": crewSlug },
    });
    return res;
  };

  const invite = async () => {
    if (!email.trim()) return toast.error("Inserisci un'email");
    const { data, error } = await invokeAdminInvite({
      email: email.trim(),
      allowed_categories: makeSuper ? null : Array.from(selected),
      is_super_admin: makeSuper,
    });
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("Admin invitato");
    setEmail("");
    setSelected(new Set());
    setMakeSuper(false);
    load();
    refresh();
  };

  const revoke = async (r: Row) => {
    const supers = rows.filter((x) => x.is_super_admin);
    if (r.is_super_admin && supers.length <= 1) return toast.error("Non puoi rimuovere l'ultimo super admin");
    if (!crewId) return;
    // Remove crew-scoped roles
    await (supabase.from("user_roles").delete().eq("user_id", r.user_id) as any)
      .eq("crew_id", crewId)
      .in("role", ["admin"]);
    await supabase.from("crew_user_roles").delete().eq("user_id", r.user_id).eq("crew_id", crewId);
    await supabase.from("admin_permissions").delete().eq("id", r.id);
    toast.success("Accesso revocato");
    load();
  };

  const saveEdit = async (r: Row) => {
    const cats = Array.from(editing[r.id] || new Set(r.allowed_categories || []));
    const { error } = await supabase.from("admin_permissions").update({ allowed_categories: cats }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Permessi aggiornati");
    load();
    setEditing((e) => {
      const { [r.id]: _, ...rest } = e;
      return rest;
    });
  };

  const inviteTM = async () => {
    if (!tmEmail.trim()) return toast.error("Inserisci un'email");
    if (!tmCategory) return toast.error("Seleziona una categoria");
    const { data, error } = await invokeAdminInvite({
      email: tmEmail.trim(),
      role: "team_manager",
      tm_category: tmCategory,
      allowed_categories: null,
      is_super_admin: false,
    });
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("Team Manager assegnato");
    setTmEmail("");
    setTmCategory("");
    load();
  };

  const updateTMCategory = async (r: TMRow) => {
    const newCat = tmEditing[r.id];
    if (!newCat) return;
    const { error } = await supabase
      .from("team_manager_assignments" as any)
      .update({ category: newCat })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Categoria aggiornata");
    setTmEditing((e) => {
      const { [r.id]: _, ...rest } = e;
      return rest;
    });
    load();
  };

  const revokeTM = async (r: TMRow) => {
    if (!confirm("Revocare l'accesso Team Manager?")) return;
    if (!crewId) return;
    await supabase
      .from("team_manager_assignments" as any)
      .delete()
      .eq("id", r.id);
    await (supabase.from("user_roles").delete().eq("user_id", r.user_id) as any)
      .eq("crew_id", crewId)
      .eq("role", "team_manager");
    toast.success("Accesso revocato");
    load();
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="font-bold mb-3">Invita un nuovo admin</h3>
        <div className="space-y-3">
          <div>
            <Label>Email utente registrato</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={makeSuper} onCheckedChange={setMakeSuper} id="super" />
            <Label htmlFor="super">Super admin (accesso completo)</Label>
          </div>
          {!makeSuper && (
            <div>
              <Label className="mb-2 block">Categorie consentite</Label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.has(c.name)}
                      onCheckedChange={(v) => {
                        const ns = new Set(selected);
                        if (v) ns.add(c.name);
                        else ns.delete(c.name);
                        setSelected(ns);
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <Button onClick={invite}>Invita</Button>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b font-semibold">Amministratori attuali</div>
        <ul className="divide-y">
          {rows.map((r) => {
            const isEditing = editing[r.id] !== undefined;
            const editSet = editing[r.id] || new Set(r.allowed_categories || []);
            return (
              <li key={r.id} className="p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {r.display_name || r.user_id.slice(0, 8)}
                    {r.is_super_admin && <Badge>Super admin</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.is_super_admin ? (
                      "Tutte le categorie"
                    ) : isEditing ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {categories.map((c) => (
                          <label key={c.id} className="flex items-center gap-1">
                            <Checkbox
                              checked={editSet.has(c.name)}
                              onCheckedChange={(v) => {
                                const ns = new Set(editSet);
                                if (v) ns.add(c.name);
                                else ns.delete(c.name);
                                setEditing({ ...editing, [r.id]: ns });
                              }}
                            />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    ) : r.allowed_categories && r.allowed_categories.length > 0 ? (
                      r.allowed_categories.join(", ")
                    ) : (
                      "Nessuna categoria"
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!r.is_super_admin &&
                    (isEditing ? (
                      <>
                        <Button size="sm" onClick={() => saveEdit(r)}>
                          Salva
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditing((e) => {
                              const { [r.id]: _, ...rest } = e;
                              return rest;
                            })
                          }
                        >
                          Annulla
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing({ ...editing, [r.id]: new Set(r.allowed_categories || []) })}
                      >
                        Modifica permessi
                      </Button>
                    ))}
                  <Button size="sm" variant="ghost" onClick={() => revoke(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
          {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nessun admin</li>}
        </ul>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold mb-3">Invita un Team Manager</h3>
        <div className="space-y-3">
          <div>
            <Label>Email utente registrato</Label>
            <Input
              type="email"
              value={tmEmail}
              onChange={(e) => setTmEmail(e.target.value)}
              placeholder="user@email.com"
            />
          </div>
          <div>
            <Label>Categoria assegnata</Label>
            <select
              value={tmCategory}
              onChange={(e) => setTmCategory(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Seleziona…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={inviteTM}>Assegna TM</Button>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b font-semibold">Team Manager</div>
        <ul className="divide-y">
          {tms.map((r) => {
            const isEditing = tmEditing[r.id] !== undefined;
            return (
              <li key={r.id} className="p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{r.display_name || r.user_id.slice(0, 8)}</div>
                  <div className="mt-1">
                    {isEditing ? (
                      <select
                        value={tmEditing[r.id]}
                        onChange={(e) => setTmEditing({ ...tmEditing, [r.id]: e.target.value })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="secondary">{r.category}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={() => updateTMCategory(r)}>
                        Salva
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setTmEditing((e) => {
                            const { [r.id]: _, ...rest } = e;
                            return rest;
                          })
                        }
                      >
                        Annulla
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTmEditing({ ...tmEditing, [r.id]: r.category })}
                    >
                      Modifica categoria
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => revokeTM(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
          {tms.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nessun Team Manager</li>}
        </ul>
      </Card>
    </div>
  );
}
