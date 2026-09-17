// @ts-ignore deno
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@fantalambro.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE); } catch (e) { console.error("VAPID setup", e); }
}

async function getAudienceUserIds(audience: string, explicitIds?: string[], crewId?: string | null): Promise<string[] | null> {
  if (audience === "user_ids") return explicitIds && explicitIds.length ? explicitIds : [];
  if (audience === "all") {
    // If crew-scoped, restrict "all" to users that have a team in that crew OR are coaches in that crew
    if (crewId) {
      const [{ data: teams }, { data: coaches }] = await Promise.all([
        supabase.from("teams").select("manager_id").eq("crew_id", crewId),
        supabase.from("coaches").select("user_id").eq("crew_id", crewId).not("user_id", "is", null),
      ]);
      const ids = new Set<string>();
      (teams || []).forEach((t: any) => t.manager_id && ids.add(t.manager_id));
      (coaches || []).forEach((c: any) => c.user_id && ids.add(c.user_id));
      return Array.from(ids);
    }
    return null; // all subscriptions
  }
  let teamsQ = supabase.from("teams").select("manager_id,id");
  if (crewId) teamsQ = teamsQ.eq("crew_id", crewId);
  const { data: teams } = await teamsQ;
  if (!teams) return [];
  if (audience === "active_team" || audience === "active_teams") return teams.map((t: any) => t.manager_id);
  if (audience === "invalid_team" || audience === "invalid_teams") {
    const nowIso = new Date().toISOString();
    let slotsQ = supabase
      .from("mandatory_slots")
      .select("eligible_player_ids,starts_at,ends_at")
      .lte("starts_at", nowIso).gte("ends_at", nowIso);
    if (crewId) slotsQ = slotsQ.eq("crew_id", crewId);
    const { data: slots } = await slotsQ;
    if (!slots || slots.length === 0) return [];
    const invalid: string[] = [];
    for (const t of teams) {
      const { data: tp } = await supabase.from("team_players").select("player_id").eq("team_id", t.id);
      const pids = new Set((tp || []).map((r: any) => r.player_id));
      const ok = slots.every((s: any) => (s.eligible_player_ids || []).some((pid: string) => pids.has(pid)));
      if (!ok) invalid.push(t.manager_id);
    }
    return invalid;
  }
  return [];
}

async function sendNow(record: { id?: string; template_id?: string | null; title: string; body: string; url: string | null; audience: string; user_ids?: string[] | null; crew_id?: string | null }) {
  const userIds = await getAudienceUserIds(record.audience, record.user_ids || undefined, record.crew_id || null);
  let q = supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth,user_id");
  if (userIds !== null) {
    if (userIds.length === 0) {
      if (record.id) await supabase.from("notification_history").update({ sent_at: new Date().toISOString(), delivery_count: 0 }).eq("id", record.id);
      await supabase.from("notification_log").insert({
        template_id: record.template_id || null,
        audience: record.audience, recipient_count: 0, success_count: 0, failure_count: 0,
        payload: { title: record.title, body: record.body, url: record.url },
        crew_id: record.crew_id || undefined,
      });
      return { delivered: 0, total: 0 };
    }
    q = q.in("user_id", userIds);
  }
  const { data: subs } = await q;
  const payload = JSON.stringify({ title: record.title, body: record.body, url: record.url || "/" });
  let delivered = 0;
  const stale: string[] = [];
  let failed = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: (s as any).endpoint, keys: { p256dh: (s as any).p256dh, auth: (s as any).auth } },
        payload,
      );
      delivered++;
    } catch (e: any) {
      console.error("push failed", (s as any).endpoint, e?.statusCode, e?.message);
      failed++;
      if (e?.statusCode === 404 || e?.statusCode === 410) stale.push((s as any).id);
    }
  }
  if (stale.length) await supabase.from("push_subscriptions").delete().in("id", stale);
  if (record.id) await supabase.from("notification_history").update({ sent_at: new Date().toISOString(), delivery_count: delivered }).eq("id", record.id);
  await supabase.from("notification_log").insert({
    template_id: record.template_id || null,
    audience: record.audience,
    recipient_count: subs?.length || 0,
    success_count: delivered,
    failure_count: failed,
    payload: { title: record.title, body: record.body, url: record.url },
    crew_id: record.crew_id || undefined,
  });
  return { delivered, total: subs?.length || 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron mode: dispatch any due scheduled notifications
    if (req.method === "GET" || req.headers.get("x-cron") === "1") {
      const { data: due } = await supabase
        .from("notification_history")
        .select("*")
        .is("sent_at", null)
        .lte("scheduled_for", new Date().toISOString());
      let total = 0;
      for (const rec of due || []) {
        const r = await sendNow(rec as any);
        total += r.delivered;
      }
      return new Response(JSON.stringify({ ok: true, dispatched: due?.length || 0, delivered: total }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { templateId, title: rawTitle, body: rawBody, url: rawUrl, audience: rawAud = "all", scheduled_for, user_ids, crew_id: rawCrewId } = body;
    let title = rawTitle, text = rawBody, url = rawUrl, audience = rawAud, template_id: string | null = null;
    let crew_id: string | null = rawCrewId || null;
    if (templateId) {
      const { data: tpl, error: tplErr } = await supabase.from("notification_templates").select("*").eq("id", templateId).single();
      if (tplErr || !tpl) return new Response(JSON.stringify({ error: "template not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      title = tpl.push_title; text = tpl.push_body; url = tpl.push_url; audience = tpl.audience; template_id = tpl.id;
      crew_id = (tpl as any).crew_id || crew_id;
    }
    if (!title || !text) {
      return new Response(JSON.stringify({ error: "title and body required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isFuture = scheduled_for && new Date(scheduled_for).getTime() > Date.now();
    if (isFuture) {
      const { data: inserted, error } = await supabase.from("notification_history").insert({
        title, body: text, url: url || null, audience,
        scheduled_for: scheduled_for || null,
        crew_id: crew_id || undefined,
      }).select("*").single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, scheduled: true, id: inserted.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendNow({ template_id, title, body: text, url: url || null, audience, user_ids: user_ids || null, crew_id });
    return new Response(JSON.stringify({ ok: true, sent: result.delivered, failed: (result.total - result.delivered) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});