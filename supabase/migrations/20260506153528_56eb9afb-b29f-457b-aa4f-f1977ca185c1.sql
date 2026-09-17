CREATE OR REPLACE FUNCTION public.assign_admin_role(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF user_id_param IS NULL THEN
    RAISE EXCEPTION 'user_id_param is required';
  END IF;

  IF auth.uid() <> user_id_param AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can assign admin role to another user';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (user_id_param, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists boolean;
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role
  ) INTO admin_exists;

  IF admin_exists THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;