import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEASON = "2025/2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const season = SEASON;

    const { data: crews } = await supabase.from("crews").select("id,slug").eq("is_active", true);
    const perCrew: any[] = [];

    for (const crew of (crews || [])) {
      const crewId = crew.id;

      // Idempotency check per crew (zaghetti_history has no crew_id; scope via player_id)
      const { data: crewPlayers } = await supabase
        .from("players")
        .select("id,category,value_zaghetti")
        .eq("crew_id", crewId);
      const playerIds = (crewPlayers || []).map((p: any) => p.id);
      if (playerIds.length === 0) { perCrew.push({ crew: crew.slug, skipped: "no players" }); continue; }

      const { count } = await supabase
        .from("zaghetti_history")
        .select("id", { count: "exact", head: true })
        .in("player_id", playerIds)
        .eq("season", season)
        .eq("month", month);

      if ((count ?? 0) > 0) {
        perCrew.push({ crew: crew.slug, skipped: "already_applied" });
        continue;
      }

      const players = crewPlayers;
      const { data: catRows } = await supabase
        .from("player_categories")
        .select("name")
        .eq("crew_id", crewId)
        .eq("is_active", true);
      const CATEGORIES = (catRows || []).map((c: any) => c.name as string);
      const { data: scores } = await supabase
        .from("player_scores")
        .select("player_id,total_points")
        .in("player_id", playerIds);

    const scoreMap = new Map((scores || []).map((s: any) => [s.player_id, s.total_points || 0]));

    const historyRows: any[] = [];
    const updates: { id: string; new_value: number }[] = [];

    for (const cat of CATEGORIES) {
      const inCat = (players || [])
        .filter((p: any) => p.category === cat)
        .map((p: any) => ({ ...p, points: scoreMap.get(p.id) || 0 }))
        .sort((a, b) => b.points - a.points);

      inCat.forEach((p, idx) => {
        const rank = idx + 1;
        let delta = 0;
        if (rank <= 10) delta = 1;
        else if (rank <= 20) delta = 0;
        else delta = -1;

        const oldValue = p.value_zaghetti;
        const newValue = Math.max(1, Math.min(10, oldValue + delta));
        const effectiveDelta = newValue - oldValue;

        historyRows.push({
          player_id: p.id,
          month,
          season,
          old_value: oldValue,
          new_value: newValue,
          delta: effectiveDelta,
        });
        if (effectiveDelta !== 0) updates.push({ id: p.id, new_value: newValue });
      });
    }

    if (historyRows.length) {
      const { error: hErr } = await supabase.from("zaghetti_history").insert(historyRows);
      if (hErr) throw hErr;
    }

    for (const u of updates) {
      const { error: uErr } = await supabase.from("players").update({ value_zaghetti: u.new_value }).eq("id", u.id);
      if (uErr) throw uErr;
    }
      perCrew.push({ crew: crew.slug, processed: historyRows.length, updated: updates.length });
    } // end for crews

    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-event-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "" },
        body: JSON.stringify({ eventTrigger: "repricing_done" }),
      });
    } catch (e) { console.error("notify failed", e); }

    return new Response(
      JSON.stringify({ ok: true, month, season, perCrew }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});