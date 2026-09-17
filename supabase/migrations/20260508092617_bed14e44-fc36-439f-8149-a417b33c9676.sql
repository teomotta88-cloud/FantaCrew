
-- Drop legacy triggers that call send-push directly; replaced by event-driven dispatch
DROP TRIGGER IF EXISTS trg_notify_special_action ON public.special_actions;
DROP TRIGGER IF EXISTS trg_notify_mandatory_slot ON public.mandatory_slots;

CREATE TYPE public.notification_template_type AS ENUM ('recurring', 'one_time', 'event_triggered');

CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  push_title text NOT NULL,
  push_body text NOT NULL,
  push_url text,
  type public.notification_template_type NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  audience text NOT NULL DEFAULT 'all',
  cron_expression text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  event_trigger text,
  send_hour int,
  send_minute int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates viewable by everyone" ON public.notification_templates
  FOR SELECT USING (true);
CREATE POLICY "Admins manage templates" ON public.notification_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  audience text NOT NULL,
  recipient_count int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  failure_count int NOT NULL DEFAULT 0,
  payload jsonb
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage log" ON public.notification_log
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_notif_log_template ON public.notification_log(template_id, sent_at DESC);
CREATE INDEX idx_notif_templ_type_active ON public.notification_templates(type, is_active);
CREATE INDEX idx_notif_templ_event ON public.notification_templates(event_trigger) WHERE type = 'event_triggered';

-- Seed predefined templates
INSERT INTO public.notification_templates (title, push_title, push_body, push_url, type, event_trigger, audience, is_active) VALUES
  ('Apertura mercato', '📅 Mercato aperto!', 'Hai fino al 3 per modificare la rosa.', '/team', 'event_triggered', 'market_open', 'all', false),
  ('Chiusura mercato −24h', '⏰ Il mercato chiude domani', 'Hai aggiornato la squadra?', '/team', 'event_triggered', 'market_close_warning', 'all', false),
  ('Snapshot classifica', '📸 Classifica aggiornata', 'Controlla la tua posizione!', '/leaderboard', 'event_triggered', 'snapshot_saved', 'all', false),
  ('Repricing Zaghetti', '💰 Nuove quotazioni', 'I valori in Zaghetti sono stati aggiornati.', '/players', 'event_triggered', 'repricing_done', 'all', false),
  ('Obbligatorietà attiva', '🚨 Obbligatorietà!', 'Hai 48h per aggiornare la rosa.', '/team', 'event_triggered', 'mandatory_active', 'all', false),
  ('Warning obbligatorietà', '⚠️ Ultime 6 ore', 'Aggiorna la rosa o perdi 50 punti!', '/team', 'event_triggered', 'mandatory_expiry_warning', 'invalid_teams', false),
  ('Azione speciale', '⚡ Nuova azione speciale', 'Scopri come guadagnare punti extra!', '/azioni', 'event_triggered', 'special_action_published', 'all', false);

INSERT INTO public.notification_templates (title, push_title, push_body, push_url, type, cron_expression, send_hour, send_minute, audience, is_active) VALUES
  ('Reminder lunedì', '🏉 Settimana nuova', 'Controlla la classifica e le azioni speciali.', '/', 'recurring', '0 9 * * 1', 9, 0, 'all', false),
  ('Reminder venerdì', '🏉 Weekend di rugby', 'Pronto per le partite di domani?', '/', 'recurring', '0 18 * * 5', 18, 0, 'all', false);
