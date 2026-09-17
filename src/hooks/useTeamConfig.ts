import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_GROUPS, type RoleGroupKey } from "@/lib/constants";

export type TeamConfig = {
  budget: number;
  squadSize: number;
  coachesRequired: number;
  /** keyed by player_categories.name */
  minPerCategory: Record<string, number>;
  groupRequired: Record<RoleGroupKey, number>;
  multipliers: { captain: number; talisman: number; silverback: number };
};

const DEFAULT: TeamConfig = {
  budget: 100,
  squadSize: 22,
  coachesRequired: 1,
  minPerCategory: {},
  groupRequired: ROLE_GROUPS.reduce((acc, g) => { acc[g.key] = g.required; return acc; }, {} as Record<RoleGroupKey, number>),
  multipliers: { captain: 2, talisman: 4, silverback: 5 },
};

export function useTeamConfig() {
  const [config, setConfig] = useState<TeamConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data }, { data: cats }] = await Promise.all([
        supabase.from("team_config").select("key,value"),
        supabase.from("player_categories").select("name,is_active").eq("is_active", true),
      ]);
      if (data) {
        const map = new Map(data.map((r) => [r.key, r.value]));
        const minPerCategory: Record<string, number> = {};
        (cats || []).forEach((c: any) => {
          minPerCategory[c.name] = map.get(`min_${c.name}`) ?? 0;
        });
        setConfig({
          budget: map.get("budget") ?? DEFAULT.budget,
          squadSize: map.get("squad_size") ?? DEFAULT.squadSize,
          coachesRequired: map.get("coaches_required") ?? DEFAULT.coachesRequired,
          minPerCategory,
          groupRequired: ROLE_GROUPS.reduce((acc, g) => {
            acc[g.key] = map.get(`group_${g.key}`) ?? DEFAULT.groupRequired[g.key];
            return acc;
          }, {} as Record<RoleGroupKey, number>),
          multipliers: {
            captain: map.get("multiplier_captain") ?? DEFAULT.multipliers.captain,
            talisman: map.get("multiplier_talisman") ?? DEFAULT.multipliers.talisman,
            silverback: map.get("multiplier_silverback") ?? DEFAULT.multipliers.silverback,
          },
        });
      }
      setLoading(false);
    })();
  }, []);

  return { config, loading };
}
