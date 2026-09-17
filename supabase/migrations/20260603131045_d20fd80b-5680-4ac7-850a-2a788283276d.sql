
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_crew_invite_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE code text; tries int := 0;
BEGIN
  LOOP
    code := upper(substring(replace(encode(gen_random_bytes(8), 'base64'), '/', '') || replace(md5(random()::text), '/', ''), 1, 8));
    code := regexp_replace(code, '[^A-Z0-9]', 'X', 'g');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.crews WHERE invite_code = code);
    tries := tries + 1;
    IF tries > 10 THEN RAISE EXCEPTION 'Could not generate unique invite code'; END IF;
  END LOOP;
  RETURN code;
END; $$;

CREATE OR REPLACE FUNCTION public.set_crew_invite_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := public.generate_crew_invite_code();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_crew_invite_code ON public.crews;
CREATE TRIGGER trg_set_crew_invite_code
BEFORE INSERT ON public.crews
FOR EACH ROW EXECUTE FUNCTION public.set_crew_invite_code();

UPDATE public.crews SET invite_code = 'LAMBRO2026'
WHERE id = '06e48abb-42c9-45c0-b35b-9a0a8468c939' AND invite_code IS NULL;

UPDATE public.crews SET invite_code = public.generate_crew_invite_code()
WHERE invite_code IS NULL;

ALTER TABLE public.crews ALTER COLUMN invite_code SET NOT NULL;

CREATE OR REPLACE FUNCTION public.join_crew_by_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _crew_id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN RAISE EXCEPTION 'Invite code required'; END IF;
  SELECT id INTO _crew_id FROM public.crews WHERE upper(invite_code) = upper(trim(_code)) LIMIT 1;
  IF _crew_id IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.crew_user_roles (crew_id, user_id, role)
  VALUES (_crew_id, _uid, 'manager')
  ON CONFLICT DO NOTHING;
  RETURN _crew_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.join_crew_by_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text; _crew_id uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'manager');

  IF EXISTS (SELECT 1 FROM public.super_admin_seeds WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  _code := NEW.raw_user_meta_data->>'invite_code';
  IF _code IS NOT NULL AND length(trim(_code)) > 0 THEN
    SELECT id INTO _crew_id FROM public.crews WHERE upper(invite_code) = upper(trim(_code)) LIMIT 1;
    IF _crew_id IS NOT NULL THEN
      INSERT INTO public.crew_user_roles (crew_id, user_id, role)
      VALUES (_crew_id, NEW.id, 'manager') ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

INSERT INTO public.crew_user_roles (crew_id, user_id, role)
SELECT '06e48abb-42c9-45c0-b35b-9a0a8468c939'::uuid, u.id, 'manager'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.crew_user_roles cur WHERE cur.user_id = u.id)
ON CONFLICT DO NOTHING;
