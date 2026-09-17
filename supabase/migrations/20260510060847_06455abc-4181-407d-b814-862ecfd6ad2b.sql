
-- Seasons table
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active season at a time
CREATE UNIQUE INDEX seasons_one_active_idx ON public.seasons (is_active) WHERE is_active = true;

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons viewable by everyone" ON public.seasons FOR SELECT USING (true);
CREATE POLICY "Admins manage seasons" ON public.seasons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed current season
INSERT INTO public.seasons (name, starts_at, ends_at, is_active, is_archived)
VALUES ('2025/2026', '2025-08-25', '2026-07-31', true, false);

-- Season results (final team standings)
CREATE TABLE public.season_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  team_name text NOT NULL,
  manager_name text,
  final_rank integer NOT NULL,
  final_points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, team_id)
);

ALTER TABLE public.season_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Season results viewable by everyone" ON public.season_results FOR SELECT USING (true);
CREATE POLICY "Admins manage season results" ON public.season_results FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Season player results (final player rankings)
CREATE TABLE public.season_player_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  full_name text NOT NULL,
  category text NOT NULL,
  final_rank integer NOT NULL,
  final_points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (season_id, player_id)
);

ALTER TABLE public.season_player_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Season player results viewable by everyone" ON public.season_player_results FOR SELECT USING (true);
CREATE POLICY "Admins manage season player results" ON public.season_player_results FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add season_id to existing season-scoped tables
ALTER TABLE public.teams ADD COLUMN season_id uuid REFERENCES public.seasons(id);
ALTER TABLE public.weekly_events ADD COLUMN season_id uuid REFERENCES public.seasons(id);
ALTER TABLE public.special_actions ADD COLUMN season_id uuid REFERENCES public.seasons(id);
ALTER TABLE public.leaderboard_snapshots ADD COLUMN season_id uuid REFERENCES public.seasons(id);
ALTER TABLE public.team_player_history ADD COLUMN season_id_ref uuid REFERENCES public.seasons(id);
ALTER TABLE public.zaghetti_history ADD COLUMN season_id uuid REFERENCES public.seasons(id);
ALTER TABLE public.mandatory_slots ADD COLUMN season_id uuid REFERENCES public.seasons(id);
ALTER TABLE public.coach_events ADD COLUMN season_id uuid REFERENCES public.seasons(id);

-- Backfill all existing rows to the current active season
DO $$
DECLARE
  current_season_id uuid;
BEGIN
  SELECT id INTO current_season_id FROM public.seasons WHERE is_active = true LIMIT 1;

  UPDATE public.teams SET season_id = current_season_id WHERE season_id IS NULL;
  UPDATE public.weekly_events SET season_id = current_season_id WHERE season_id IS NULL;
  UPDATE public.special_actions SET season_id = current_season_id WHERE season_id IS NULL;
  UPDATE public.leaderboard_snapshots SET season_id = current_season_id WHERE season_id IS NULL;
  UPDATE public.team_player_history SET season_id_ref = current_season_id WHERE season_id_ref IS NULL;
  UPDATE public.zaghetti_history SET season_id = current_season_id WHERE season_id IS NULL;
  UPDATE public.mandatory_slots SET season_id = current_season_id WHERE season_id IS NULL;
  UPDATE public.coach_events SET season_id = current_season_id WHERE season_id IS NULL;
END $$;

-- Default player value config
INSERT INTO public.team_config (key, value, label, group_name, sort_order)
VALUES ('default_player_value', 5, 'Valore Zaghetti default', 'general', 100)
ON CONFLICT (key) DO NOTHING;
