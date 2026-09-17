REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.assign_admin_role(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_admin_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;