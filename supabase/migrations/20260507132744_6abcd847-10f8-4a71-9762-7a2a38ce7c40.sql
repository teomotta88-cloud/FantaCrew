ALTER TABLE public.special_action_completions ADD COLUMN coach_id uuid;
ALTER TABLE public.special_action_completions ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE public.special_action_completions ADD CONSTRAINT special_action_completions_one_subject CHECK ((player_id IS NOT NULL)::int + (coach_id IS NOT NULL)::int = 1);
CREATE UNIQUE INDEX IF NOT EXISTS special_action_completions_action_coach_uidx ON public.special_action_completions(action_id, coach_id) WHERE coach_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS special_action_completions_action_player_uidx ON public.special_action_completions(action_id, player_id) WHERE player_id IS NOT NULL;