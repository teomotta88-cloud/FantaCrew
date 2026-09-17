
-- Helper: visibility predicate
-- crew_id = current_crew_id() OR user is super_admin
-- (current_crew_id falls back to Lambro UUID when no header is set)

-- ============ badge_definitions ============
DROP POLICY IF EXISTS "Badge defs public read" ON public.badge_definitions;
CREATE POLICY "Badge defs crew read" ON public.badge_definitions
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ challenges ============
DROP POLICY IF EXISTS "Public read" ON public.challenges;
CREATE POLICY "Crew read" ON public.challenges
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ coach_events ============
DROP POLICY IF EXISTS "Coach events viewable by everyone" ON public.coach_events;
CREATE POLICY "Coach events crew read" ON public.coach_events
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ coaches ============
DROP POLICY IF EXISTS "Coaches viewable by everyone" ON public.coaches;
CREATE POLICY "Coaches crew read" ON public.coaches
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ leaderboard_snapshots ============
DROP POLICY IF EXISTS "Snapshots viewable by everyone" ON public.leaderboard_snapshots;
CREATE POLICY "Snapshots crew read" ON public.leaderboard_snapshots
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ league_members ============
DROP POLICY IF EXISTS "Members viewable by everyone" ON public.league_members;
CREATE POLICY "Members crew read" ON public.league_members
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ league_teams ============
DROP POLICY IF EXISTS "League teams viewable by everyone" ON public.league_teams;
CREATE POLICY "League teams crew read" ON public.league_teams
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ leagues ============
DROP POLICY IF EXISTS "Leagues viewable by everyone" ON public.leagues;
CREATE POLICY "Leagues crew read" ON public.leagues
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ mandatory_slots ============
DROP POLICY IF EXISTS "Mandatory slots viewable by everyone" ON public.mandatory_slots;
CREATE POLICY "Mandatory slots crew read" ON public.mandatory_slots
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ match_call_ups ============
DROP POLICY IF EXISTS "Call-ups viewable by everyone" ON public.match_call_ups;
CREATE POLICY "Call-ups crew read" ON public.match_call_ups
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ matches ============
DROP POLICY IF EXISTS "Matches viewable by everyone" ON public.matches;
CREATE POLICY "Matches crew read" ON public.matches
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ notification_templates ============
DROP POLICY IF EXISTS "Templates viewable by everyone" ON public.notification_templates;
CREATE POLICY "Templates crew read" ON public.notification_templates
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ player_badges ============
DROP POLICY IF EXISTS "Player badges public read" ON public.player_badges;
CREATE POLICY "Player badges crew read" ON public.player_badges
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ player_categories ============
DROP POLICY IF EXISTS "Categories viewable by everyone" ON public.player_categories;
CREATE POLICY "Categories crew read" ON public.player_categories
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ players ============
DROP POLICY IF EXISTS "Players viewable by everyone" ON public.players;
CREATE POLICY "Players crew read" ON public.players
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ role_assignment_history ============
DROP POLICY IF EXISTS "Public read" ON public.role_assignment_history;
CREATE POLICY "Role assign crew read" ON public.role_assignment_history
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ scoring_rules ============
DROP POLICY IF EXISTS "Rules viewable by everyone" ON public.scoring_rules;
CREATE POLICY "Rules crew read" ON public.scoring_rules
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ season_player_results ============
DROP POLICY IF EXISTS "Season player results viewable by everyone" ON public.season_player_results;
CREATE POLICY "Season player results crew read" ON public.season_player_results
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ season_results ============
DROP POLICY IF EXISTS "Season results viewable by everyone" ON public.season_results;
CREATE POLICY "Season results crew read" ON public.season_results
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ seasons ============
DROP POLICY IF EXISTS "Seasons viewable by everyone" ON public.seasons;
CREATE POLICY "Seasons crew read" ON public.seasons
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ special_action_completions ============
DROP POLICY IF EXISTS "Completions viewable by everyone" ON public.special_action_completions;
CREATE POLICY "Completions crew read" ON public.special_action_completions
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ special_actions ============
DROP POLICY IF EXISTS "Special actions viewable by everyone" ON public.special_actions;
CREATE POLICY "Special actions crew read" ON public.special_actions
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ team_coaches ============
DROP POLICY IF EXISTS "Team coaches viewable by everyone" ON public.team_coaches;
CREATE POLICY "Team coaches crew read" ON public.team_coaches
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ team_config ============
DROP POLICY IF EXISTS "Config viewable by everyone" ON public.team_config;
CREATE POLICY "Config crew read" ON public.team_config
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ team_penalties ============
DROP POLICY IF EXISTS "Penalties viewable by everyone" ON public.team_penalties;
CREATE POLICY "Penalties crew read" ON public.team_penalties
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ team_player_history ============
DROP POLICY IF EXISTS "History viewable by everyone" ON public.team_player_history;
CREATE POLICY "History crew read" ON public.team_player_history
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ team_players ============
DROP POLICY IF EXISTS "Team players viewable by everyone" ON public.team_players;
CREATE POLICY "Team players crew read" ON public.team_players
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ teams ============
DROP POLICY IF EXISTS "Teams viewable by everyone" ON public.teams;
CREATE POLICY "Teams crew read" ON public.teams
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ training_schedules ============
DROP POLICY IF EXISTS "Training schedules public read" ON public.training_schedules;
CREATE POLICY "Training schedules crew read" ON public.training_schedules
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ trainings ============
DROP POLICY IF EXISTS "Trainings public read" ON public.trainings;
CREATE POLICY "Trainings crew read" ON public.trainings
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));

-- ============ weekly_events ============
DROP POLICY IF EXISTS "Events viewable by everyone" ON public.weekly_events;
CREATE POLICY "Events crew read" ON public.weekly_events
  FOR SELECT USING (crew_id = public.current_crew_id() OR public.has_role(auth.uid(),'super_admin'::app_role));
