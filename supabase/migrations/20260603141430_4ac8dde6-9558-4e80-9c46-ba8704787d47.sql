
-- Ripristina un default sicuro per crew_id su tutte le tabelle:
-- usa la funzione current_crew_id() (che ora risolve dall'header senza fallback Lambro).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema='public' AND column_name='crew_id'
      AND (column_default IS NULL)
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN crew_id SET DEFAULT public.current_crew_id()', r.table_schema, r.table_name);
  END LOOP;
END $$;
