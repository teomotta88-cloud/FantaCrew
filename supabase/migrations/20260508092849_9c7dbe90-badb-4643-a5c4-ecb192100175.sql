
CREATE OR REPLACE FUNCTION public.notify_event_trigger(_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://jpgjyxhlhtrtzcrulluz.supabase.co/functions/v1/process-event-notifications',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZ2p5eGhsaHRydHpjcnVsbHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzQ1OTUsImV4cCI6MjA5MzY1MDU5NX0.0Qaz20Ggb2TF-ipCzvYc1angros1_wIYrnneCkArALk"}'::jsonb,
    body := jsonb_build_object('eventTrigger', _event)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_special_action_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.notify_event_trigger('special_action_published'); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.trg_mandatory_active_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.notify_event_trigger('mandatory_active'); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS event_special_action ON public.special_actions;
CREATE TRIGGER event_special_action AFTER INSERT ON public.special_actions
FOR EACH ROW EXECUTE FUNCTION public.trg_special_action_event();

DROP TRIGGER IF EXISTS event_mandatory_active ON public.mandatory_slots;
CREATE TRIGGER event_mandatory_active AFTER INSERT ON public.mandatory_slots
FOR EACH ROW EXECUTE FUNCTION public.trg_mandatory_active_event();
