
CREATE TABLE public.coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  category public.player_category NOT NULL,
  value_zaghetti INTEGER NOT NULL DEFAULT 5,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coaches viewable by everyone" ON public.coaches FOR SELECT USING (true);
CREATE POLICY "Admins manage coaches" ON public.coaches FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "User claims matching coach" ON public.coaches FOR UPDATE TO authenticated
  USING (user_id IS NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(trim(p.display_name)) = lower(trim(coaches.full_name))))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(trim(p.display_name)) = lower(trim(coaches.full_name))));
CREATE POLICY "User releases own coach claim" ON public.coaches FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE TABLE public.team_coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  UNIQUE (team_id, coach_id)
);
ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team coaches viewable by everyone" ON public.team_coaches FOR SELECT USING (true);
CREATE POLICY "Manager edits own team coaches" ON public.team_coaches FOR ALL
  USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_coaches.team_id AND t.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_coaches.team_id AND t.manager_id = auth.uid()));

CREATE TABLE public.coach_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  rule_key TEXT NOT NULL,
  week INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  match_id UUID,
  season TEXT NOT NULL DEFAULT '2025/2026',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach events viewable by everyone" ON public.coach_events FOR SELECT USING (true);
CREATE POLICY "Admins manage coach events" ON public.coach_events FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.coach_scores AS
SELECT c.id AS coach_id,
  COALESCE(SUM(ce.quantity * sr.points)::integer, 0) AS total_points
FROM public.coaches c
LEFT JOIN public.coach_events ce ON ce.coach_id = c.id
LEFT JOIN public.scoring_rules sr ON sr.key = ce.rule_key
GROUP BY c.id;

ALTER TABLE public.matches ADD COLUMN coach_id UUID;

INSERT INTO public.scoring_rules (key, label, points, is_malus, sort_order) VALUES
  ('coach_match_win', 'Vittoria partita (Allenatore)', 8, false, 100),
  ('coach_match_loss', 'Sconfitta partita (Allenatore)', -5, true, 101),
  ('linesman_call', 'Convocazione come guardalinee', 2, false, 102)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.team_config (key, label, value, group_name, sort_order) VALUES
  ('coaches_required', 'Allenatori richiesti', 1, 'general', 10)
ON CONFLICT (key) DO NOTHING;
