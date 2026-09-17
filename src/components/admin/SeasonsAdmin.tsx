import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSeason } from "@/contexts/SeasonContext";

import { useCrew } from "@/contexts/CrewContext";
type Season = {
  id: string; name: string; starts_at: string; ends_at: string;
  is_active: boolean; is_archived: boolean;
};

export function SeasonsAdmin() {
  const { crewSlug } = useCrew();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const { reload: reloadSeason } = useSeason();

  const load = async () => {
    const { data } = await supabase.from("seasons").select("*").order("starts_at", { ascending: false });
    setSeasons((data as Season[]) || []);
  };
  useEffect(() => { load(); }, []);

  const active = seasons.find((s) => s.is_active);
  const archived = seasons.filter((s) => s.is_archived);

  const daysRemaining = active
    ? Math.max(0, Math.ceil((new Date(active.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const archiveNow = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("archive-season", { body: {} });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data?.ok) {
      toast.success(data.skipped ? "Già archiviata" : `Stagione ${data.archived_season} archiviata. Nuova: ${data.new_season}`);
      await reloadSeason();
      await load();
    } else {
      toast.error(data?.error || "Errore");
    }
  };

  const createSeason = async () => {
    if (!name || !startsAt || !endsAt) return toast.error("Compila tutti i campi");
    const { error } = await supabase.from("seasons").insert({ name, starts_at: startsAt, ends_at: endsAt, is_active: false, is_archived: false });
    if (error) return toast.error(error.message);
    toast.success("Stagione creata");
    setName(""); setStartsAt(""); setEndsAt("");
    load();
  };

  return (
    <div className="space-y-4">
      {active && (
        <Card className="p-5 space-y-2">
          <h3 className="font-semibold">Stagione attiva</h3>
          <p className="text-2xl font-bold">{active.name}</p>
          <p className="text-sm text-muted-foreground">
            Dal {new Date(active.starts_at).toLocaleDateString("it-IT")} al {new Date(active.ends_at).toLocaleDateString("it-IT")} — <strong>{daysRemaining} giorni rimanenti</strong>
          </p>
          <div className="pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={loading}>Archivia stagione manualmente</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Questa operazione è irreversibile. La stagione verrà archiviata, le squadre azzerate e una nuova stagione creata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={archiveNow}>Archivia</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      )}

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Crea nuova stagione</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026/2027" />
          </div>
          <div className="space-y-1">
            <Label>Inizio</Label>
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fine</Label>
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>
        <Button onClick={createSeason}>Crea stagione</Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Stagioni archiviate</h3>
        {archived.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna stagione archiviata.</p>
        ) : (
          <ul className="space-y-2">
            {archived.map((s) => (
              <li key={s.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.starts_at).toLocaleDateString("it-IT")} — {new Date(s.ends_at).toLocaleDateString("it-IT")}</p>
                </div>
                <Link to="/$crewSlug/stagioni" params={{ crewSlug }}><Button variant="outline" size="sm">Visualizza risultati</Button></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}