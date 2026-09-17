-- 1. Add team_manager to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_manager';

-- 2. Create team_manager_assignments table
CREATE TABLE IF NOT EXISTS public.team_manager_assignments (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT  NOT NULL,
  created_by  UUID  NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.team_manager_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage TM assignments" ON public.team_manager_assignments;
CREATE POLICY "Admins manage TM assignments"
  ON public.team_manager_assignments FOR ALL
  USING  (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "TM reads own assignment" ON public.team_manager_assignments;
CREATE POLICY "TM reads own assignment"
  ON public.team_manager_assignments FOR SELECT
  USING (auth.uid() = user_id);

-- 3. TM scoped RLS — weekly_events
DROP POLICY IF EXISTS "TM manages own category events" ON public.weekly_events;
CREATE POLICY "TM manages own category events"
  ON public.weekly_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.team_manager_assignments tma
      JOIN public.players p ON p.id = weekly_events.player_id
      WHERE tma.user_id = auth.uid() AND tma.category = p.category
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_manager_assignments tma
      JOIN public.players p ON p.id = weekly_events.player_id
      WHERE tma.user_id = auth.uid() AND tma.category = p.category
    )
  );

-- 4. TM scoped RLS — matches
DROP POLICY IF EXISTS "TM manages own category matches" ON public.matches;
CREATE POLICY "TM manages own category matches"
  ON public.matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.team_manager_assignments
      WHERE user_id = auth.uid() AND category = matches.category
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_manager_assignments
      WHERE user_id = auth.uid() AND category = matches.category
    )
  );

-- 5. TM scoped RLS — match_call_ups (needed for managing matches)
DROP POLICY IF EXISTS "TM manages own category call-ups" ON public.match_call_ups;
CREATE POLICY "TM manages own category call-ups"
  ON public.match_call_ups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.team_manager_assignments tma
      JOIN public.matches m ON m.id = match_call_ups.match_id
      WHERE tma.user_id = auth.uid() AND tma.category = m.category
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_manager_assignments tma
      JOIN public.matches m ON m.id = match_call_ups.match_id
      WHERE tma.user_id = auth.uid() AND tma.category = m.category
    )
  );

-- players, scoring_rules, team_config already have public SELECT — no additional read policies needed.