import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crew-slug",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    // Read crew slug from header (sent by the frontend via CrewContext)
    const crewSlug = req.headers.get("x-crew-slug") || "";

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve crew_id from slug
    if (!crewSlug) return json({ error: "x-crew-slug header required" }, 400);
    const { data: crewRow } = await admin.from("crews").select("id").eq("slug", crewSlug).maybeSingle();
    if (!crewRow) return json({ error: "Crew non trovato" }, 404);
    const crewId = crewRow.id as string;

    // Verify caller is admin of THIS crew (or super_admin)
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", ures.user.id)
      .in("role", ["admin", "super_admin"]);

    const isSuperAdmin = (callerRoles || []).some((r: any) => r.role === "super_admin");
    const isCrewAdmin = (callerRoles || []).some((r: any) => r.role === "admin");

    if (!isSuperAdmin && !isCrewAdmin) {
      return json({ error: "Solo gli admin possono invitare utenti" }, 403);
    }

    const body = await req.json();
    const { email, allowed_categories, is_super_admin, role, tm_category } = body as {
      email: string;
      allowed_categories: string[] | null;
      is_super_admin: boolean;
      role?: "admin" | "team_manager";
      tm_category?: string;
    };
    if (!email) return json({ error: "email required" }, 400);

    // Lookup user by email
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const target = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (!target) return json({ error: "Utente non trovato. Deve prima registrarsi." }, 404);

    // ── Team Manager path ─────────────────────────────────────
    if (role === "team_manager") {
      if (!tm_category) return json({ error: "tm_category required" }, 400);

      // Cannot be admin of this crew
      const { data: adminRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", target.id)
        .eq("crew_id", crewId)
        .in("role", ["admin", "super_admin"]);
      if (adminRows && adminRows.length > 0) {
        return json({ error: "Questo utente è già un amministratore di questo club." }, 400);
      }

      // Assign TM role scoped to this crew
      await admin
        .from("user_roles")
        .upsert({ user_id: target.id, role: "team_manager", crew_id: crewId }, { onConflict: "user_id,role,crew_id" });

      // team_manager_assignments scoped to this crew
      await admin
        .from("team_manager_assignments")
        .upsert(
          { user_id: target.id, category: tm_category, crew_id: crewId, created_by: ures.user.id },
          { onConflict: "user_id,crew_id" },
        );

      return json({ ok: true, user_id: target.id, email: target.email, role: "team_manager" });
    }

    // ── Admin path ────────────────────────────────────────────
    // Assign admin role scoped to this crew
    await admin
      .from("user_roles")
      .upsert({ user_id: target.id, role: "admin", crew_id: crewId }, { onConflict: "user_id,role,crew_id" });

    // super_admin is global (crew_id IS NULL) — only super admins can grant it
    if (is_super_admin && isSuperAdmin) {
      await admin
        .from("user_roles")
        .upsert({ user_id: target.id, role: "super_admin", crew_id: null }, { onConflict: "user_id,role,crew_id" });
    }

    // Also register in crew_user_roles for the crew-manage function
    await admin
      .from("crew_user_roles")
      .upsert({ crew_id: crewId, user_id: target.id, role: "admin" }, { onConflict: "crew_id,user_id,role" });

    const { data: prof } = await admin.from("profiles").select("display_name").eq("id", target.id).maybeSingle();
    await admin.from("admin_permissions").upsert(
      {
        user_id: target.id,
        crew_id: crewId,
        display_name: prof?.display_name || target.email,
        is_super_admin: !!is_super_admin && isSuperAdmin,
        allowed_categories: is_super_admin ? null : allowed_categories || [],
        created_by: ures.user.id,
      },
      { onConflict: "user_id,crew_id" },
    );

    return json({ ok: true, user_id: target.id, email: target.email });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
