import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/superadmin/")({
  component: SuperAdminLogin,
  head: () => ({ meta: [{ title: "Super Admin — FantaCrew" }] }),
});

function SuperAdminLogin() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && isSuperAdmin) navigate({ to: "/superadmin/dashboard", replace: true });
  }, [user, isSuperAdmin, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const uid = signInData.user?.id;
    if (!uid) {
      setBusy(false);
      toast.error("Sessione non disponibile");
      return;
    }
    const { data: roleRows, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "super_admin");
    setBusy(false);
    if (roleErr) {
      toast.error("Errore verifica permessi: " + roleErr.message);
      return;
    }
    if (!roleRows || roleRows.length === 0) {
      toast.error("Questo utente non è un Super Admin.");
      await supabase.auth.signOut();
      return;
    }
    toast.success("Accesso effettuato");
    window.location.assign("/superadmin/dashboard");
  };

  const handleSignup = async () => {
    if (!email || !password) {
      toast.error("Inserisci email e password");
      return;
    }
    setBusy(true);
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing) {
      await supabase.auth.signOut();
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/superadmin" },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account creato. Effettua il login.");
  };

  if (user && !isSuperAdmin && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">Accesso negato</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            L'utente {user.email} non è un Super Admin.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => supabase.auth.signOut()}>
            Esci
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--gradient-hero)" }}
    >
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="text-center mb-6">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold mt-2">FantaCrew — Super Admin</h1>
          <p className="text-sm text-muted-foreground">Accesso riservato</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Accedi
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={handleSignup}
          >
            Crea account Super Admin (prima volta)
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          <Link to="/login" className="underline">
            Login utente standard
          </Link>
        </p>
      </Card>
    </div>
  );
}