-- 1) Extend app_role enum (committed before being referenced)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

COMMIT;
BEGIN;

-- 2) admin_permissions table
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  is_super_admin boolean NOT NULL DEFAULT false,
  allowed_categories text[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage admin_permissions" ON public.admin_permissions;
CREATE POLICY "Super admins manage admin_permissions"
ON public.admin_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins read own permissions" ON public.admin_permissions;
CREATE POLICY "Admins read own permissions"
ON public.admin_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- 3) Helper: can the current admin manage rows for a given category?
CREATE OR REPLACE FUNCTION public.admin_can_manage_category(_category text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.admin_permissions ap
      WHERE ap.user_id = auth.uid()
        AND (
          ap.is_super_admin
          OR ap.allowed_categories IS NULL
          OR _category = ANY(ap.allowed_categories)
        )
    )
$$;

GRANT EXECUTE ON FUNCTION public.admin_can_manage_category(text) TO authenticated;

-- 4) Update bootstrap_first_admin to grant super_admin and seed permissions row
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists boolean;
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found';
  END IF;

  LOCK TABLE public.user_roles IN SHARE ROW EXCLUSIVE MODE;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role)
  INTO admin_exists;

  IF admin_exists THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'super_admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_permissions (user_id, is_super_admin, allowed_categories, created_by)
  VALUES (auth.uid(), true, NULL, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET is_super_admin = true, allowed_categories = NULL;

  RETURN true;
END;
$$;

-- Backfill: any pre-existing admin becomes super_admin (single-admin install)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role FROM public.user_roles WHERE role = 'admin'::app_role
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.admin_permissions (user_id, is_super_admin, allowed_categories, created_by)
SELECT ur.user_id, true, NULL, ur.user_id
FROM public.user_roles ur
WHERE ur.role = 'admin'::app_role
ON CONFLICT (user_id) DO NOTHING;

-- 5) Scoring rules: applies_to + is_active
ALTER TABLE public.scoring_rules
  ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'player',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.scoring_rules
  DROP CONSTRAINT IF EXISTS scoring_rules_applies_to_check;
ALTER TABLE public.scoring_rules
  ADD CONSTRAINT scoring_rules_applies_to_check
  CHECK (applies_to IN ('player','coach','both'));

INSERT INTO public.scoring_rules (key, label, points, is_malus, sort_order, applies_to, is_active)
VALUES
  ('yellow_card', 'Cartellino giallo', -5,  true, 55, 'player', true),
  ('red_card',    'Cartellino rosso',  -15, true, 56, 'player', true)
ON CONFLICT (key) DO NOTHING;

-- 6) Scoped-admin RLS on weekly_events and players (super admin policy already exists)
DROP POLICY IF EXISTS "Scoped admins manage weekly events" ON public.weekly_events;
CREATE POLICY "Scoped admins manage weekly events"
ON public.weekly_events
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = weekly_events.player_id
      AND public.admin_can_manage_category(p.category)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = weekly_events.player_id
      AND public.admin_can_manage_category(p.category)
  )
);

DROP POLICY IF EXISTS "Scoped admins manage players" ON public.players;
CREATE POLICY "Scoped admins manage players"
ON public.players
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) AND public.admin_can_manage_category(category))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND public.admin_can_manage_category(category));

DROP POLICY IF EXISTS "Scoped admins manage coach events" ON public.coach_events;
CREATE POLICY "Scoped admins manage coach events"
ON public.coach_events
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.id = coach_events.coach_id
      AND public.admin_can_manage_category(c.category)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.id = coach_events.coach_id
      AND public.admin_can_manage_category(c.category)
  )
);
