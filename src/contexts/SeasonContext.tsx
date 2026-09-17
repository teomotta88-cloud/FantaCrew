import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Season = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_archived: boolean;
};

type Ctx = {
  activeSeason: Season | null;
  seasonId: string | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const SeasonContext = createContext<Ctx>({ activeSeason: null, seasonId: null, loading: true, reload: async () => {} });

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("seasons").select("*").eq("is_active", true).maybeSingle();
    setActiveSeason((data as Season) || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <SeasonContext.Provider value={{ activeSeason, seasonId: activeSeason?.id ?? null, loading, reload: load }}>
      {children}
    </SeasonContext.Provider>
  );
}

export const useSeason = () => useContext(SeasonContext);