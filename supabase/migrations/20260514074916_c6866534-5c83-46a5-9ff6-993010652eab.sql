
CREATE TABLE IF NOT EXISTS public.training_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  training_date DATE NOT NULL,
  justification TEXT NOT NULL,
  category TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_absences_category_date ON public.training_absences(category, training_date);
CREATE INDEX IF NOT EXISTS idx_training_absences_user ON public.training_absences(user_id);

ALTER TABLE public.training_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Player manages own absences"
  ON public.training_absences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches and admins read absences"
  ON public.training_absences FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid())
  );

CREATE POLICY "Coaches and admins update is_read"
  ON public.training_absences FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = auth.uid())
  )
  WITH CHECK (true);

INSERT INTO public.notification_templates (title, push_title, push_body, type, is_active, audience, event_trigger)
SELECT 'Assenza allenamento', '📅 Assenza comunicata', 'Un giocatore ha comunicato un''assenza all''allenamento.', 'event_triggered', false, 'all', 'training_absence_reported'
WHERE NOT EXISTS (SELECT 1 FROM public.notification_templates WHERE event_trigger = 'training_absence_reported');
