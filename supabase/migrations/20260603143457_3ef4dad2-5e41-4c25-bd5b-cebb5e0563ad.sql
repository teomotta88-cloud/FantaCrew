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
  _template uuid := '06e48abb-42c9-45c0-b35b-9a0a8468c939'::uuid;
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

  INSERT INTO public.crew_user_roles (crew_id, user_id, role)
  VALUES (_new_id, _uid, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_permissions (user_id, crew_id, is_super_admin, created_by)
  VALUES (_uid, _new_id, true, _uid)
  ON CONFLICT (user_id) DO UPDATE SET is_super_admin = true, crew_id = EXCLUDED.crew_id;

  INSERT INTO public.scoring_rules (crew_id, key, label, points, is_malus, sort_order, applies_to, is_active, score_type)
  SELECT _new_id, sr.key, sr.label, sr.points, sr.is_malus, sr.sort_order, sr.applies_to, sr.is_active, sr.score_type
  FROM public.scoring_rules sr WHERE sr.crew_id = _template
  ON CONFLICT DO NOTHING;

  INSERT INTO public.team_config (crew_id, key, value, label, group_name, sort_order)
  SELECT _new_id, tc.key, tc.value, tc.label, tc.group_name, tc.sort_order
  FROM public.team_config tc WHERE tc.crew_id = _template
  ON CONFLICT DO NOTHING;

  INSERT INTO public.seasons (crew_id, name, starts_at, ends_at, is_active, is_archived)
  VALUES (_new_id, '2025/2026', '2025-09-01'::date, '2026-06-30'::date, true, false);

  RETURN QUERY SELECT _new_id, _code;
END;
$function$;