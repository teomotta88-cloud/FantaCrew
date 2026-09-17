
-- 1. Drop coach value_zaghetti
ALTER TABLE public.coaches DROP COLUMN IF EXISTS value_zaghetti;

-- 2. Mandatory slots
CREATE TYPE public.mandatory_duration AS ENUM ('1_week','2_weeks','1_month');

CREATE TABLE public.mandatory_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  eligible_player_ids uuid[] NOT NULL DEFAULT '{}',
  duration_type public.mandatory_duration NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  season text NOT NULL DEFAULT '2025/2026',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mandatory_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mandatory slots viewable by everyone"
  ON public.mandatory_slots FOR SELECT USING (true);

CREATE POLICY "Admins manage mandatory slots"
  ON public.mandatory_slots FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger to auto-compute ends_at from starts_at + duration_type
CREATE OR REPLACE FUNCTION public.set_mandatory_slot_ends_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.duration_type = '1_week' THEN
    NEW.ends_at := NEW.starts_at + interval '7 days';
  ELSIF NEW.duration_type = '2_weeks' THEN
    NEW.ends_at := NEW.starts_at + interval '14 days';
  ELSIF NEW.duration_type = '1_month' THEN
    NEW.ends_at := NEW.starts_at + interval '1 month';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mandatory_slots_set_ends_at
  BEFORE INSERT OR UPDATE OF starts_at, duration_type ON public.mandatory_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_mandatory_slot_ends_at();

CREATE INDEX idx_mandatory_slots_active ON public.mandatory_slots (starts_at, ends_at);

-- 3. Push subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions (user_id);

-- 4. Notification history
CREATE TABLE public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  audience text NOT NULL DEFAULT 'all',
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivery_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification history"
  ON public.notification_history FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_notification_history_scheduled ON public.notification_history (scheduled_for) WHERE sent_at IS NULL;
