import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useCrew } from "./CrewContext";

type AdminPermissionsState = {
  loading: boolean;
  isSuperAdmin: boolean;
  allowedCategories: string[] | null; // null = all
  canManageCategory: (category: string | null | undefined) => boolean;
  canAccessTab: (tab: string) => boolean;
  refresh: () => Promise<void>;
};

const SUPER_ONLY_TABS = new Set<string>(["admins"]);

const Ctx = createContext<AdminPermissionsState | undefined>(undefined);

export function AdminPermissionsProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { crewId } = useCrew();
  const [loading, setLoading] = useState(true);
  const [allowedCategories, setAllowedCategories] = useState<string[] | null>(null);
  const [rowSuper, setRowSuper] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !isAdmin || !crewId) {
      setAllowedCategories(null);
      setRowSuper(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("admin_permissions")
      .select("is_super_admin,allowed_categories")
      .eq("user_id", user.id)
      .eq("crew_id", crewId) // ← scoped to current crew
      .maybeSingle();
    setRowSuper(!!data?.is_super_admin);
    setAllowedCategories((data?.allowed_categories as string[] | null) ?? null);
    setLoading(false);
  }, [user, isAdmin, crewId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const effectiveSuper = isSuperAdmin || rowSuper;

  const canManageCategory = (category: string | null | undefined) => {
    if (effectiveSuper) return true;
    if (!isAdmin) return false;
    if (allowedCategories === null) return true;
    if (!category) return false;
    return allowedCategories.includes(category);
  };

  const canAccessTab = (tab: string) => {
    if (effectiveSuper) return true;
    if (!isAdmin) return false;
    return !SUPER_ONLY_TABS.has(tab);
  };

  return (
    <Ctx.Provider
      value={{
        loading,
        isSuperAdmin: effectiveSuper,
        allowedCategories: effectiveSuper ? null : allowedCategories,
        canManageCategory,
        canAccessTab,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAdminPermissions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminPermissions must be used within AdminPermissionsProvider");
  return ctx;
}
