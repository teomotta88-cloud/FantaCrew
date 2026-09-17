
-- 1) sports
CREATE TABLE public.sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports TO anon, authenticated;
GRANT ALL ON public.sports TO service_role;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sports public read" ON public.sports FOR SELECT USING (true);
CREATE POLICY "Super admin manage sports" ON public.sports FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.sports (name, slug, icon) VALUES ('Rugby', 'rugby', '🏉');

-- 2) crews
CREATE TABLE public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sport_id uuid NOT NULL REFERENCES public.sports(id),
  logo_url text,
  primary_color text,
  owner_user_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crews TO anon, authenticated;
GRANT ALL ON public.crews TO service_role;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crews public read" ON public.crews FOR SELECT USING (true);
CREATE POLICY "Super admin manage crews" ON public.crews FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.crews (name, slug, sport_id, primary_color)
SELECT 'Lambro', 'lambro', id, '#1a5d3a' FROM public.sports WHERE slug = 'rugby';

-- 3) crew_user_roles
CREATE TABLE public.crew_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','manager','team_manager')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, user_id, role)
);
GRANT SELECT ON public.crew_user_roles TO authenticated;
GRANT ALL ON public.crew_user_roles TO service_role;
ALTER TABLE public.crew_user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew roles read own or super" ON public.crew_user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admin manage crew roles" ON public.crew_user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 4) super_admin_seeds
CREATE TABLE public.super_admin_seeds (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admin_seeds TO authenticated;
GRANT ALL ON public.super_admin_seeds TO service_role;
ALTER TABLE public.super_admin_seeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin manage seeds" ON public.super_admin_seeds FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.super_admin_seeds (email) VALUES ('teo.motta88@gmail.com');

-- 5) handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'manager');

  IF EXISTS (SELECT 1 FROM public.super_admin_seeds WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u WHERE lower(u.email) = 'teo.motta88@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u WHERE lower(u.email) = 'teo.motta88@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 6) Aggiungi crew_id a tutte le tabelle (con default inlineato)
DO $$
DECLARE
  lambro_id uuid;
  tbl text;
  tables text[] := ARRAY[
    'players','player_categories','teams','team_players','team_coaches',
    'team_player_history','coaches','coach_events','matches','match_call_ups',
    'weekly_events','special_actions','special_action_completions','mandatory_slots',
    'team_penalties','seasons','scoring_rules','trainings','training_schedules',
    'training_absences','training_absence_reads','leagues','league_members','league_teams',
    'challenges','leaderboard_snapshots','season_results','season_player_results',
    'transfer_sessions','role_assignment_history','team_config','team_manager_assignments',
    'admin_permissions','badge_definitions','player_badges',
    'notification_templates','notification_log','notification_history'
  ];
BEGIN
  SELECT id INTO lambro_id FROM public.crews WHERE slug = 'lambro';

  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES public.crews(id)', tbl);
    EXECUTE format('UPDATE public.%I SET crew_id = %L WHERE crew_id IS NULL', tbl, lambro_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN crew_id SET DEFAULT %L', tbl, lambro_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN crew_id SET NOT NULL', tbl);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_crew_id ON public.%I(crew_id)', tbl, tbl);
  END LOOP;

  UPDATE public.crews SET owner_user_id = u.id
  FROM auth.users u
  WHERE lower(u.email) = 'teo.motta88@gmail.com' AND crews.slug = 'lambro';
END $$;

-- 7) helpers
CREATE OR REPLACE FUNCTION public.crew_id_from_slug(_slug text)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public
AS $$ SELECT id FROM public.crews WHERE slug = _slug LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'super_admin'::app_role) $$;
