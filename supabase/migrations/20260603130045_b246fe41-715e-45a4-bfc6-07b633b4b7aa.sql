
DROP POLICY IF EXISTS "Badge defs admin write" ON public.badge_definitions;
CREATE POLICY "Badge defs admin write" ON public.badge_definitions FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admin all" ON public.challenges;
CREATE POLICY "Admin all" ON public.challenges FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage coach events" ON public.coach_events;
CREATE POLICY "Admins manage coach events" ON public.coach_events FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage coaches" ON public.coaches;
CREATE POLICY "Admins manage coaches" ON public.coaches FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage snapshots" ON public.leaderboard_snapshots;
CREATE POLICY "Admins manage snapshots" ON public.leaderboard_snapshots FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage mandatory slots" ON public.mandatory_slots;
CREATE POLICY "Admins manage mandatory slots" ON public.mandatory_slots FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage call-ups" ON public.match_call_ups;
CREATE POLICY "Admins manage call-ups" ON public.match_call_ups FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage matches" ON public.matches;
CREATE POLICY "Admins manage matches" ON public.matches FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage notification history" ON public.notification_history;
CREATE POLICY "Admins manage notification history" ON public.notification_history FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage log" ON public.notification_log;
CREATE POLICY "Admins manage log" ON public.notification_log FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage templates" ON public.notification_templates;
CREATE POLICY "Admins manage templates" ON public.notification_templates FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Player badges admin write" ON public.player_badges;
CREATE POLICY "Player badges admin write" ON public.player_badges FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage categories" ON public.player_categories;
CREATE POLICY "Admins manage categories" ON public.player_categories FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage players" ON public.players;
CREATE POLICY "Admins manage players" ON public.players FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins full access" ON public.role_assignment_history;
CREATE POLICY "Admins full access" ON public.role_assignment_history FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage rules" ON public.scoring_rules;
CREATE POLICY "Admins manage rules" ON public.scoring_rules FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage season player results" ON public.season_player_results;
CREATE POLICY "Admins manage season player results" ON public.season_player_results FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage season results" ON public.season_results;
CREATE POLICY "Admins manage season results" ON public.season_results FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage seasons" ON public.seasons;
CREATE POLICY "Admins manage seasons" ON public.seasons FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage completions" ON public.special_action_completions;
CREATE POLICY "Admins manage completions" ON public.special_action_completions FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage special actions" ON public.special_actions;
CREATE POLICY "Admins manage special actions" ON public.special_actions FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage config" ON public.team_config;
CREATE POLICY "Admins manage config" ON public.team_config FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage TM assignments" ON public.team_manager_assignments;
CREATE POLICY "Admins manage TM assignments" ON public.team_manager_assignments FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage penalties" ON public.team_penalties;
CREATE POLICY "Admins manage penalties" ON public.team_penalties FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage history" ON public.team_player_history;
CREATE POLICY "Admins manage history" ON public.team_player_history FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage events" ON public.weekly_events;
CREATE POLICY "Admins manage events" ON public.weekly_events FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Admin all" ON public.transfer_sessions;
CREATE POLICY "Admin all" ON public.transfer_sessions FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Trainings admin write" ON public.trainings;
CREATE POLICY "Trainings admin write" ON public.trainings FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "Training schedules admin write" ON public.training_schedules;
CREATE POLICY "Training schedules admin write" ON public.training_schedules FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND (crew_id = current_crew_id() OR has_role(auth.uid(),'super_admin'::app_role)));
