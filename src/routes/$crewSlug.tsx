import { createFileRoute, Outlet, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCrew } from "@/contexts/CrewContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$crewSlug")({
  component: CrewLayout,
});

function CrewLayout() {
  const { crewSlug } = useParams({ from: "/$crewSlug" });
  const { crew, loading } = useCrew();
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (authLoading || !crew) return;
    if (!user) {
      setMembershipChecked(true);
      setIsMember(false);
      return;
    }
    if (isSuperAdmin) {
      setMembershipChecked(true);
      setIsMember(true);
      return;
    }
    let cancel = false;
    setMembershipChecked(false);
    supabase
      .from("crew_user_roles")
      .select("crew_id")
      .eq("user_id", user.id)
      .eq("crew_id", crew.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        setIsMember(!!data);
        setMembershipChecked(true);
      });
    return () => {
      cancel = true;
    };
  }, [user, isSuperAdmin, authLoading, crew]);

  useEffect(() => {
    if (typeof document === "undefined" || !crew) return;
    // Document title
    document.title = `Fanta ${crew.name}`;
    // Favicon: replace existing icon links with the team's logo
    if (crew.logo_url) {
      const head = document.head;
      const existing = head.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
      );
      existing.forEach((el) => el.parentNode?.removeChild(el));
      const icon = document.createElement("link");
      icon.rel = "icon";
      icon.href = crew.logo_url;
      head.appendChild(icon);
      const apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      apple.href = crew.logo_url;
      head.appendChild(apple);
    }
  }, [crew]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Caricamento…
      </div>
    );
  }
  if (!crew) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Team "{crewSlug}" non trovato</h1>
        <Link to="/" className="text-primary underline">
          Torna alla home
        </Link>
      </div>
    );
  }
  if (authLoading || !membershipChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Caricamento…
      </div>
    );
  }
  if (user && !isMember) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Accesso non consentito</h1>
        <p className="text-muted-foreground max-w-md">
          Non fai parte del team "{crew.name}". Puoi accedere solo al team a cui sei iscritto.
        </p>
        <Link to="/" className="text-primary underline">
          Torna alla home
        </Link>
      </div>
    );
  }
  return <Outlet />;
}