
-- Helper: read crew slug from request header (set by the client)
CREATE OR REPLACE FUNCTION public.current_crew_slug()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    current_setting('request.headers', true)::json->>'x-crew-slug',
    ''
  )
$$;

-- Helper: resolve current crew id (fallback to Lambro for legacy callers)
CREATE OR REPLACE FUNCTION public.current_crew_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.crews WHERE slug = public.current_crew_slug() LIMIT 1),
    '06e48abb-42c9-45c0-b35b-9a0a8468c939'::uuid
  )
$$;

-- Trigger function: auto-fill crew_id from header on INSERT
CREATE OR REPLACE FUNCTION public.set_crew_id_from_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctx_crew uuid;
BEGIN
  IF NEW.crew_id IS NULL OR NEW.crew_id = '06e48abb-42c9-45c0-b35b-9a0a8468c939'::uuid THEN
    ctx_crew := public.current_crew_id();
    IF ctx_crew IS NOT NULL THEN
      NEW.crew_id := ctx_crew;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to all tables that have a crew_id column
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'admin_permissions','badge_definitions','challenges','coach_events','coaches',
    'crew_user_roles','leaderboard_snapshots','league_members','league_teams','leagues',
    'mandatory_slots','match_call_ups','matches','notification_history','notification_log',
    'notification_templates','player_badges','player_categories','players',
    'role_assignment_history','scoring_rules','season_player_results','season_results',
    'seasons','special_action_completions','special_actions','team_coaches','team_config',
    'team_manager_assignments','team_penalties','team_player_history','team_players',
    'teams','training_absence_reads','training_absences','training_schedules','trainings',
    'transfer_sessions','weekly_events'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_crew_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_crew_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_crew_id_from_context()',
      t
    );
  END LOOP;
END $$;
