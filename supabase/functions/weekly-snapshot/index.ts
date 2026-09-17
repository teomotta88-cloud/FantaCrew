import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEASON = "2025/2026";
const SEASON_START_DATE = "2025-09-01"; // Monday-aligned season start (UTC)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const start = new Date(SEASON_START_DATE + "T00:00:00Z").getTime();
    const now = Date.now();
    const week = Math.max(1, Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1);

    const { data: crews } = await supabase.from("crews").select("id,slug").eq("is_active", true);
    let totalSnapshotted = 0;
    const perCrew: any[] = [];

    for (const crew of (crews || [])) {
      const crewId = crew.id;
      const [{ data: teams }, { data: tp }, { data: history }, { data: weekly }, { data: rules }, { data: matchesData }, { data: comps }, { data: actions }, { data: tc }, { data: cscores }, { data: cfg }, { data: slots }, { data: penalties }] = await Promise.all([
        supabase.from("teams").select("id,name,manager_id,captain_player_id,talisman_player_id,silverback_player_id,captain_changed_at,talisman_changed_at,silverback_changed_at").eq("crew_id", crewId),
        supabase.from("team_players").select("team_id,player_id").eq("crew_id", crewId),
        supabase.from("team_player_history").select("team_id,player_id,joined_at,left_at").eq("crew_id", crewId),
        supabase.from("weekly_events").select("player_id,rule_key,quantity,match_id,created_at").eq("crew_id", crewId),
        supabase.from("scoring_rules").select("key,points").eq("is_active", true).eq("crew_id", crewId),
        supabase.from("matches").select("id,match_date").eq("crew_id", crewId),
        supabase.from("special_action_completions").select("action_id,player_id,created_at").not("player_id", "is", null).eq("crew_id", crewId),
        supabase.from("special_actions").select("id,points").eq("crew_id", crewId),
        supabase.from("team_coaches").select("team_id,coach_id").eq("crew_id", crewId),
        supabase.from("coach_scores").select("coach_id,total_points"),
        supabase.from("team_config").select("key,value").eq("crew_id", crewId).in("key", ["multiplier_captain", "multiplier_talisman", "multiplier_silverback"]),
        supabase.from("mandatory_slots").select("eligible_player_ids,starts_at,ends_at").eq("crew_id", crewId).lte("starts_at", new Date().toISOString()).gte("ends_at", new Date().toISOString()),
        supabase.from("team_penalties").select("team_id,points").eq("crew_id", crewId),
      ]);

    const cfgMap = new Map((cfg || []).map((r: any) => [r.key, r.value]));
    const mCap = cfgMap.get("multiplier_captain") ?? 2;
    const mTal = cfgMap.get("multiplier_talisman") ?? 4;
    const mSil = cfgMap.get("multiplier_silverback") ?? 5;

    // Build per-player windowed event list
    const ruleMap = new Map((rules || []).map((r: any) => [r.key, r.points]));
    const matchDate = new Map((matchesData || []).map((m: any) => [m.id, new Date(m.match_date + "T12:00:00Z").getTime()]));
    const playerEvents = new Map<string, { ts: number; pts: number }[]>();
    const push = (pid: string, ts: number, pts: number) => {
      if (!playerEvents.has(pid)) playerEvents.set(pid, []);
      playerEvents.get(pid)!.push({ ts, pts });
    };
    for (const we of (weekly || [])) {
      const pts = (ruleMap.get(we.rule_key) || 0) * (we.quantity || 0);
      if (!pts) continue;
      const ts = (we.match_id && matchDate.get(we.match_id)) || new Date(we.created_at).getTime();
      push(we.player_id, ts, pts);
    }
    const counts = new Map<string, number>();
    for (const c of (comps || [])) counts.set(c.action_id, (counts.get(c.action_id) || 0) + 1);
    const actionPts = new Map((actions || []).map((a: any) => [a.id, a.points]));
    for (const c of (comps || [])) {
      const base = actionPts.get(c.action_id) || 0;
      const pts = (counts.get(c.action_id) || 0) > 1 ? -base : base;
      if (!pts) continue;
      push(c.player_id, new Date(c.created_at).getTime(), pts);
    }
    const sumWindow = (pid: string, joined: number, left: number | null) => {
      const arr = playerEvents.get(pid);
      if (!arr) return 0;
      let s = 0;
      for (const e of arr) if (e.ts >= joined && (left === null || e.ts <= left)) s += e.pts;
      return s;
    };
    const histByTeam = new Map<string, any[]>();
    (history || []).forEach((h: any) => { if (!histByTeam.has(h.team_id)) histByTeam.set(h.team_id, []); histByTeam.get(h.team_id)!.push(h); });

    const coachScoreMap = new Map((cscores || []).map((s: any) => [s.coach_id, s.total_points || 0]));
    const tpByTeam = new Map<string, string[]>();
    (tp || []).forEach((r: any) => { if (!tpByTeam.has(r.team_id)) tpByTeam.set(r.team_id, []); tpByTeam.get(r.team_id)!.push(r.player_id); });
    const tcByTeam = new Map<string, string[]>();
    (tc || []).forEach((r: any) => { if (!tcByTeam.has(r.team_id)) tcByTeam.set(r.team_id, []); tcByTeam.get(r.team_id)!.push(r.coach_id); });
    const penByTeam = new Map<string, number>();
    (penalties || []).forEach((r: any) => { penByTeam.set(r.team_id, (penByTeam.get(r.team_id) || 0) + (r.points || 0)); });

    const activeSlots = (slots || []) as any[];
    const rows = (teams || []).filter((t: any) => {
      const ids = new Set(tpByTeam.get(t.id) || []);
      return activeSlots.every((s) => (s.eligible_player_ids || []).some((pid: string) => ids.has(pid)));
    }).map((t: any) => {
      const captainSetAt = t.captain_changed_at ? new Date(t.captain_changed_at).getTime() : 0;
      const talismanSetAt = t.talisman_changed_at ? new Date(t.talisman_changed_at).getTime() : 0;
      const silverbackSetAt = t.silverback_changed_at ? new Date(t.silverback_changed_at).getTime() : 0;
      let total = 0;
      for (const h of histByTeam.get(t.id) || []) {
        const joined = new Date(h.joined_at).getTime();
        const left = h.left_at ? new Date(h.left_at).getTime() : null;
        const base = sumWindow(h.player_id, joined, left);
        if (h.left_at === null && h.player_id === t.silverback_player_id) {
          const after = sumWindow(h.player_id, Math.max(joined, silverbackSetAt), left);
          total += (base - after) + after * mSil;
        } else if (h.left_at === null && h.player_id === t.talisman_player_id) {
          const after = sumWindow(h.player_id, Math.max(joined, talismanSetAt), left);
          total += (base - after) + after * mTal;
        } else if (h.left_at === null && h.player_id === t.captain_player_id) {
          const after = sumWindow(h.player_id, Math.max(joined, captainSetAt), left);
          total += (base - after) + after * mCap;
        } else {
          total += base;
        }
      }
      const cids = tcByTeam.get(t.id) || [];
      for (const cid of cids) total += coachScoreMap.get(cid) || 0;
      total += penByTeam.get(t.id) || 0;
      return { team_id: t.id, total };
    }).sort((a, b) => b.total - a.total);

    const payload = rows.map((r, i) => ({
      team_id: r.team_id,
      week,
      season: SEASON,
      rank: i + 1,
      total_points: r.total,
      crew_id: crewId,
    }));

    if (payload.length) {
      const { error } = await supabase
        .from("leaderboard_snapshots")
        .upsert(payload, { onConflict: "team_id,week,season" });
      if (error) throw error;
      totalSnapshotted += payload.length;
      perCrew.push({ crew: crew.slug, snapshotted: payload.length });
    }
    } // end for crews

    // Fire event-triggered notifications
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-event-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "" },
        body: JSON.stringify({ eventTrigger: "snapshot_saved" }),
      });
    } catch (e) { console.error("notify failed", e); }

    return new Response(
      JSON.stringify({ ok: true, week, season: SEASON, snapshotted: totalSnapshotted, perCrew }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});