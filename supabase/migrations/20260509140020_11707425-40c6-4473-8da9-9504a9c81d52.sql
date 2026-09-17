
CREATE TABLE IF NOT EXISTS public.team_player_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  season text NOT NULL DEFAULT '2025/2026',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tph_team ON public.team_player_history(team_id);
CREATE INDEX IF NOT EXISTS idx_tph_player ON public.team_player_history(player_id);
CREATE INDEX IF NOT EXISTS idx_tph_open ON public.team_player_history(team_id, player_id) WHERE left_at IS NULL;

ALTER TABLE public.team_player_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "History viewable by everyone"
  ON public.team_player_history FOR SELECT USING (true);

CREATE POLICY "Manager edits own team history"
  ON public.team_player_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_player_history.team_id AND t.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_player_history.team_id AND t.manager_id = auth.uid()));

CREATE POLICY "Admins manage history"
  ON public.team_player_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Backfill from existing rosters
INSERT INTO public.team_player_history (team_id, player_id, joined_at, left_at, season)
SELECT tp.team_id, tp.player_id, t.created_at, NULL, COALESCE(t.season, '2025/2026')
FROM public.team_players tp
JOIN public.teams t ON t.id = tp.team_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_player_history h
  WHERE h.team_id = tp.team_id AND h.player_id = tp.player_id AND h.left_at IS NULL
);
