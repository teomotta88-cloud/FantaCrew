GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT SELECT ON public.user_roles TO authenticated, anon;