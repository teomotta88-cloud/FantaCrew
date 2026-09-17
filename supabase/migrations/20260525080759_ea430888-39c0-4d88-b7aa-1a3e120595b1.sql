
-- 1. training_schedules
CREATE TABLE public.training_schedules (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT    NOT NULL REFERENCES public.player_categories(name) ON UPDATE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME,
  location    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  season_id   UUID    REFERENCES public.seasons(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, day_of_week, season_id)
);

ALTER TABLE public.training_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Training schedules public read"
  ON public.training_schedules FOR SELECT USING (true);

CREATE POLICY "Training schedules admin write"
  ON public.training_schedules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. trainings (generated instances)
CREATE TABLE IF NOT EXISTS public.trainings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL REFERENCES public.player_categories(name) ON UPDATE CASCADE,
  training_date DATE NOT NULL,
  start_time    TIME,
  location      TEXT,
  season_id     UUID REFERENCES public.seasons(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, training_date)
);

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainings public read"
  ON public.trainings FOR SELECT USING (true);

CREATE POLICY "Trainings admin write"
  ON public.trainings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Seed Seniores
INSERT INTO public.training_schedules (category, day_of_week)
SELECT 'Seniores', d FROM unnest(ARRAY[2,4,5]) AS d
WHERE EXISTS (SELECT 1 FROM public.player_categories WHERE name = 'Seniores')
ON CONFLICT DO NOTHING;

-- 4. Cron: yearly Aug 25 02:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'generate-trainings-yearly',
  '0 2 25 8 *',
  $$
  SELECT net.http_post(
    url := 'https://jpgjyxhlhtrtzcrulluz.supabase.co/functions/v1/generate-trainings',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZ2p5eGhsaHRydHpjcnVsbHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzQ1OTUsImV4cCI6MjA5MzY1MDU5NX0.0Qaz20Ggb2TF-ipCzvYc1angros1_wIYrnneCkArALk"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
