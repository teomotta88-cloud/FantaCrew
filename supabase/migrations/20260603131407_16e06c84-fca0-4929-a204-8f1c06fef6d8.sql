
CREATE OR REPLACE FUNCTION public.create_crew_as_admin(
  _name text,
  _slug text,
  _sport_id uuid,
  _primary_color text DEFAULT NULL,
  _logo_url text DEFAULT NULL
) RETURNS TABLE(crew_id uuid, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_id uuid;
  _code text;
  _clean_slug text;
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

  RETURN QUERY SELECT _new_id, _code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_crew_as_admin(text, text, uuid, text, text) TO authenticated;
