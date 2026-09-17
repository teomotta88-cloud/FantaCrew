
-- 1) current_crew_id senza fallback Lambro
CREATE OR REPLACE FUNCTION public.current_crew_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT id FROM public.crews WHERE slug = public.current_crew_slug() LIMIT 1
$$;

-- 2) Drop default Lambro UUID da tutte le colonne crew_id
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema='public' AND column_name='crew_id'
      AND column_default LIKE '%06e48abb-42c9-45c0-b35b-9a0a8468c939%'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN crew_id DROP DEFAULT', r.table_schema, r.table_name);
  END LOOP;
END $$;

-- 3) player_categories: globalmente leggibili (essendo i nomi unique globally,
-- tutti i crew condividono lo stesso vocabolario di categorie)
DROP POLICY IF EXISTS "Categories crew read" ON public.player_categories;
CREATE POLICY "Categories readable by all authenticated"
  ON public.player_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- 4) create_crew_as_admin: seed dei dati di default + admin_permissions super per il creator
CREATE OR REPLACE FUNCTION public.create_crew_as_admin(
  _name text, _slug text, _sport_id uuid,
  _primary_color text DEFAULT NULL, _logo_url text DEFAULT NULL
)
RETURNS TABLE(crew_id uuid, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
  _code text;
  _clean_slug text;
  _template uuid := '06e48abb-42c9-45c0-b35b-9a0a8468c939'::uuid; -- Lambro come template
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF _slug IS NULL OR length(trim(_slug)) = 0 THEN RAISE EXCEPTION 'Slug required'; END IF;
  IF _sport_id IS NULL THEN RAISE EXCEPTION 'Sport required'; END IF;

  _clean_slug := lower(regexp_replace(trim(_slug), '[^a-z0-9]+', '-', 'g'));
  _clean_slug := regexp_replace(_clean_slug, '(^-+|-+$)', '', 'g');

  IF EXISTS (SELECT 1 FROM public.crews WHERE slug = _clean_slug) THEN
    RAISE EXCEPTION 'Slug già utilizzato';
  END IF;

  INSERT INTO public.crews (name, slug, sport_id, primary_color, logo_url, owner_user_id)
  VALUES (trim(_name), _clean_slug, _sport_id, _primary_color, _logo_url, _uid)
  RETURNING id, crews.invite_code INTO _new_id, _code;

  -- crew_user_roles
  INSERT INTO public.crew_user_roles (crew_id, user_id, role)
  VALUES (_new_id, _uid, 'admin')
  ON CONFLICT DO NOTHING;

  -- ruolo globale admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- admin_permissions: super admin per questo crew (sblocca tutte le tab)
  INSERT INTO public.admin_permissions (user_id, crew_id, is_super_admin, created_by)
  VALUES (_uid, _new_id, true, _uid)
  ON CONFLICT (user_id) DO UPDATE SET is_super_admin = true, crew_id = EXCLUDED.crew_id;

  -- Seed scoring_rules dal template Lambro
  INSERT INTO public.scoring_rules (crew_id, key, label, points, is_malus, sort_order, applies_to, is_active, score_type)
  SELECT _new_id, key, label, points, is_malus, sort_order, applies_to, is_active, score_type
  FROM public.scoring_rules WHERE crew_id = _template
  ON CONFLICT DO NOTHING;

  -- Seed team_config dal template
  INSERT INTO public.team_config (crew_id, key, value, label, group_name, sort_order)
  SELECT _new_id, key, value, label, group_name, sort_order
  FROM public.team_config WHERE crew_id = _template
  ON CONFLICT DO NOTHING;

  -- Seed una stagione attiva per il nuovo crew
  INSERT INTO public.seasons (crew_id, name, starts_at, ends_at, is_active, is_archived)
  VALUES (_new_id, '2025/2026', '2025-09-01'::date, '2026-06-30'::date, true, false);

  RETURN QUERY SELECT _new_id, _code;
END;
$function$;

-- 5) Backfill admin_permissions per i creator dei club esistenti (rms, rsd)
INSERT INTO public.admin_permissions (user_id, crew_id, is_super_admin, created_by)
SELECT c.owner_user_id, c.id, true, c.owner_user_id
FROM public.crews c
WHERE c.owner_user_id IS NOT NULL
  AND c.slug <> 'lambro'
ON CONFLICT (user_id) DO UPDATE SET is_super_admin = true;

-- 6) Backfill seed defaults per i crew esistenti non-Lambro
INSERT INTO public.scoring_rules (crew_id, key, label, points, is_malus, sort_order, applies_to, is_active, score_type)
SELECT c.id, sr.key, sr.label, sr.points, sr.is_malus, sr.sort_order, sr.applies_to, sr.is_active, sr.score_type
FROM public.crews c
CROSS JOIN public.scoring_rules sr
WHERE sr.crew_id = '06e48abb-42c9-45c0-b35b-9a0a8468c939'
  AND c.slug <> 'lambro'
ON CONFLICT DO NOTHING;

-- team_config ha PK su key (non per crew). Esistono già righe Lambro; per crew nuovi si potrà
-- gestire a parte. Skip per evitare conflitti.
