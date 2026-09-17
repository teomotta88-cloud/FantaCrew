CREATE OR REPLACE FUNCTION public.join_crew_by_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _crew_id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RAISE EXCEPTION 'Invite code required';
  END IF;

  SELECT id INTO _crew_id
  FROM public.crews
  WHERE upper(invite_code) = upper(trim(_code))
  LIMIT 1;

  IF _crew_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  DELETE FROM public.crew_user_roles
  WHERE user_id = _uid
    AND role IN ('manager', 'team_manager')
    AND crew_id <> _crew_id;

  INSERT INTO public.crew_user_roles (crew_id, user_id, role)
  VALUES (_crew_id, _uid, 'manager')
  ON CONFLICT DO NOTHING;

  RETURN _crew_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_crew_by_invite(text) TO authenticated;