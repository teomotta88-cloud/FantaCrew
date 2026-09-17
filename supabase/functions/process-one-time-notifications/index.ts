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
  const nowIso = new Date().toISOString();
  const { data: due } = await supabase
    .from("notification_templates")
    .select("id")
    .eq("type", "one_time")
    .eq("is_active", true)
    .is("sent_at", null)
    .lte("scheduled_at", nowIso);

  let dispatched = 0;
  for (const t of due || []) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
      body: JSON.stringify({ templateId: t.id }),
    });
    if (r.ok) {
      await supabase.from("notification_templates").update({ sent_at: new Date().toISOString() }).eq("id", t.id);
      dispatched++;
    }
  }
  return new Response(JSON.stringify({ ok: true, dispatched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});