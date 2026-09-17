import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PENALTY_POINTS = -50;
const SEASON = "2025/2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const nowIso = new Date().toISOString();
    const in6hIso = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    const { data: crews } = await supabase.from("crews").select("id,slug").eq("is_active", true);
    const summary: any = { penalized: 0, compliant: 0, slots_processed: 0, warnings_sent: 0 };

    for (const crew of (crews || [])) {
      const crewId = crew.id;
      const [{ data: teams }, { data: tp }] = await Promise.all([
        supabase.from("teams").select("id,name,manager_id").eq("season", SEASON).eq("crew_id", crewId),
        supabase.from("team_players").select("team_id,player_id").eq("crew_id", crewId),
      ]);
    const tpByTeam = new Map<string, Set<string>>();
    (tp || []).forEach((r: any) => {
      if (!tpByTeam.has(r.team_id)) tpByTeam.set(r.team_id, new Set());
      tpByTeam.get(r.team_id)!.add(r.player_id);
    });

    // 1) 6h warnings — slots ending within next 6h, warning not yet sent
    const { data: warnSlots } = await supabase
      .from("mandatory_slots")
      .select("id,title,ends_at,eligible_player_ids,warning_sent,penalties_applied")
      .eq("crew_id", crewId)
      .eq("warning_sent", false)
      .eq("penalties_applied", false)
      .lte("ends_at", in6hIso)
      .gt("ends_at", nowIso);

    for (const slot of (warnSlots || []) as any[]) {
      const eligible = new Set<string>(slot.eligible_player_ids || []);
      const nonCompliantManagers: string[] = [];
      for (const t of (teams || []) as any[]) {
        const ids = tpByTeam.get(t.id) || new Set();
        const ok = [...eligible].some((pid) => ids.has(pid));
        if (!ok && t.manager_id) nonCompliantManagers.push(t.manager_id);
      }
      if (nonCompliantManagers.length) {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
            body: JSON.stringify({
              title: "⚠️ 6 ore alla penalità!",
              body: `Hai ancora 6 ore per rispettare l'obbligatorietà "${slot.title}". Dopo perderai 50 punti!`,
              url: "/team",
              audience: "user_ids",
              user_ids: nonCompliantManagers,
            }),
          });
        } catch (e) { console.error("warn push failed", e); }
      }
      await supabase.from("mandatory_slots").update({ warning_sent: true } as any).eq("id", slot.id);
      summary.warnings_sent++;
      // Also fire admin-configurable event-triggered template (audience: invalid_teams)
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/process-event-notifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "" },
          body: JSON.stringify({ eventTrigger: "mandatory_expiry_warning" }),
        });
      } catch (e) { console.error("event notify failed", e); }
    }

    // 2) Apply penalties — slots that have ended, no penalties yet
    const { data: expired } = await supabase
      .from("mandatory_slots")
      .select("id,title,ends_at,eligible_player_ids,penalties_applied")
      .eq("crew_id", crewId)
      .eq("penalties_applied", false)
      .lte("ends_at", nowIso);

    for (const slot of (expired || []) as any[]) {
      summary.slots_processed++;
      const eligible = new Set<string>(slot.eligible_player_ids || []);
      const rows: any[] = [];
      const penalizedManagers: string[] = [];
      for (const t of (teams || []) as any[]) {
        const ids = tpByTeam.get(t.id) || new Set();
        const ok = [...eligible].some((pid) => ids.has(pid));
        if (ok) { summary.compliant++; continue; }
        rows.push({
          team_id: t.id,
          mandatory_slot_id: slot.id,
          points: PENALTY_POINTS,
          reason: `Obbligatorietà non rispettata — ${slot.title}`,
          season: SEASON,
          crew_id: crewId,
        });
        if (t.manager_id) penalizedManagers.push(t.manager_id);
        summary.penalized++;
      }
      if (rows.length) {
        const { error } = await supabase.from("team_penalties").upsert(rows, { onConflict: "team_id,mandatory_slot_id" });
        if (error) { console.error("penalty insert failed", error); continue; }
      }
      await supabase.from("mandatory_slots").update({ penalties_applied: true } as any).eq("id", slot.id);
      // Notify penalized managers
      if (penalizedManagers.length) {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
            body: JSON.stringify({
              title: "❌ Penalità applicata",
              body: `-50 punti per obbligatorietà non rispettata (${slot.title}).`,
              url: "/team",
              audience: "user_ids",
              user_ids: penalizedManagers,
            }),
          });
        } catch (e) { console.error("penalty push failed", e); }
      }
    }
    } // end for crews

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});