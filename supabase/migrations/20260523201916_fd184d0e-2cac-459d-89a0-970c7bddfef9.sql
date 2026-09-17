
-- 1) Add score_type to scoring_rules
ALTER TABLE public.scoring_rules
  ADD COLUMN IF NOT EXISTS score_type TEXT NOT NULL DEFAULT 'bonus';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scoring_rules_score_type_check'
  ) THEN
    ALTER TABLE public.scoring_rules
      ADD CONSTRAINT scoring_rules_score_type_check
      CHECK (score_type IN ('bonus','malus','club'));
  END IF;
END$$;

-- Backfill malus rules
UPDATE public.scoring_rules SET score_type = 'malus' WHERE is_malus = true AND score_type = 'bonus';

-- 2) Insert match_draw rule
INSERT INTO public.scoring_rules (key, label, points, is_malus, sort_order, applies_to, is_active, score_type)
VALUES ('match_draw', 'Pareggio', 1, false, 35, 'player', true, 'bonus')
ON CONFLICT (key) DO NOTHING;

-- 3) Recreate player_event_log view with score_type column
DROP VIEW IF EXISTS public.player_event_log;
CREATE VIEW public.player_event_log AS
SELECT we.id,
    we.player_id,
    p.full_name,
    p.category,
    p.role,
    sr.label AS event_label,
    sr.key AS event_key,
    sr.is_malus,
    sr.score_type,
    we.quantity * sr.points AS points,
    we.week,
    we.season_id,
    we.created_at AS event_date,
    'weekly_event'::text AS source,
    NULL::uuid AS action_id
FROM public.weekly_events we
JOIN public.players p ON p.id = we.player_id
JOIN public.scoring_rules sr ON sr.key = we.rule_key
UNION ALL
SELECT sac.id,
    sac.player_id,
    p.full_name,
    p.category,
    p.role,
    sa.title AS event_label,
    'special_action'::text AS event_key,
    cnt.c > 1 AS is_malus,
    CASE WHEN cnt.c > 1 THEN 'malus' ELSE 'bonus' END AS score_type,
    CASE WHEN cnt.c > 1 THEN -sa.points ELSE sa.points END AS points,
    sa.week,
    sa.season_id,
    sac.created_at AS event_date,
    'special_action'::text AS source,
    sac.action_id
FROM public.special_action_completions sac
JOIN public.players p ON p.id = sac.player_id
JOIN public.special_actions sa ON sa.id = sac.action_id
JOIN (
  SELECT special_action_completions.action_id, count(*) AS c
  FROM public.special_action_completions
  WHERE special_action_completions.player_id IS NOT NULL
  GROUP BY special_action_completions.action_id
) cnt ON cnt.action_id = sac.action_id
WHERE sac.player_id IS NOT NULL;
