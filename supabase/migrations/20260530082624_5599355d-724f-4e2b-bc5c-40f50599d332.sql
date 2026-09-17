CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'resolve-challenges',
  '59 23 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://jpgjyxhlhtrtzcrulluz.supabase.co/functions/v1/resolve-challenges',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZ2p5eGhsaHRydHpjcnVsbHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzQ1OTUsImV4cCI6MjA5MzY1MDU5NX0.0Qaz20Ggb2TF-ipCzvYc1angros1_wIYrnneCkArALk"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);