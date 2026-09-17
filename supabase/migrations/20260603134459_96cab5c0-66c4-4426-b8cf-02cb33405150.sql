-- Re-attach handle_new_user trigger to auth.users (needed so invite_code metadata is honored)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: for any existing auth user that signed up with an invite_code in metadata
-- but is not yet linked to that crew, link them now as manager.
INSERT INTO public.crew_user_roles (crew_id, user_id, role)
SELECT c.id, u.id, 'manager'
FROM auth.users u
JOIN public.crews c
  ON upper(c.invite_code) = upper(trim(u.raw_user_meta_data->>'invite_code'))
WHERE u.raw_user_meta_data->>'invite_code' IS NOT NULL
  AND length(trim(u.raw_user_meta_data->>'invite_code')) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.crew_user_roles cur
    WHERE cur.user_id = u.id AND cur.crew_id = c.id
  );

-- Ensure every auth user has a profile row (some may be missing if trigger wasn't attached)
INSERT INTO public.profiles (id, display_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Ensure every auth user has at least the manager role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'manager'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'manager'::app_role);