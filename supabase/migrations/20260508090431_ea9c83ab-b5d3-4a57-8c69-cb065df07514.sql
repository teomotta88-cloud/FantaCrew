
ALTER TABLE public.mandatory_slots
  ADD COLUMN IF NOT EXISTS penalties_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warning_sent boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.team_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  mandatory_slot_id uuid REFERENCES public.mandatory_slots(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  season text NOT NULL DEFAULT '2025/2026',
  applied_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, mandatory_slot_id)
);

ALTER TABLE public.team_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Penalties viewable by everyone" ON public.team_penalties FOR SELECT USING (true);
CREATE POLICY "Admins manage penalties" ON public.team_penalties FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_team_penalties_team ON public.team_penalties(team_id);
CREATE INDEX IF NOT EXISTS idx_team_penalties_slot ON public.team_penalties(mandatory_slot_id);
