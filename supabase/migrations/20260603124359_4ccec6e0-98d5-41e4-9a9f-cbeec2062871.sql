
-- 1) Make scoring_rules per-crew
ALTER TABLE public.weekly_events DROP CONSTRAINT IF EXISTS weekly_events_rule_key_fkey;
ALTER TABLE public.scoring_rules DROP CONSTRAINT IF EXISTS scoring_rules_pkey;
ALTER TABLE public.scoring_rules ADD CONSTRAINT scoring_rules_pkey PRIMARY KEY (crew_id, key);
ALTER TABLE public.weekly_events
  ADD CONSTRAINT weekly_events_rule_key_fkey
  FOREIGN KEY (crew_id, rule_key) REFERENCES public.scoring_rules(crew_id, key) ON DELETE CASCADE;

-- Trigger to auto-populate crew_id from x-crew-slug header on inserts
DROP TRIGGER IF EXISTS trg_scoring_rules_set_crew ON public.scoring_rules;
CREATE TRIGGER trg_scoring_rules_set_crew
BEFORE INSERT ON public.scoring_rules
FOR EACH ROW EXECUTE FUNCTION public.set_crew_id_from_context();

-- 2) Sport-level template for scoring rules
CREATE TABLE IF NOT EXISTS public.sport_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  is_malus boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'player' CHECK (applies_to IN ('player','coach','both','team')),
  is_active boolean NOT NULL DEFAULT true,
  score_type text NOT NULL DEFAULT 'bonus' CHECK (score_type IN ('bonus','malus','club')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sport_id, key)
);

GRANT SELECT ON public.sport_scoring_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sport_scoring_rules TO authenticated;
GRANT ALL ON public.sport_scoring_rules TO service_role;

ALTER TABLE public.sport_scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sport rules public read"
ON public.sport_scoring_rules FOR SELECT USING (true);

CREATE POLICY "Super admin manage sport rules"
ON public.sport_scoring_rules FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Seed rugby template from Lambro's currently active rules
INSERT INTO public.sport_scoring_rules
  (sport_id, key, label, points, is_malus, sort_order, applies_to, is_active, score_type)
SELECT s.id, sr.key, sr.label, sr.points, sr.is_malus, sr.sort_order, sr.applies_to, sr.is_active, sr.score_type
FROM public.scoring_rules sr
CROSS JOIN public.sports s
WHERE sr.crew_id = '06e48abb-42c9-45c0-b35b-9a0a8468c939'::uuid
  AND sr.is_active = true
  AND s.slug = 'rugby'
ON CONFLICT (sport_id, key) DO NOTHING;

-- 4) Seed new crews from their sport's template
CREATE OR REPLACE FUNCTION public.seed_crew_scoring_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.scoring_rules
    (crew_id, key, label, points, is_malus, sort_order, applies_to, is_active, score_type)
  SELECT NEW.id, t.key, t.label, t.points, t.is_malus, t.sort_order, t.applies_to, t.is_active, t.score_type
  FROM public.sport_scoring_rules t
  WHERE t.sport_id = NEW.sport_id
  ON CONFLICT (crew_id, key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_crew_scoring_rules ON public.crews;
CREATE TRIGGER trg_seed_crew_scoring_rules
AFTER INSERT ON public.crews
FOR EACH ROW EXECUTE FUNCTION public.seed_crew_scoring_rules();
