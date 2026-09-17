CREATE TABLE public.training_absence_reads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id  UUID        NOT NULL REFERENCES public.training_absences(id) ON DELETE CASCADE,
  coach_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (absence_id, coach_id)
);

ALTER TABLE public.training_absence_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage own reads"
  ON public.training_absence_reads FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Admins read all"
  ON public.training_absence_reads FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_training_absence_reads_coach ON public.training_absence_reads(coach_id);
CREATE INDEX idx_training_absence_reads_absence ON public.training_absence_reads(absence_id);

ALTER TABLE public.training_absences DROP COLUMN IF EXISTS is_read;