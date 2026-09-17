
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'manager');
CREATE TYPE public.player_category AS ENUM ('U16', 'U18', 'Seniores');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Roles viewable by everyone" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- AUTO PROFILE + MANAGER ROLE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'manager');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PLAYERS
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  photo_url TEXT,
  category player_category NOT NULL,
  role TEXT NOT NULL,
  weight_kg INTEGER,
  height_cm INTEGER,
  value_zaghetti INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players viewable by everyone" ON public.players FOR SELECT USING (true);
CREATE POLICY "Admins manage players" ON public.players FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SCORING RULES (data-driven)
CREATE TABLE public.scoring_rules (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  points INTEGER NOT NULL,
  is_malus BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rules viewable by everyone" ON public.scoring_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage rules" ON public.scoring_rules FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.scoring_rules (key, label, points, is_malus, sort_order) VALUES
  ('training_attendance', 'Presenza allenamento', 2, false, 1),
  ('match_call_up', 'Convocazione partita', 3, false, 2),
  ('starting_xv', 'Titolare (XV)', 5, false, 3),
  ('on_the_bench', 'In panchina', 2, false, 4),
  ('try_scored', 'Meta segnata', 10, false, 5),
  ('penalty_kick', 'Calcio di punizione', 4, false, 6),
  ('drop_goal', 'Drop', 6, false, 7),
  ('motm', 'Man of the Match', 15, false, 8),
  ('training_absence', 'Assenza allenamento', -3, true, 9),
  ('merdtm', 'Merd of the Match 💩', -10, true, 10);

-- WEEKLY EVENTS
CREATE TABLE public.weekly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL REFERENCES public.scoring_rules(key) ON DELETE CASCADE,
  season TEXT NOT NULL DEFAULT '2025/2026',
  week INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events viewable by everyone" ON public.weekly_events FOR SELECT USING (true);
CREATE POLICY "Admins manage events" ON public.weekly_events FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SPECIAL ACTIONS
CREATE TABLE public.special_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL,
  season TEXT NOT NULL DEFAULT '2025/2026',
  week INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.special_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Special actions viewable by everyone" ON public.special_actions FOR SELECT USING (true);
CREATE POLICY "Admins manage special actions" ON public.special_actions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.special_action_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.special_actions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(action_id, player_id)
);
ALTER TABLE public.special_action_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Completions viewable by everyone" ON public.special_action_completions FOR SELECT USING (true);
CREATE POLICY "Admins manage completions" ON public.special_action_completions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- LEAGUES
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substring(md5(random()::text) from 1 for 6)),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leagues viewable by everyone" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Authenticated create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner update league" ON public.leagues FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner delete league" ON public.leagues FOR DELETE USING (auth.uid() = owner_id);

CREATE TABLE public.league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members viewable by everyone" ON public.league_members FOR SELECT USING (true);
CREATE POLICY "Users join leagues" ON public.league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave leagues" ON public.league_members FOR DELETE USING (auth.uid() = user_id);

-- TEAMS (one squad per manager, optionally tied to a league)
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  captain_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  season TEXT NOT NULL DEFAULT '2025/2026',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(manager_id, season)
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams viewable by everyone" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Manager creates own team" ON public.teams FOR INSERT WITH CHECK (auth.uid() = manager_id);
CREATE POLICY "Manager updates own team" ON public.teams FOR UPDATE USING (auth.uid() = manager_id);
CREATE POLICY "Manager deletes own team" ON public.teams FOR DELETE USING (auth.uid() = manager_id);

CREATE TABLE public.team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  UNIQUE(team_id, player_id)
);
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team players viewable by everyone" ON public.team_players FOR SELECT USING (true);
CREATE POLICY "Manager edits own team roster" ON public.team_players FOR ALL USING (
  EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.manager_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.manager_id = auth.uid())
);

-- LEAGUE TEAMS link (which teams are in which league)
CREATE TABLE public.league_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  UNIQUE(league_id, team_id)
);
ALTER TABLE public.league_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "League teams viewable by everyone" ON public.league_teams FOR SELECT USING (true);
CREATE POLICY "Manager links own team" ON public.league_teams FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.manager_id = auth.uid())
);
CREATE POLICY "Manager unlinks own team" ON public.league_teams FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.manager_id = auth.uid())
);

-- PLAYER SCORES VIEW (events + special actions with duplicate penalty)
CREATE OR REPLACE VIEW public.player_scores AS
WITH event_pts AS (
  SELECT we.player_id, SUM(we.quantity * sr.points)::int AS pts
  FROM public.weekly_events we
  JOIN public.scoring_rules sr ON sr.key = we.rule_key
  GROUP BY we.player_id
),
action_completion_counts AS (
  SELECT action_id, COUNT(*) AS cnt FROM public.special_action_completions GROUP BY action_id
),
action_pts AS (
  SELECT sac.player_id,
    SUM(CASE WHEN acc.cnt > 1 THEN -sa.points ELSE sa.points END)::int AS pts
  FROM public.special_action_completions sac
  JOIN public.special_actions sa ON sa.id = sac.action_id
  JOIN action_completion_counts acc ON acc.action_id = sac.action_id
  GROUP BY sac.player_id
)
SELECT p.id AS player_id,
  COALESCE(e.pts, 0) + COALESCE(a.pts, 0) AS total_points
FROM public.players p
LEFT JOIN event_pts e ON e.player_id = p.id
LEFT JOIN action_pts a ON a.player_id = p.id;

-- STORAGE bucket for player photos (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('player-photos', 'player-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Player photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'player-photos');
CREATE POLICY "Admins upload player photos" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins update player photos" ON storage.objects FOR UPDATE USING (
  bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins delete player photos" ON storage.objects FOR DELETE USING (
  bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin')
);
