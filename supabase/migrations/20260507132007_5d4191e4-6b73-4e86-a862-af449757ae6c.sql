CREATE TABLE public.leaderboard_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL,
  week integer NOT NULL,
  season text NOT NULL DEFAULT '2025/2026',
  rank integer NOT NULL,
  total_points integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_id, week, season)
);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Snapshots viewable by everyone"
ON public.leaderboard_snapshots FOR SELECT USING (true);

CREATE POLICY "Admins manage snapshots"
ON public.leaderboard_snapshots FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_leaderboard_snapshots_week ON public.leaderboard_snapshots(season, week);