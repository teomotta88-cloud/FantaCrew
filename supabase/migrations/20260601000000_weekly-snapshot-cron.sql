CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if present (idempotent)
SELECT cron.unschedule('weekly-snapshot') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-snapshot'
);

-- Run every Monday at 00:05 UTC as safety fallback.
-- Primary trigger: resolve-challenges (Sun 23:59) calls weekly-snapshot
-- directly after resolving, so the snapshot always includes challenge bonuses.
-- This cron covers weeks with no active challenges.
SELECT cron.schedule(
  'weekly-snapshot',
  '5 0 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://jpgjyxhlhtrtzcrulluz.supabase.co/functions/v1/weekly-snapshot',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZ2p5eGhsaHRydHpjcnVsbHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzQ1OTUsImV4cCI6MjA5MzY1MDU5NX0.0Qaz20Ggb2TF-ipCzvYc1angros1_wIYrnneCkArALk"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
