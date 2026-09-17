import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Megaphone } from "lucide-react";
import { ImageCropper, readFileAsDataURL } from "@/components/ImageCropper";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type Coach = { id: string; full_name: string; photo_url: string | null; category: string };

const empty = { full_name: "", category: "Seniores" as any };

export function CoachesAdmin() {
  const { categories } = useCategories({ activeOnly: true });
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("coaches").select("*").order("full_name");
    setCoaches((data as Coach[]) || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setForm(empty); setPhoto(null); setPhotoPreview(null); setOpen(true); };
  const startEdit = (c: Coach) => { setEditing(c); setForm({ ...c }); setPhoto(null); setPhotoPreview(c.photo_url); setOpen(true); };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await readFileAsDataURL(file);
    setCropSrc(data);
    e.target.value = "";
  };

  const onCropConfirm = (blob: Blob) => {
    setCropSrc(null);
    const file = new File([blob], `coach-${Date.now()}.jpg`, { type: "image/jpeg" });
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(blob));
  };

  const save = async () => {
    if (!form.full_name.trim()) return toast.error("Inserisci il nome");
    setSaving(true);
    try {
      let photo_url = editing?.photo_url ?? null;
      if (photo) {
        const path = `coach-${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("player-photos").upload(path, photo, { upsert: true, contentType: "image/jpeg" });
        if (upErr) return toast.error(upErr.message);
        photo_url = supabase.storage.from("player-photos").getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        full_name: form.full_name.trim(),
        category: form.category,
        photo_url,
      };
      const { error } = editing
        ? await supabase.from("coaches").update(payload).eq("id", editing.id)
        : await supabase.from("coaches").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Salvato"); setOpen(false); load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare allenatore?")) return;
    const { error } = await supabase.from("coaches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato"); load();
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Allenatori ({coaches.length})</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Nuovo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica" : "Nuovo"} allenatore</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div>
                <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.name} value={c.name}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
              </div>
              <div>
                <Label>Foto</Label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="h-16 w-16 rounded-md bg-secondary overflow-hidden flex items-center justify-center">
                    {photoPreview ? <img src={photoPreview} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Nessuna</span>}
                  </div>
                  <Input type="file" accept="image/*" onChange={onPickPhoto} className="flex-1" />
                </div>
              </div>
              <Button onClick={save} className="w-full" disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ImageCropper open={!!cropSrc} src={cropSrc} aspect={1} cropShape="rect" title="Ritaglia foto allenatore" onCancel={() => setCropSrc(null)} onConfirm={onCropConfirm} />
      <Card>
        <ul className="divide-y">
          {coaches.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-lg">
                {c.photo_url ? <img src={c.photo_url} alt="" className="h-full w-full object-cover" /> : <Megaphone className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.full_name}</div>
                <div className="text-xs text-muted-foreground">{c.category} · Gratis</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
          {coaches.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nessun allenatore</li>}
        </ul>
      </Card>
    </div>
  );
}