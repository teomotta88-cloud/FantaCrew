-- Allow team managers to insert special actions
CREATE POLICY "team_managers_insert_special_actions"
ON special_actions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_manager_assignments
    WHERE team_manager_assignments.user_id = auth.uid()
  )
);

-- Allow team managers to delete special actions
CREATE POLICY "team_managers_delete_special_actions"
ON special_actions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_manager_assignments
    WHERE team_manager_assignments.user_id = auth.uid()
  )
);

-- Allow team managers to delete special_action_completions
CREATE POLICY "team_managers_delete_special_action_completions"
ON special_action_completions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team_manager_assignments
    WHERE team_manager_assignments.user_id = auth.uid()
  )
);

-- Allow team managers to insert special_action_completions
CREATE POLICY "team_managers_insert_special_action_completions"
ON special_action_completions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_manager_assignments
    WHERE team_manager_assignments.user_id = auth.uid()
  )
);