import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "manager" | "super_admin";

interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: Role[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("id,display_name,avatar_url").eq("id", uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  };

  useEffect(() => {
    let cancelled = false;
    let currentUserId: string | null = null;

    const loadUserRoles = async (currentUser: User | null) => {
      if (!currentUser) {
        if (!cancelled) {
          setRoles([]);
          setProfile(null);
        }
        return;
      }

      await supabase.rpc("bootstrap_first_admin");

      // Use the my_crew_roles view which automatically filters
      // by current_crew_id() + handles super_admin (global) and manager (global).
      // Falls back to raw user_roles if the view isn't available yet.
      const { data, error } = await supabase.from("my_crew_roles" as any).select("role");
      if (!cancelled) {
        if (!error && data) {
          setRoles((data.map((r: any) => r.role) as Role[]) || []);
        } else {
          // Fallback: read all roles for this user (pre-migration compatibility)
          const { data: fallback } = await supabase.from("user_roles").select("role").eq("user_id", currentUser.id);
          setRoles((fallback?.map((r) => r.role) as Role[]) || []);
        }
      }
      if (!cancelled) await loadProfile(currentUser.id);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;

      if (event === "SIGNED_OUT") {
        setSession(s);
        currentUserId = null;
        setUser(null);
        setRoles([]);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event !== "SIGNED_IN" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_IN" && currentUserId === s?.user?.id) return;

      setSession(s);
      currentUserId = s?.user?.id ?? null;
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        setTimeout(() => loadUserRoles(s.user!).finally(() => !cancelled && setLoading(false)), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      currentUserId = s?.user?.id ?? null;
      setUser(s?.user ?? null);
      loadUserRoles(s?.user ?? null).finally(() => !cancelled && setLoading(false));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        roles,
        isAdmin: roles.includes("admin"),
        isSuperAdmin: roles.includes("super_admin"),
        isManager: roles.includes("manager"),
        profile,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
