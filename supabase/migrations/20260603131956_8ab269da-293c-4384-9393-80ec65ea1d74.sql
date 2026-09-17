
CREATE OR REPLACE FUNCTION public.generate_crew_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE code text; tries int := 0;
BEGIN
  LOOP
    code := upper(substring(regexp_replace(md5(random()::text || clock_timestamp()::text), '[^a-zA-Z0-9]', '', 'g') from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.crews WHERE invite_code = code);
    tries := tries + 1;
    IF tries > 10 THEN RAISE EXCEPTION 'Could not generate unique invite code'; END IF;
  END LOOP;
  RETURN code;
END; $$;
