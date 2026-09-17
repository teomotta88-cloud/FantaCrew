// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: crews } = await supabase.from("crews").select("id,slug").eq("is_active", true);
    let totalEvaluated = 0, totalInserted = 0, totalCandidates = 0;
    const perCrew: any[] = [];

    for (const crew of (crews || [])) {
      const crewId = crew.id;
      // Active season (per crew)
      const { data: season } = await supabase
        .from("seasons")
        .select("id,name,starts_at,ends_at")
        .eq("crew_id", crewId)
        .eq("is_active", true)
        .maybeSingle();
      if (!season) { perCrew.push({ crew: crew.slug, skipped: "no active season" }); continue; }
      const seasonId = season.id as string;
      const seasonName = season.name as string;

      // Definitions
      const { data: defs } = await supabase.from("badge_definitions").select("*").eq("crew_id", crewId).eq("is_active", true);
    const defsByKey: Record<string, any> = {};
    (defs || []).forEach((d: any) => (defsByKey[d.key] = d));

    // Players
    const { data: players } = await supabase.from("players").select("id,category").eq("crew_id", crewId);
    if (!players) { perCrew.push({ crew: crew.slug, skipped: "no players" }); continue; }

    // Preload datasets
    const { data: events } = await supabase
      .from("weekly_events")
      .select("player_id,rule_key,quantity,match_id,week,season_id")
      .eq("crew_id", crewId)
      .eq("season_id", seasonId);

    const { data: matches } = await supabase
      .from("matches")
      .select("id,match_date,category,season")
      .eq("crew_id", crewId)
      .eq("season", seasonName);

    const { data: callups } = await supabase
      .from("match_call_ups")
      .select("match_id,player_id,squad_role")
      .eq("crew_id", crewId);

    const { data: roleHist } = await supabase
      .from("role_assignment_history")
      .select("team_id,player_id,role,season_id")
      .eq("crew_id", crewId)
      .eq("season_id", seasonId);

    const { data: actComps } = await supabase
      .from("special_action_completions")
      .select("action_id,player_id")
      .eq("crew_id", crewId);

    const { data: absences } = await supabase
      .from("training_absences")
      .select("player_id,training_date")
      .eq("crew_id", crewId);

    const matchById: Record<string, any> = {};
    (matches || []).forEach((m: any) => (matchById[m.id] = m));

    const toInsert: Array<{ player_id: string; badge_key: string; season_id: string; crew_id: string }> = [];
    const award = (player_id: string, key: string) => {
      if (!defsByKey[key]) return;
      toInsert.push({ player_id, badge_key: key, season_id: seasonId, crew_id: crewId });
    };

    for (const p of players) {
      const pid = p.id as string;
      const cat = p.category as string;

      // Fanta popular roles
      for (const [role, key] of [
        ["captain", "captain_popular"],
        ["talisman", "talisman_popular"],
        ["silverback", "silverback_popular"],
      ] as const) {
        const teams = new Set(
          (roleHist || []).filter((r: any) => r.player_id === pid && r.role === role).map((r: any) => r.team_id),
        );
        if (teams.size >= (defsByKey[key]?.threshold || 30)) award(pid, key);
      }

      const pEvents = (events || []).filter((e: any) => e.player_id === pid);
      const tryEvents = pEvents.filter((e: any) => e.rule_key === "try_scored");
      const tries = tryEvents.reduce((s: number, e: any) => s + (e.quantity || 1), 0);
      if (tries >= 10) award(pid, "metaman");
      if (tries >= 15) award(pid, "super_metaman");
      if (tries >= 20) award(pid, "mega_metaman");

      const motm = pEvents.filter((e: any) => e.rule_key === "motm").reduce((s: number, e: any) => s + (e.quantity || 1), 0);
      if (motm >= 1) award(pid, "motm_1");
      if (motm >= 3) award(pid, "motm_3");

      const kicks = pEvents
        .filter((e: any) => e.rule_key === "penalty_kick" || e.rule_key === "conversion")
        .reduce((s: number, e: any) => s + (e.quantity || 1), 0);
      if (kicks >= 10) award(pid, "cecchino");
      if (kicks >= 20) award(pid, "super_cecchino");

      const actions = new Set((actComps || []).filter((a: any) => a.player_id === pid).map((a: any) => a.action_id));
      if (actions.size >= 3) award(pid, "joker");

      // Multi-try in same match
      const byMatch: Record<string, number> = {};
      tryEvents.forEach((e: any) => {
        if (!e.match_id) return;
        byMatch[e.match_id] = (byMatch[e.match_id] || 0) + (e.quantity || 1);
      });
      const maxInMatch = Object.values(byMatch).reduce((m, v) => Math.max(m, v), 0);
      if (maxInMatch >= 2) award(pid, "due_cuori");
      if (maxInMatch >= 3) award(pid, "hat_trick");
      if (maxInMatch >= 4) award(pid, "poker");

      // Consecutive bench/starter — based on category matches ordered by date
      const catMatches = (matches || [])
        .filter((m: any) => m.category === cat)
        .sort((a: any, b: any) => a.match_date.localeCompare(b.match_date));
      const roleByMatch: Record<string, string> = {};
      (callups || []).filter((c: any) => c.player_id === pid).forEach((c: any) => (roleByMatch[c.match_id] = c.squad_role));

      let benchStreak = 0, maxBench = 0, startStreak = 0, maxStart = 0;
      let convocAll = catMatches.length > 0;
      for (const m of catMatches) {
        const r = roleByMatch[m.id];
        if (r === "bench" || r === "panchina" || r === "on_the_bench") {
          benchStreak++; maxBench = Math.max(maxBench, benchStreak); startStreak = 0;
        } else if (r === "starter" || r === "titolare" || r === "starting_xv") {
          startStreak++; maxStart = Math.max(maxStart, startStreak); benchStreak = 0;
        } else {
          benchStreak = 0; startStreak = 0; convocAll = false;
        }
      }
      if (maxBench >= 5) award(pid, "bench");
      if (maxBench >= 10) award(pid, "bomb_squad");
      if (maxStart >= 5) award(pid, "king");
      if (maxStart >= 10) award(pid, "super_king");
      if (convocAll && catMatches.length > 0) award(pid, "ironman");

      // Attendance — by month between starts_at and ends_at
      const pAbsences = (absences || []).filter((a: any) => a.player_id === pid);
      // Build month buckets (YYYY-MM)
      const start = new Date(season.starts_at);
      const end = new Date(season.ends_at);
      const months: string[] = [];
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
        cur.setMonth(cur.getMonth() + 1);
      }
      const today = new Date();
      const absByMonth: Record<string, number> = {};
      pAbsences.forEach((a: any) => {
        const ym = a.training_date.slice(0, 7);
        absByMonth[ym] = (absByMonth[ym] || 0) + 1;
      });
      // A month "qualifies" if it's fully past and has 0 absences
      const monthFlags = months.map((ym) => {
        const [y, mm] = ym.split("-").map(Number);
        const monthEnd = new Date(y, mm, 0); // last day
        if (monthEnd > today) return null;
        return (absByMonth[ym] || 0) === 0;
      });
      if (monthFlags.some((f) => f === true)) award(pid, "roccia");
      let consec = 0, maxConsec = 0;
      for (const f of monthFlags) {
        if (f === true) { consec++; maxConsec = Math.max(maxConsec, consec); }
        else if (f === false) consec = 0;
      }
      if (maxConsec >= 3) award(pid, "muro");

      // scudo: approximation — % months without absences >= 0.95
      const closed = monthFlags.filter((f) => f !== null);
      if (closed.length > 0) {
        const ok = closed.filter((f) => f === true).length;
        if (ok / closed.length >= 0.95) award(pid, "scudo");
      }
    }

    // Insert with conflict ignore (UNIQUE)
    let inserted = 0;
    if (toInsert.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error, data } = await supabase
          .from("player_badges")
          .upsert(chunk, { onConflict: "player_id,badge_key,season_id", ignoreDuplicates: true })
          .select("id");
        if (error) console.error("upsert error", error);
        else inserted += data?.length || 0;
      }
    }

    totalEvaluated += players.length;
    totalInserted += inserted;
    totalCandidates += toInsert.length;
    perCrew.push({ crew: crew.slug, evaluated: players.length, inserted, candidates: toInsert.length });
    } // end for crews

    return json({ ok: true, evaluated: totalEvaluated, inserted: totalInserted, candidates: totalCandidates, perCrew });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}