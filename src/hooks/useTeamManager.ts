import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCrew } from "@/contexts/CrewContext";

export type TMProfile = {
  userId: string;
  category: string;
};

export function useTeamManager() {
  const { user, loading: authLoading } = useAuth();
  const { crewId, loading: crewLoading } = useCrew();
  const [tm, setTm] = useState<TMProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || crewLoading) return;
    if (!user || !crewId) {
      setTm(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("team_manager_assignments" as any)
        .select("category")
        .eq("user_id", user.id)
        .eq("crew_id", crewId) // ← scoped to current crew
        .maybeSingle();
      if (cancelled) return;
      setTm(data ? { userId: user.id, category: (data as any).category } : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, crewId, crewLoading]);

  return { tm, isTeamManager: !!tm, loading };
}
