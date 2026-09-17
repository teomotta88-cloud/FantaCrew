CREATE OR REPLACE VIEW public.player_event_log AS
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
    AND sr.is_active = true
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
    SELECT action_id, COUNT(*) AS c
    FROM public.special_action_completions
    GROUP BY action_id
) cnt ON cnt.action_id = sac.action_id
WHERE sac.player_id IS NOT NULL;

GRANT SELECT ON public.player_event_log TO anon, authenticated;