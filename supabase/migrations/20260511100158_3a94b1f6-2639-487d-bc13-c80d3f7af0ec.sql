
-- 1. Categories table
CREATE TABLE public.player_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories viewable by everyone"
  ON public.player_categories FOR SELECT USING (true);

CREATE POLICY "Admins manage categories"
  ON public.player_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Seed existing categories
INSERT INTO public.player_categories (name, label, sort_order, is_active) VALUES
  ('U16', 'Under 16', 1, true),
  ('U18', 'Under 18', 2, true),
  ('Seniores', '1XV', 3, true);

-- 3. Convert players.category from enum to text
ALTER TABLE public.players ALTER COLUMN category TYPE text USING category::text;
ALTER TABLE public.coaches ALTER COLUMN category TYPE text USING category::text;

-- 4. Foreign keys
ALTER TABLE public.players
  ADD CONSTRAINT players_category_fkey
  FOREIGN KEY (category) REFERENCES public.player_categories(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.coaches
  ADD CONSTRAINT coaches_category_fkey
  FOREIGN KEY (category) REFERENCES public.player_categories(name)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 5. Drop the enum (no longer referenced by any column)
DROP TYPE IF EXISTS public.player_category;
