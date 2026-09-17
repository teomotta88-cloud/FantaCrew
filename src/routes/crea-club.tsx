import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { extractDominantColor } from "@/lib/dominantColor";
import { ArrowLeft, Loader2 } from "lucide-react";
import { validatePassword, PasswordHints } from "@/lib/passwordPolicy";

export const Route = createFileRoute("/crea-club")({
  component: CreateClubPage,
  head: () => ({
    meta: [
      { title: "Crea il tuo club — Fantacrew" },
      { name: "description", content: "Crea il tuo club fantasy in pochi secondi e invita i tuoi amici." },
    ],
  }),
});

type Sport = { id: string; name: string; slug: string; icon: string | null };

function CreateClubPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [sports, setSports] = useState<Sport[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sportId, setSportId] = useState("");
  const [color, setColor] = useState("#1a5d3a");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Admin account fields (richiesti se non loggato)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase
      .from("sports")
      .select("id,name,slug,icon")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setSports((data as Sport[]) || []));
  }, []);

  const onNameChange = (v: string) => {
    setName(v);
    if (!slug || slug === slugify(name)) setSlug(slugify(v));
  };

  const onLogo = async (file: File | null) => {
    setLogoFile(file);
    if (!file) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    try {
      const c = await extractDominantColor(url);
      if (c) setColor(c);
    } catch {}
  };

  const create = async () => {
    if (!name || !slug || !sportId) {
      toast.error("Compila nome, slug e sport");
      return;
    }
    if (!user) {
      if (!firstName.trim() || !lastName.trim()) {
        toast.error("Inserisci nome e cognome dell'admin");
        return;
      }
      if (!email.trim() || !password) {
        toast.error("Inserisci email e password dell'admin");
        return;
      }
      const pwIssues = validatePassword(password);
      if (pwIssues.length > 0) {
        toast.error("Password non sicura: " + pwIssues[0]);
        return;
      }
    }
    setBusy(true);
    try {
      // 1) Crea account admin se non già loggato
      if (!user) {
        const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName, first_name: firstName.trim(), last_name: lastName.trim() },
          },
        });
        if (signUpErr) {
          toast.error(signUpErr.message);
          setBusy(false);
          return;
        }
        if (!signUpData.session) {
          // Email confirmation richiesta - prova a fare il login
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (signInErr) {
            toast.error(
              "Account creato. Conferma l'email e poi torna qui per finalizzare la creazione del club.",
            );
            setBusy(false);
            return;
          }
        }
      }

      const cleanSlug = slugify(slug);
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
        const path = `crews/${cleanSlug}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type || "image/png" });
        if (upErr) {
          toast.error("Upload logo: " + upErr.message);
          setBusy(false);
          return;
        }
        logoUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await supabase.rpc("create_crew_as_admin", {
        _name: name,
        _slug: cleanSlug,
        _sport_id: sportId,
        _primary_color: color,
        _logo_url: logoUrl ?? undefined,
      });
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      const result = Array.isArray(data) ? data[0] : data;
      toast.success(`Club creato! Codice invito: ${result?.new_invite_code}`);
      navigate({ to: "/$crewSlug/dashboard", params: { crewSlug: cleanSlug }, replace: true });
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <Link to="/" className="text-xl font-black tracking-tight">
          Fanta<span className="italic text-primary">crew</span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Home</Link>
        </Button>
      </header>
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight">Crea il tuo club</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Diventerai automaticamente admin del club. I tuoi amici potranno entrare usando il codice invito che verrà generato.
        </p>
        {!user && (
          <Card className="p-6 mt-6 space-y-4">
            <h2 className="font-bold">Il tuo account admin</h2>
            <p className="text-xs text-muted-foreground">
              Hai già un account? <Link to="/login" className="underline">Accedi</Link> prima di creare il club.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Cognome *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              <PasswordHints password={password} />
            </div>
          </Card>
        )}
        <Card className="p-6 mt-6 space-y-4">
          <h2 className="font-bold">Il tuo club</h2>
          <div>
            <Label>Nome del club *</Label>
            <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Es. Rugby Milano" />
          </div>
          <div>
            <Label>Slug URL *</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="rugby-milano" />
            <p className="text-xs text-muted-foreground mt-1">La tua homepage sarà /{slug || "il-tuo-slug"}</p>
          </div>
          <div>
            <Label>Sport *</Label>
            <Select value={sportId} onValueChange={setSportId}>
              <SelectTrigger><SelectValue placeholder="Seleziona uno sport" /></SelectTrigger>
              <SelectContent>
                {sports.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Logo</Label>
              <Input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0] || null)} />
              {logoPreview && (
                <img src={logoPreview} alt="Anteprima logo" className="mt-2 h-20 w-20 rounded-lg object-cover border" />
              )}
            </div>
            <div>
              <Label>Colore principale</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full" />
              <p className="text-xs text-muted-foreground mt-1">Rilevato dal logo, modificabile.</p>
            </div>
          </div>
          <Button onClick={create} disabled={busy} className="w-full" size="lg">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crea il club
          </Button>
        </Card>
      </main>
    </div>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}