CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('compute-badges-weekly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'compute-badges-weekly');

SELECT cron.schedule(
  'compute-badges-weekly',
  '0 1 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://jpgjyxhlhtrtzcrulluz.supabase.co/functions/v1/compute-badges',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZ2p5eGhsaHRydHpjcnVsbHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzQ1OTUsImV4cCI6MjA5MzY1MDU5NX0.0Qaz20Ggb2TF-ipCzvYc1angros1_wIYrnneCkArALk"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);