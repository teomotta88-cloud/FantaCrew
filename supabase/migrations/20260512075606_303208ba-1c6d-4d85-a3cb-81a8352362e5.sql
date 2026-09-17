ALTER TABLE public.player_categories
  ADD COLUMN IF NOT EXISTS training_days integer[] NOT NULL DEFAULT '{}';

UPDATE public.player_categories SET training_days = '{1,2,4}' WHERE name = 'U16' AND coalesce(array_length(training_days,1),0) = 0;
UPDATE public.player_categories SET training_days = '{2,4,5}' WHERE name = 'U18' AND coalesce(array_length(training_days,1),0) = 0;
UPDATE public.player_categories SET training_days = '{2,4,5}' WHERE name = 'Seniores' AND coalesce(array_length(training_days,1),0) = 0;