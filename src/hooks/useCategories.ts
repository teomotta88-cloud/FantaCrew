import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlayerCategory = {
  id: string;
  name: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  training_days: number[];
};

export function useCategories(opts: { activeOnly?: boolean } = {}) {
  const [categories, setCategories] = useState<PlayerCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("player_categories").select("*").order("sort_order");
    if (opts.activeOnly) q = q.eq("is_active", true);
    const { data } = await q;
    setCategories((data as PlayerCategory[]) || []);
    setLoading(false);
  };

  const activeOnly = opts.activeOnly ?? false;
  useEffect(() => {
    load();
  }, [activeOnly]);

  const labelMap = Object.fromEntries(categories.map((c) => [c.name, c.label || c.name]));

  return { categories, loading, reload: load, labelMap };
}

export function categoryLabelOf(categories: PlayerCategory[], name: string | null | undefined): string {
  if (!name) return "";
  return categories.find((c) => c.name === name)?.label ?? name;
}
