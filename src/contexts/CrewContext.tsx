import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export interface Crew {
  id: string;
  name: string;
  slug: string;
  sport_id: string | null;
  logo_url: string | null;
  primary_color: string | null;
  is_active: boolean;
}

interface CrewContextValue {
  crewSlug: string;
  crewId: string | null;
  crew: Crew | null;
  loading: boolean;
}

const CrewContext = createContext<CrewContextValue>({
  crewSlug: "lambro",
  crewId: null,
  crew: null,
  loading: true,
});

export function CrewProvider({ children }: { children: ReactNode }) {
  const params = useParams({ strict: false }) as { crewSlug?: string };
  const crewSlug = params.crewSlug ?? "lambro";
  const [crew, setCrew] = useState<Crew | null>(null);
  const [loading, setLoading] = useState(true);

  // Inject x-crew-slug header on every Supabase request so the backend
  // can resolve the current crew via current_crew_id().
  useEffect(() => {
    if (typeof window === "undefined") return;
    const orig = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        if (url.includes("supabase.co") && crewSlug) {
          const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
          headers.set("x-crew-slug", crewSlug);
          return orig(input, { ...init, headers });
        }
      } catch {
        /* fall through */
      }
      return orig(input, init);
    };
    return () => {
      window.fetch = orig;
    };
  }, [crewSlug]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    supabase
      .from("crews")
      .select("*")
      .eq("slug", crewSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        setCrew((data as Crew) ?? null);
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [crewSlug]);

  return (
    <CrewContext.Provider value={{ crewSlug, crewId: crew?.id ?? null, crew, loading }}>
      {children}
    </CrewContext.Provider>
  );
}

export function useCrew() {
  return useContext(CrewContext);
}