import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categoryPattern = /^[A-Za-z0-9 _\-]{1,40}$/;

function json(body: { error?: string; ok?: boolean }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requiredString(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key)?.toString().trim() ?? "";
  if (!value || value.length > maxLength) throw new Error(`${key} non valido`);
  return value;
}

function optionalNumber(formData: FormData, key: string, min: number, max: number) {
  const raw = formData.get(key)?.toString().trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key} non valido`);
  return Math.round(value);
}

export const Route = createFileRoute("/api/public/admin/players")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
            return json({ error: "Backend non configurato correttamente." }, 500);
          }

          const authHeader = request.headers.get("authorization") ?? "";
          const crewSlug = (request.headers.get("x-crew-slug") ?? "").trim();
          if (!crewSlug || !/^[a-z0-9-]{1,60}$/.test(crewSlug)) {
            return json({ error: "Crew non specificato." }, 400);
          }
          if (!authHeader.startsWith("Bearer ")) return json({ error: "Devi accedere per salvare un giocatore." }, 401);

          const token = authHeader.replace("Bearer ", "");
          const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}`, "x-crew-slug": crewSlug } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            global: { headers: { "x-crew-slug": crewSlug } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
          const userId = claimsData?.claims?.sub;
          if (claimsError || !userId) return json({ error: "Sessione non valida: esci e rientra." }, 401);

          const { data: adminRole, error: roleError } = await adminClient
            .from("user_roles")
            .select("id")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();
          if (roleError) return json({ error: "Impossibile verificare il ruolo admin." }, 500);
          if (!adminRole) return json({ error: "Il tuo account non ha il ruolo admin attivo." }, 403);

          const formData = await request.formData();
          const id = formData.get("id")?.toString().trim() ?? "";
          if (id && !uuidPattern.test(id)) return json({ error: "Giocatore non valido." }, 400);

          const full_name = requiredString(formData, "full_name", 120);
          const category = requiredString(formData, "category", 40);
          if (!categoryPattern.test(category)) return json({ error: "Categoria non valida." }, 400);

          const role = requiredString(formData, "role", 80);
          const weight_kg = optionalNumber(formData, "weight_kg", 20, 250);
          const height_cm = optionalNumber(formData, "height_cm", 80, 250);
          const value_zaghetti = optionalNumber(formData, "value_zaghetti", 0, 999) ?? 5;
          let photo_url = formData.get("existing_photo_url")?.toString() || null;

          const photo = formData.get("photo");
          if (photo && typeof photo !== "string" && photo.size > 0) {
            if (!photo.type.startsWith("image/") || photo.size > 8 * 1024 * 1024) {
              return json({ error: "La foto deve essere un'immagine sotto gli 8 MB." }, 400);
            }

            const ext = photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
            const path = `${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await adminClient.storage
              .from("player-photos")
              .upload(path, new Uint8Array(await photo.arrayBuffer()), {
                contentType: photo.type || "image/jpeg",
                upsert: true,
              });
            if (uploadError) return json({ error: "Errore caricamento foto: " + uploadError.message }, 500);
            photo_url = adminClient.storage.from("player-photos").getPublicUrl(path).data.publicUrl;
          }

          // Risolvi crew_id dal slug (header) per impostarlo esplicitamente sull'insert.
          const { data: crewRow, error: crewErr } = await adminClient
            .from("crews")
            .select("id")
            .eq("slug", crewSlug)
            .maybeSingle();
          if (crewErr || !crewRow) return json({ error: "Crew non trovato." }, 400);

          const payload = { full_name, category, role, weight_kg, height_cm, value_zaghetti, photo_url, crew_id: crewRow.id };
          const { error: saveError } = id
            ? await adminClient.from("players").update(payload).eq("id", id).eq("crew_id", crewRow.id)
            : await adminClient.from("players").insert(payload);
          if (saveError) return json({ error: "Errore salvataggio giocatore: " + saveError.message }, 500);

          return json({ ok: true });
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Errore imprevisto." }, 400);
        }
      },
    },
  },
});