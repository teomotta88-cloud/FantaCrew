CREATE TABLE public.team_config (
  key text PRIMARY KEY,
  value integer NOT NULL,
  label text NOT NULL,
  group_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.team_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Config viewable by everyone"
ON public.team_config FOR SELECT USING (true);

CREATE POLICY "Admins manage config"
ON public.team_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.team_config (key, value, label, group_name, sort_order) VALUES
  ('budget', 100, 'Budget Zaghetti', 'general', 1),
  ('squad_size', 22, 'Numero giocatori squadra', 'general', 2),
  ('min_U16', 7, 'Minimo U16', 'category', 10),
  ('min_U18', 7, 'Minimo U18', 'category', 11),
  ('min_Seniores', 7, 'Minimo Seniores', 'category', 12),
  ('group_Mischia', 12, 'Mischia', 'role', 20),
  ('group_Mediano di mischia', 2, 'Mediano di mischia', 'role', 21),
  ('group_Mediano di apertura', 2, 'Mediano di apertura', 'role', 22),
  ('group_Trequarti', 6, 'Trequarti', 'role', 23);
