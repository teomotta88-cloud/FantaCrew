ALTER TABLE public.scoring_rules DROP CONSTRAINT IF EXISTS scoring_rules_applies_to_check;
ALTER TABLE public.scoring_rules ADD CONSTRAINT scoring_rules_applies_to_check
  CHECK (applies_to = ANY (ARRAY['player'::text, 'coach'::text, 'both'::text, 'team'::text]));

CREATE TABLE public.challenges (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id   UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  challenged_id   UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  week            INTEGER     NOT NULL,
  season_id       UUID        REFERENCES public.seasons(id),
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','completed')),
  winner_id       UUID        REFERENCES public.teams(id),
  bonus_points    INTEGER     NOT NULL DEFAULT 50,
  challenger_pts  INTEGER,
  challenged_pts  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  UNIQUE (challenger_id, week, season_id)
);

GRANT SELECT ON public.challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.challenges FOR SELECT USING (true);

CREATE POLICY "Manager insert own" ON public.challenges FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams WHERE id = challenger_id AND manager_id = auth.uid())
  );

CREATE POLICY "Admin all" ON public.challenges FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.scoring_rules (key, label, points, is_malus, sort_order, applies_to, is_active)
VALUES ('challenge_win', 'Vittoria sfida 1v1', 50, false, 99, 'team', true)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label;