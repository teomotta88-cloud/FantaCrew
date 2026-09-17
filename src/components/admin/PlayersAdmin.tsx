import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLES } from "@/lib/constants";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ZaghettoIcon } from "@/components/ZaghettoIcon";
import { ImageCropper, readFileAsDataURL } from "@/components/ImageCropper";

import { useCrew } from "@/contexts/CrewContext";
type Player = {
  id: string;
  full_name: string;
  photo_url: string | null;
  category: string;
  role: string;
  weight_kg: number | null;
  height_cm: number | null;
  value_zaghetti: number;
};

const empty = { full_name: "", category: "Seniores" as any, role: "", weight_kg: "", height_cm: "", value_zaghetti: 5 };

export function PlayersAdmin() {
  const { crewSlug } = useCrew();
  const { categories } = useCategories({ activeOnly: true });
  const [players, setPlayers] = useState<Player[]>([]);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "report">("cards");

  const load = async () => {
    const { data } = await supabase.from("players").select("*").order("full_name");
    setPlayers(data || []);
  };
  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditing(null);
    setForm(empty);
    setPhoto(null);
    setPhotoPreview(null);
    setOpen(true);
  };
  const startEdit = (p: Player) => {
    setEditing(p);
    setForm({ ...p, weight_kg: p.weight_kg ?? "", height_cm: p.height_cm ?? "" });
    setPhoto(null);
    setPhotoPreview(p.photo_url);
    setOpen(true);
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFileAsDataURL(file);
    setCropSrc(data);
    e.target.value = "";
  };

  const onCropConfirm = (blob: Blob) => {
    setCropSrc(null);
    const file = new File([blob], `player-${Date.now()}.jpg`, { type: "image/jpeg" });
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(blob));
  };

  const save = async () => {
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return toast.error("Devi accedere come admin per salvare un giocatore.");
      const data = new FormData();
      if (editing?.id) data.append("id", editing.id);
      data.append("full_name", form.full_name);
      data.append("category", form.category);
      data.append("role", form.role);
      data.append("weight_kg", String(form.weight_kg || ""));
      data.append("height_cm", String(form.height_cm || ""));
      data.append("value_zaghetti", String(form.value_zaghetti || 5));
      data.append("existing_photo_url", editing?.photo_url ?? "");
      if (photo) data.append("photo", photo);
      const res = await fetch("/api/public/admin/players", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "x-crew-slug": crewSlug },
        body: data,
      });
      const result = await res.json();
      if (!res.ok) return toast.error(result.error || "Errore salvataggio giocatore");
      toast.success("Salvato");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare giocatore?")) return;
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato");
    load();
  };

  const filteredPlayers = categoryFilter === "all" ? players : players.filter((p) => p.category === categoryFilter);

  return (
    <div>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold">Giocatori ({players.length})</h2>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "cards" | "report")}>
            <TabsList className="h-8">
              <TabsTrigger value="cards" className="text-xs px-2">
                Schede
              </TabsTrigger>
              <TabsTrigger value="report" className="text-xs px-2">
                Report
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {viewMode === "report" && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.label || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startNew}>
              <Plus className="h-4 w-4 mr-1" /> Nuovo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica" : "Nuovo"} giocatore</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome completo</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ruolo</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli ruolo" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Peso (kg)</Label>
                  <Input
                    type="number"
                    value={form.weight_kg}
                    onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Altezza (cm)</Label>
                  <Input
                    type="number"
                    value={form.height_cm}
                    onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="inline-flex items-center gap-1">
                    Zaghetti <ZaghettoIcon />
                  </Label>
                  <Input
                    type="number"
                    value={form.value_zaghetti}
                    onChange={(e) => setForm({ ...form, value_zaghetti: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Foto</Label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="h-16 w-16 rounded-md bg-secondary overflow-hidden flex items-center justify-center">
                    {photoPreview ? (
                      <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Nessuna</span>
                    )}
                  </div>
                  <Input type="file" accept="image/*" onChange={onPickPhoto} className="flex-1" />
                </div>
              </div>
              <Button onClick={save} className="w-full" disabled={saving}>
                {saving ? "Salvataggio…" : "Salva"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ImageCropper
        open={!!cropSrc}
        src={cropSrc}
        aspect={1}
        cropShape="rect"
        title="Ritaglia foto giocatore"
        onCancel={() => setCropSrc(null)}
        onConfirm={onCropConfirm}
      />

      {/* Report view */}
      {viewMode === "report" && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead className="text-right">Zaghetti</TableHead>
                <TableHead className="text-right">Report</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nessun giocatore in questa categoria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPlayers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {p.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.role}</TableCell>
                    <TableCell className="text-right font-semibold">{p.value_zaghetti}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild title="Vedi report">
                        <Link to="/$crewSlug/player/$id" params={{ crewSlug, id: p.id }}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Cards view */}
      {viewMode === "cards" && (
        <Card>
          <ul className="divide-y">
            {players.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-lg flex-shrink-0">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ZaghettoIcon className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    {p.category} · {p.role} · <ZaghettoIcon /> {p.value_zaghetti}
                  </div>
                </div>
                <Button size="sm" variant="ghost" asChild title="Vedi report">
                  <Link to="/$crewSlug/player/$id" params={{ crewSlug, id: p.id }}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
