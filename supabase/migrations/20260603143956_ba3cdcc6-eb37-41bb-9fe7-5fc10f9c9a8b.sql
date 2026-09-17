ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_name_key;
ALTER TABLE public.seasons ADD CONSTRAINT seasons_crew_name_key UNIQUE (crew_id, name);