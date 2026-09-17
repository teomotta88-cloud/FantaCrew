import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const { category, season_id, from_date, to_date, crew_id, crew_slug } = body || {};

    // Resolve crew_id from slug if provided
    let crewId: string | null = crew_id ?? null;
    if (!crewId && crew_slug) {
      const { data: c } = await supabase.from("crews").select("id").eq("slug", crew_slug).maybeSingle();
      crewId = c?.id ?? null;
    }

    // Resolve active season if not provided
    let seasonId: string | null = season_id ?? null;
    let seasonStarts: string | null = null;
    let seasonEnds: string | null = null;
    if (seasonId) {
      const { data } = await supabase.from("seasons").select("crew_id,starts_at,ends_at").eq("id", seasonId).maybeSingle();
      seasonStarts = data?.starts_at ?? null;
      seasonEnds = data?.ends_at ?? null;
      if (!crewId) crewId = (data as any)?.crew_id ?? null;
    } else {
      let q = supabase.from("seasons").select("id,crew_id,starts_at,ends_at").eq("is_active", true);
      if (crewId) q = q.eq("crew_id", crewId);
      const { data } = await q.maybeSingle();
      seasonId = data?.id ?? null;
      seasonStarts = data?.starts_at ?? null;
      seasonEnds = data?.ends_at ?? null;
      if (!crewId) crewId = (data as any)?.crew_id ?? null;
    }

    const today = new Date().toISOString().slice(0, 10);
    const from = from_date || (seasonStarts && seasonStarts > today ? seasonStarts : today);
    const to = to_date || seasonEnds || `${new Date().getFullYear()}-12-31`;

    // Load matching active schedules
    let q = supabase.from("training_schedules").select("*").eq("is_active", true);
    if (crewId) q = q.eq("crew_id", crewId);
    if (category) q = q.eq("category", category);
    const { data: schedules, error: schedErr } = await q;
    if (schedErr) throw schedErr;

    const fromDate = new Date(from + "T00:00:00Z");
    const toDate = new Date(to + "T00:00:00Z");

    const rows: any[] = [];
    for (const s of schedules || []) {
      for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
        if (d.getUTCDay() === s.day_of_week) {
          rows.push({
            category: s.category,
            training_date: d.toISOString().slice(0, 10),
            start_time: s.start_time,
            location: s.location,
            season_id: s.season_id ?? seasonId,
            crew_id: s.crew_id ?? crewId,
          });
        }
      }
    }

    let generated = 0;
    if (rows.length) {
      // IMPORTANT: only insert into the `trainings` table (calendar).
      // Attendance must be recorded manually by admin/TM per player.
      // Never insert into weekly_events from this function.
      const { error, count } = await supabase
        .from("trainings")
        .upsert(rows, { onConflict: "category,training_date", ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      generated = count ?? rows.length;
    }

    return new Response(JSON.stringify({ generated, category: category ?? "all", from, to }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});