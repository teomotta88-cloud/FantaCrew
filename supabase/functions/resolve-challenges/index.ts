import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Inline copy of weekOf logic from src/lib/week.ts (edge functions
// can't import from src/). Keep these two in sync.
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function utcMidnight(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function computeCurrentWeek(seasonStart: string): number {
  const startMs = utcMidnight(seasonStart);
  const nowMs = utcMidnight(new Date());
  const days = Math.floor((nowMs - startMs) / MS_PER_DAY);
  return Math.max(1, Math.floor(days / 7) + 1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: crews } = await supabase.from("crews").select("id,slug").eq("is_active", true);
    let totalResolved = 0;
    const perCrew: any[] = [];

    for (const crew of (crews || [])) {
      const crewId = crew.id;
      // 1. Active season per crew
      const { data: season } = await supabase.from("seasons").select("id,starts_at").eq("crew_id", crewId).eq("is_active", true).maybeSingle();
      if (!season) { perCrew.push({ crew: crew.slug, skipped: "no active season" }); continue; }
      const currentWeek = computeCurrentWeek(season.starts_at);

      // 2. Fetch active challenges for this week
      const { data: challenges } = await supabase
      .from("challenges")
      .select("id,challenger_id,challenged_id,bonus_points")
      .eq("crew_id", crewId)
      .eq("week", currentWeek)
      .eq("season_id", season.id)
      .eq("status", "active");

    if (!challenges || challenges.length === 0) {
      perCrew.push({ crew: crew.slug, week: currentWeek, resolved: 0 });
      continue;
    }

    // 3. Load weekly_events for currentWeek + scoring rules + history + role history + cfg
    const [
      { data: weekly },
      { data: rules },
      { data: history },
      { data: roleHistory },
      { data: cfg },
      { data: bonusRule },
    ] = await Promise.all([
      supabase
        .from("weekly_events")
        .select("player_id,rule_key,quantity,created_at")
        .eq("crew_id", crewId)
        .eq("week", currentWeek)
        .eq("season_id", season.id),
      supabase.from("scoring_rules").select("key,points").eq("crew_id", crewId).eq("is_active", true),
      supabase.from("team_player_history").select("team_id,player_id,joined_at,left_at").eq("crew_id", crewId),
      supabase.from("role_assignment_history").select("team_id,player_id,role,assigned_at,removed_at").eq("crew_id", crewId),
      supabase
        .from("team_config")
        .select("key,value")
        .eq("crew_id", crewId)
        .in("key", ["multiplier_captain", "multiplier_talisman", "multiplier_silverback"]),
      supabase.from("scoring_rules").select("points").eq("crew_id", crewId).eq("key", "challenge_win").maybeSingle(),
    ]);

    const cfgMap = new Map((cfg || []).map((r: any) => [r.key, r.value]));
    const mCap = Number(cfgMap.get("multiplier_captain") ?? 2);
    const mTal = Number(cfgMap.get("multiplier_talisman") ?? 4);
    const mSil = Number(cfgMap.get("multiplier_silverback") ?? 5);

    const ruleMap = new Map((rules || []).map((r: any) => [r.key, r.points]));

    // Per-player events for this week
    type Evt = { ts: number; pts: number };
    const playerEvents = new Map<string, Evt[]>();
    for (const we of weekly || []) {
      const pts = (ruleMap.get(we.rule_key) || 0) * (we.quantity || 0);
      if (!pts) continue;
      const ts = new Date(we.created_at).getTime();
      if (!playerEvents.has(we.player_id)) playerEvents.set(we.player_id, []);
      playerEvents.get(we.player_id)!.push({ ts, pts });
    }

    function teamWeekScore(teamId: string): number {
      const histRows = (history || []).filter((h: any) => h.team_id === teamId);
      let total = 0;
      for (const h of histRows) {
        const joined = new Date(h.joined_at).getTime();
        const left = h.left_at ? new Date(h.left_at).getTime() : null;
        const events = playerEvents.get(h.player_id) || [];
        const roleWindows = (roleHistory || [])
          .filter((r: any) => r.team_id === teamId && r.player_id === h.player_id)
          .map((r: any) => ({
            assigned_at: new Date(r.assigned_at).getTime(),
            removed_at: r.removed_at ? new Date(r.removed_at).getTime() : null,
            multiplier: r.role === "captain" ? mCap : r.role === "talisman" ? mTal : r.role === "silverback" ? mSil : 1,
          }));
        for (const e of events) {
          if (e.ts < joined) continue;
          if (left !== null && e.ts > left) continue;
          let mult = 1;
          for (const w of roleWindows) {
            if (e.ts >= w.assigned_at && (w.removed_at === null || e.ts <= w.removed_at)) {
              mult = w.multiplier;
              break;
            }
          }
          total += e.pts * mult;
        }
      }
      return total;
    }

    const bonusPoints = Number((bonusRule as any)?.points ?? 50);

    let resolved = 0;
    for (const ch of challenges) {
      const cPts = teamWeekScore(ch.challenger_id);
      const dPts = teamWeekScore(ch.challenged_id);
      let winner: string | null = null;
      if (cPts > dPts) winner = ch.challenger_id;
      else if (dPts > cPts) winner = ch.challenged_id;

      const { error: upErr } = await supabase
        .from("challenges")
        .update({
          status: "completed",
          challenger_pts: cPts,
          challenged_pts: dPts,
          winner_id: winner,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", ch.id);
      if (upErr) {
        console.error("update challenge failed", ch.id, upErr);
        continue;
      }

      if (winner) {
        const { error: penErr } = await supabase.from("team_penalties").insert({
          team_id: winner,
          points: bonusPoints,
          reason: `Vittoria sfida 1v1 (settimana ${currentWeek})`,
          crew_id: crewId,
        });
        if (penErr) console.error("bonus insert failed", winner, penErr);
      }
      resolved++;
    }
    totalResolved += resolved;
    perCrew.push({ crew: crew.slug, week: currentWeek, resolved });
    } // end for crews

    // After resolving challenges (and inserting bonuses), take the leaderboard snapshot
    // so it includes challenge bonus points in the rankings
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/weekly-snapshot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        },
        body: "{}",
      });
    } catch (snapErr) {
      console.error("weekly-snapshot call failed", snapErr);
      // Non-fatal: resolve-challenges still succeeded
    }

    return new Response(JSON.stringify({ ok: true, resolved: totalResolved, perCrew }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
