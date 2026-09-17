import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { eventTrigger, category } = await req.json();
    if (!eventTrigger) return new Response(JSON.stringify({ error: "eventTrigger required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: templates } = await supabase
      .from("notification_templates")
      .select("id, push_title, push_body, push_url, audience, crew_id")
      .eq("type", "event_triggered")
      .eq("event_trigger", eventTrigger)
      .eq("is_active", true);

    let dispatched = 0;
    for (const t of templates || []) {
      const tplCrew = (t as any).crew_id || null;
      let userIds: string[] | null = null;
      if (category) {
        // Resolve coaches of that category, scoped to the template's crew
        let q = supabase.from("coaches").select("user_id").eq("category", category).not("user_id", "is", null);
        if (tplCrew) q = q.eq("crew_id", tplCrew);
        const { data: coaches } = await q;
        userIds = (coaches || []).map((c: any) => c.user_id).filter(Boolean);
      }
      const body: any = userIds
        ? { title: (t as any).push_title, body: (t as any).push_body, url: (t as any).push_url, audience: "user_ids", user_ids: userIds, crew_id: tplCrew }
        : { templateId: t.id };
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
        body: JSON.stringify(body),
      });
      if (r.ok) dispatched++;
      else console.error("send-push failed", await r.text());
    }
    return new Response(JSON.stringify({ ok: true, dispatched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("process-event-notifications error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});