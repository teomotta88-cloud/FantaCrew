ALTER TABLE public.weekly_events
  ADD COLUMN IF NOT EXISTS inserted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS inserted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS training_id text;

-- Backfill training_id from existing notes pattern: "training:YYYY-MM-DD|category"
UPDATE public.weekly_events
SET training_id = substring(notes from 'training:([^|]+\|[^|]+)')
WHERE training_id IS NULL
  AND rule_key IN ('training_attendance', 'training_absence')
  AND notes LIKE 'training:%';

-- Unique constraint so UPSERT can target (player_id, rule_key, training_id).
-- NULL training_id (non-training rows) won't conflict.
ALTER TABLE public.weekly_events
  DROP CONSTRAINT IF EXISTS uq_attendance;
ALTER TABLE public.weekly_events
  ADD CONSTRAINT uq_attendance UNIQUE (player_id, rule_key, training_id);

CREATE INDEX IF NOT EXISTS idx_weekly_events_training_id ON public.weekly_events(training_id);
CREATE INDEX IF NOT EXISTS idx_weekly_events_inserted_by ON public.weekly_events(inserted_by);