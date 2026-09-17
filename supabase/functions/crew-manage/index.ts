import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: superRows } = await admin
      .from("user_roles").select("role").eq("user_id", ures.user.id).eq("role", "super_admin");
    if (!superRows || superRows.length === 0) return json({ error: "Only super admins" }, 403);

    const body = await req.json();
    const { action, crew_id } = body as { action: string; crew_id?: string };
    if (!action) return json({ error: "action required" }, 400);

    const findUserByEmail = async (email: string) => {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      return list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase()) || null;
    };

    if (action === "assign_owner") {
      const { email } = body as { email: string };
      if (!crew_id || !email) return json({ error: "crew_id and email required" }, 400);
      const t = await findUserByEmail(email);
      if (!t) return json({ error: "Utente non trovato. Deve prima registrarsi." }, 404);
      const { error } = await admin.from("crews").update({ owner_user_id: t.id }).eq("id", crew_id);
      if (error) throw error;
      // Also grant crew-scoped admin role
      await admin.from("crew_user_roles").upsert(
        { crew_id, user_id: t.id, role: "admin" },
        { onConflict: "crew_id,user_id,role" }
      );
      return json({ ok: true, user_id: t.id });
    }

    if (action === "add_admin") {
      const { email, is_global_admin } = body as { email: string; is_global_admin?: boolean };
      if (!crew_id || !email) return json({ error: "crew_id and email required" }, 400);
      const t = await findUserByEmail(email);
      if (!t) return json({ error: "Utente non trovato. Deve prima registrarsi." }, 404);
      await admin.from("crew_user_roles").upsert(
        { crew_id, user_id: t.id, role: "admin" },
        { onConflict: "crew_id,user_id,role" }
      );
      if (is_global_admin) {
        // Optional: also give global admin role so they access /admin pages
        await admin.from("user_roles").upsert({ user_id: t.id, role: "admin" }, { onConflict: "user_id,role" });
        const { data: prof } = await admin.from("profiles").select("display_name").eq("id", t.id).maybeSingle();
        await admin.from("admin_permissions").upsert({
          user_id: t.id,
          display_name: prof?.display_name || t.email,
          is_super_admin: false,
          allowed_categories: null,
          created_by: ures.user.id,
        }, { onConflict: "user_id" });
      }
      return json({ ok: true, user_id: t.id });
    }

    if (action === "remove_admin") {
      const { user_id } = body as { user_id: string };
      if (!crew_id || !user_id) return json({ error: "crew_id and user_id required" }, 400);
      await admin.from("crew_user_roles").delete().eq("crew_id", crew_id).eq("user_id", user_id).eq("role", "admin");
      return json({ ok: true });
    }

    if (action === "list_members") {
      if (!crew_id) return json({ error: "crew_id required" }, 400);
      const { data: roles } = await admin.from("crew_user_roles").select("id,user_id,role,created_at").eq("crew_id", crew_id);
      const ids = (roles || []).map((r: any) => r.user_id);
      const { data: profs } = ids.length
        ? await admin.from("profiles").select("id,display_name").in("id", ids)
        : { data: [] as any[] };
      // Pull emails via admin API
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emailById = new Map(list.users.map((u) => [u.id, u.email]));
      const merged = (roles || []).map((r: any) => ({
        ...r,
        display_name: profs?.find((p: any) => p.id === r.user_id)?.display_name || null,
        email: emailById.get(r.user_id) || null,
      }));
      return json({ ok: true, members: merged });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}