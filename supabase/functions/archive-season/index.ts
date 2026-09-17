import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function nextSeasonName(currentName: string): string {
  const m = currentName.match(/^(\d{4})\/(\d{4})$/);
  if (!m) return currentName + "+1";
  const a = parseInt(m[1], 10) + 1;
  const b = parseInt(m[2], 10) + 1;
  return `${a}/${b}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body?.season_id;

    // Get target season (param or current active)
    const { data: season, error: sErr } = targetId
      ? await supabase.from("seasons").select("*").eq("id", targetId).maybeSingle()
      : await supabase.from("seasons").select("*").eq("is_active", true).maybeSingle();
    if (sErr) throw sErr;
    if (!season) throw new Error("Season not found");

    // Idempotency
    if (season.is_archived) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already archived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const seasonId = season.id as string;
    const crewId = season.crew_id as string;

    // 1. Snapshot final team standings — use latest leaderboard_snapshots
    const { data: snaps } = await supabase
      .from("leaderboard_snapshots")
      .select("team_id,total_points,week")
      .eq("crew_id", crewId)
      .eq("season_id", seasonId)
      .order("week", { ascending: false });
    const latestByTeam = new Map<string, number>();
    for (const s of snaps || []) {
      if (!latestByTeam.has(s.team_id)) latestByTeam.set(s.team_id, s.total_points);
    }
    const { data: teams } = await supabase
      .from("teams")
      .select("id,name,manager_id,profiles:manager_id(display_name)")
      .eq("crew_id", crewId)
      .eq("season_id", seasonId);
    const teamRows = (teams || []).map((t: any) => ({
      season_id: seasonId,
      team_id: t.id,
      team_name: t.name,
      manager_name: t.profiles?.display_name ?? null,
      points: latestByTeam.get(t.id) ?? 0,
    })).sort((a, b) => b.points - a.points)
      .map((r, i) => ({ ...r, final_rank: i + 1, final_points: r.points }));
    if (teamRows.length) {
      const ins = teamRows.map(({ points, ...rest }) => rest);
      await supabase.from("season_results").upsert(ins, { onConflict: "season_id,team_id" });
    }

    // 2. Snapshot final player standings
    const [{ data: rules }, { data: weekly }, { data: comps }, { data: actions }, { data: players }] = await Promise.all([
      supabase.from("scoring_rules").select("key,points").eq("crew_id", crewId).eq("is_active", true),
      supabase.from("weekly_events").select("player_id,rule_key,quantity").eq("crew_id", crewId).eq("season_id", seasonId),
      supabase.from("special_action_completions").select("action_id,player_id").eq("crew_id", crewId).not("player_id", "is", null),
      supabase.from("special_actions").select("id,points").eq("crew_id", crewId).eq("season_id", seasonId),
      supabase.from("players").select("id,full_name,category").eq("crew_id", crewId),
    ]);
    const ruleMap = new Map((rules || []).map((r: any) => [r.key, r.points]));
    const playerPts = new Map<string, number>();
    for (const e of weekly || []) {
      const p = (ruleMap.get(e.rule_key) || 0) * (e.quantity || 0);
      playerPts.set(e.player_id, (playerPts.get(e.player_id) || 0) + p);
    }
    const actionIdSet = new Set((actions || []).map((a: any) => a.id));
    const counts = new Map<string, number>();
    for (const c of comps || []) if (actionIdSet.has(c.action_id)) counts.set(c.action_id, (counts.get(c.action_id) || 0) + 1);
    const actionPts = new Map((actions || []).map((a: any) => [a.id, a.points]));
    for (const c of comps || []) {
      if (!actionIdSet.has(c.action_id)) continue;
      const base = actionPts.get(c.action_id) || 0;
      const pts = (counts.get(c.action_id) || 0) > 1 ? -base : base;
      playerPts.set(c.player_id!, (playerPts.get(c.player_id!) || 0) + pts);
    }
    const playerRows = (players || []).map((p: any) => ({
      season_id: seasonId,
      player_id: p.id,
      full_name: p.full_name,
      category: p.category,
      pts: playerPts.get(p.id) || 0,
    })).sort((a, b) => b.pts - a.pts)
      .map((r, i) => ({ season_id: r.season_id, player_id: r.player_id, full_name: r.full_name, category: r.category, final_rank: i + 1, final_points: r.pts }));
    if (playerRows.length) {
      await supabase.from("season_player_results").upsert(playerRows, { onConflict: "season_id,player_id" });
    }

    // 3. Archive season
    await supabase.from("seasons").update({ is_archived: true, is_active: false }).eq("id", seasonId);

    // 4. Create next season
    const nextName = nextSeasonName(season.name);
    const start = new Date(season.ends_at);
    start.setUTCDate(start.getUTCDate() + 25);
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    end.setUTCMonth(6, 31); // July 31
    const nextStart = `${start.getUTCFullYear()}-08-25`;
    const nextEnd = `${end.getUTCFullYear()}-07-31`;
    let { data: newSeason } = await supabase.from("seasons").select("*").eq("crew_id", crewId).eq("name", nextName).maybeSingle();
    if (!newSeason) {
      const { data: created } = await supabase.from("seasons")
        .insert({ name: nextName, starts_at: nextStart, ends_at: nextEnd, is_active: true, is_archived: false, crew_id: crewId })
        .select().single();
      newSeason = created;
    } else {
      await supabase.from("seasons").update({ is_active: true }).eq("id", newSeason.id);
    }

    // 5. Reset teams for the new season
    const teamIds = (teams || []).map((t: any) => t.id);
    if (teamIds.length) {
      await supabase.from("team_player_history").update({ left_at: new Date().toISOString() }).in("team_id", teamIds).is("left_at", null);
      await supabase.from("team_players").delete().in("team_id", teamIds);
      await supabase.from("teams")
        .update({
          captain_player_id: null, talisman_player_id: null, silverback_player_id: null,
          captain_changed_at: null, talisman_changed_at: null, silverback_changed_at: null,
          season_id: newSeason!.id,
        })
        .in("id", teamIds);
    }

    // 6. Reset player values
    const { data: cfg } = await supabase.from("team_config").select("value").eq("crew_id", crewId).eq("key", "default_player_value").maybeSingle();
    const defaultVal = (cfg as any)?.value ?? 5;
    await supabase.from("players").update({ value_zaghetti: defaultVal }).eq("crew_id", crewId);

    // 7. Broadcast push
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
        body: JSON.stringify({
          title: "🏆 Stagione terminata!",
          body: `La stagione ${season.name} è terminata! Controlla i risultati finali e preparati per la nuova stagione.`,
          url: "/stagioni",
          audience: "all",
        }),
      });
    } catch (e) { console.error("push failed", e); }

    return new Response(JSON.stringify({ ok: true, archived_season: season.name, new_season: nextName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});