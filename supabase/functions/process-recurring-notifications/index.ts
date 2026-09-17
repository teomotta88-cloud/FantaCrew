import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Lightweight cron parser. Supports: *, exact int, comma list, */n, ranges a-b
function parseField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    let step = 1;
    let range = part;
    if (part.includes("/")) {
      const [r, s] = part.split("/");
      range = r;
      step = parseInt(s, 10) || 1;
    }
    let lo = min, hi = max;
    if (range !== "*") {
      if (range.includes("-")) {
        const [a, b] = range.split("-").map((x) => parseInt(x, 10));
        lo = a; hi = b;
      } else {
        lo = hi = parseInt(range, 10);
      }
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

function cronMatches(expr: string, now: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  try {
    const m = parseField(parts[0], 0, 59);
    const h = parseField(parts[1], 0, 23);
    const dom = parseField(parts[2], 1, 31);
    const mon = parseField(parts[3], 1, 12);
    const dow = parseField(parts[4], 0, 6);
    return m.has(now.getUTCMinutes()) && h.has(now.getUTCHours()) &&
           dom.has(now.getUTCDate()) && mon.has(now.getUTCMonth() + 1) &&
           dow.has(now.getUTCDay());
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const now = new Date();
  const { data: templates } = await supabase
    .from("notification_templates")
    .select("id,cron_expression")
    .eq("type", "recurring")
    .eq("is_active", true);

  let dispatched = 0;
  for (const t of templates || []) {
    if (!t.cron_expression || !cronMatches(t.cron_expression, now)) continue;
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
      body: JSON.stringify({ templateId: t.id }),
    });
    if (r.ok) dispatched++;
  }
  return new Response(JSON.stringify({ ok: true, dispatched, checked: templates?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});