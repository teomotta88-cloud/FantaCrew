import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { validatePassword, PasswordHints } from "@/lib/passwordPolicy";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Accedi — Fanta Lambro" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Redeem pending invite code from OAuth flow
    const pending = typeof window !== "undefined" ? localStorage.getItem("pending_invite_code") : null;
    const run = async () => {
      let joinedCrewId: string | null = null;
      if (pending) {
        localStorage.removeItem("pending_invite_code");
        const { data, error } = await supabase.rpc("join_crew_by_invite", { _code: pending });
        if (error) toast.error("Codice invito non valido: " + error.message);
        else {
          joinedCrewId = data ?? null;
          toast.success("Benvenuto nella tua crew!");
        }
      }
      const inviteFromSignup = String(user.user_metadata?.invite_code ?? "").trim().toUpperCase();
      const { data: roles } = await supabase
        .from("crew_user_roles")
        .select("crew_id, role, crews:crew_id ( slug, invite_code )")
        .eq("user_id", user.id);
      const memberships = (roles ?? []) as Array<{
        crew_id: string;
        role: string;
        crews?: { slug?: string | null; invite_code?: string | null } | null;
      }>;
      const preferredMembership =
        memberships.find((membership) => joinedCrewId && membership.crew_id === joinedCrewId) ??
        memberships.find((membership) => inviteFromSignup && membership.crews?.invite_code?.toUpperCase() === inviteFromSignup) ??
        memberships.find((membership) => membership.role === "admin") ??
        memberships[0];
      const targetSlug = preferredMembership?.crews?.slug;
      if (!targetSlug) {
        // Superadmin without crew membership → superadmin dashboard
        if (isSuperAdmin) {
          navigate({ to: "/superadmin", replace: true });
        }
        // Otherwise stay on /login so user can sign out or use another account
        return;
      }
      const { data: tmAssignment } = await supabase
        .from("team_manager_assignments" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("crew_id", preferredMembership.crew_id)
        .maybeSingle();
      if (tmAssignment) navigate({ to: "/$crewSlug/tm", replace: true, params: { crewSlug: targetSlug }});
      else navigate({ to: "/$crewSlug/dashboard", replace: true, params: { crewSlug: targetSlug }});
    };
    run();
  }, [user, isSuperAdmin, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Bentornato!");
      // useEffect handles redirect based on role
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast.error("Inserisci il codice di invito della tua crew");
      return;
    }
    const pwIssues = validatePassword(password);
    if (pwIssues.length > 0) {
      toast.error("Password non sicura: " + pwIssues[0]);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: name || email.split("@")[0],
          invite_code: inviteCode.trim().toUpperCase(),
        },
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Account creato!");
    }
  };

  const handleGoogle = async () => {
    if (inviteCode.trim()) {
      localStorage.setItem("pending_invite_code", inviteCode.trim().toUpperCase());
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/login`,
    });
    if (result.error) toast.error("Login Google fallito");
    else if (!result.redirected) navigate({ to: "/", replace: true }); // index.tsx handles TM redirect
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elegant)]">
        <div className="text-center mb-6">
          <div className="text-4xl">🏉</div>
          <h1 className="text-2xl font-bold mt-2">Fanta Lambro</h1>
          <p className="text-sm text-muted-foreground">Accedi per gestire la tua squadra</p>
        </div>
        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Accedi</TabsTrigger>
            <TabsTrigger value="signup">Registrati</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-3 mt-4">
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Accedi
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-3 mt-4">
              <div>
                <Label>Codice invito crew</Label>
                <Input
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Es. LAMBRO2026"
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <Label>Nome manager</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Il tuo nome da fanta-allenatore"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordHints password={password} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Crea account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">oppure</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <p className="text-xs text-muted-foreground mb-2 text-center">
          Se è la prima volta che ti registri con Google, inserisci prima il codice invito nella tab "Registrati".
        </p>
        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          Continua con Google
        </Button>
      </Card>
    </div>
  );
}
