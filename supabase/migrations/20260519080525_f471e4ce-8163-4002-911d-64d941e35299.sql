CREATE TABLE public.role_assignment_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('captain', 'talisman', 'silverback')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at  TIMESTAMPTZ,
  season_id   UUID        REFERENCES public.seasons(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rah_team_id   ON public.role_assignment_history(team_id);
CREATE INDEX idx_rah_player_id ON public.role_assignment_history(player_id);

ALTER TABLE public.role_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"
  ON public.role_assignment_history FOR SELECT USING (true);

CREATE POLICY "Manager edits own"
  ON public.role_assignment_history FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.manager_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND t.manager_id = auth.uid()
  ));

CREATE POLICY "Admins full access"
  ON public.role_assignment_history FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.role_assignment_history (team_id, player_id, role, assigned_at, removed_at, season_id)
SELECT t.id, t.captain_player_id, 'captain', t.created_at, NULL, t.season_id
FROM public.teams t
WHERE t.captain_player_id IS NOT NULL;

INSERT INTO public.role_assignment_history (team_id, player_id, role, assigned_at, removed_at, season_id)
SELECT t.id, t.talisman_player_id, 'talisman', t.created_at, NULL, t.season_id
FROM public.teams t
WHERE t.talisman_player_id IS NOT NULL;

INSERT INTO public.role_assignment_history (team_id, player_id, role, assigned_at, removed_at, season_id)
SELECT t.id, t.silverback_player_id, 'silverback', t.created_at, NULL, t.season_id
FROM public.teams t
WHERE t.silverback_player_id IS NOT NULL;