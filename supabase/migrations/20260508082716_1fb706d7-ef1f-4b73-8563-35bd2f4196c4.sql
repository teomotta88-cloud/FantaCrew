
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS captain_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS talisman_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS silverback_changed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.zaghetti_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  season text NOT NULL DEFAULT '2025/2026',
  old_value int NOT NULL,
  new_value int NOT NULL,
  delta int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, month, season)
);

ALTER TABLE public.zaghetti_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zaghetti history viewable by everyone"
  ON public.zaghetti_history FOR SELECT USING (true);

CREATE POLICY "Admins manage zaghetti history"
  ON public.zaghetti_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_zaghetti_history_player ON public.zaghetti_history(player_id, season, month DESC);

INSERT INTO public.team_config (key, group_name, label, value, sort_order)
VALUES ('multiplier_silverback', 'Moltiplicatori', 'Moltiplicatore Silverback', 5, 30)
ON CONFLICT (key) DO NOTHING;
