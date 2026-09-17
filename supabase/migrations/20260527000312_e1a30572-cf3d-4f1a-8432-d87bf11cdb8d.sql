ALTER TABLE public.team_player_history
ADD COLUMN IF NOT EXISTS transfer_type TEXT NOT NULL DEFAULT 'free'
  CHECK (transfer_type IN ('free', 'mandatory', 'initial'));

UPDATE public.team_player_history
SET transfer_type = 'initial'
WHERE transfer_type = 'free';

CREATE TABLE public.transfer_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  transfer_type TEXT        NOT NULL DEFAULT 'free'
                            CHECK (transfer_type IN ('free', 'mandatory', 'initial')),
  season_id     UUID        REFERENCES public.seasons(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfer_sessions TO authenticated;
GRANT ALL ON public.transfer_sessions TO service_role;

ALTER TABLE public.transfer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager reads own sessions"
  ON public.transfer_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.manager_id = auth.uid()
  ));

CREATE POLICY "Manager inserts own sessions"
  ON public.transfer_sessions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.manager_id = auth.uid()
  ));

CREATE POLICY "Admin all"
  ON public.transfer_sessions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_transfer_sessions_team_saved ON public.transfer_sessions(team_id, saved_at DESC);