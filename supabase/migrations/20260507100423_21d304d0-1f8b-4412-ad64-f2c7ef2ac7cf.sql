
-- New scoring rules
INSERT INTO public.scoring_rules (key,label,points,is_malus,sort_order) VALUES
  ('match_win','Vittoria partita',5,false,11),
  ('match_loss','Sconfitta partita',-3,true,12)
ON CONFLICT (key) DO NOTHING;

-- Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season text NOT NULL DEFAULT '2025/2026',
  category text NOT NULL,
  match_date date NOT NULL,
  week integer NOT NULL,
  opponent text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | won | lost | draw
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='matches' AND policyname='Matches viewable by everyone') THEN
    CREATE POLICY "Matches viewable by everyone" ON public.matches FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='matches' AND policyname='Admins manage matches') THEN
    CREATE POLICY "Admins manage matches" ON public.matches FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
  END IF;
END $$;

-- Call-ups
CREATE TABLE IF NOT EXISTS public.match_call_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  squad_role text NOT NULL DEFAULT 'starter', -- starter | bench
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);
ALTER TABLE public.match_call_ups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='match_call_ups' AND policyname='Call-ups viewable by everyone') THEN
    CREATE POLICY "Call-ups viewable by everyone" ON public.match_call_ups FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='match_call_ups' AND policyname='Admins manage call-ups') THEN
    CREATE POLICY "Admins manage call-ups" ON public.match_call_ups FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
  END IF;
END $$;

-- Link weekly_events to a match (optional)
ALTER TABLE public.weekly_events ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_weekly_events_match_id ON public.weekly_events(match_id);
