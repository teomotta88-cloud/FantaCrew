UPDATE public.weekly_events
SET season_id = (SELECT id FROM public.seasons WHERE is_active = true LIMIT 1)
WHERE season_id IS NULL;

UPDATE public.special_actions
SET season_id = (SELECT id FROM public.seasons WHERE is_active = true LIMIT 1)
WHERE season_id IS NULL;

UPDATE public.leaderboard_snapshots
SET season_id = (SELECT id FROM public.seasons WHERE is_active = true LIMIT 1)
WHERE season_id IS NULL;

UPDATE public.team_player_history
SET season_id_ref = (SELECT id FROM public.seasons WHERE is_active = true LIMIT 1)
WHERE season_id_ref IS NULL;

CREATE OR REPLACE FUNCTION public.set_active_season_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.season_id IS NULL THEN
    SELECT id INTO NEW.season_id
    FROM public.seasons
    WHERE is_active = true
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_weekly_events_season ON public.weekly_events;
CREATE TRIGGER trg_weekly_events_season
BEFORE INSERT ON public.weekly_events
FOR EACH ROW EXECUTE FUNCTION public.set_active_season_id();

DROP TRIGGER IF EXISTS trg_special_actions_season ON public.special_actions;
CREATE TRIGGER trg_special_actions_season
BEFORE INSERT ON public.special_actions
FOR EACH ROW EXECUTE FUNCTION public.set_active_season_id();

DROP TRIGGER IF EXISTS trg_leaderboard_snapshots_season ON public.leaderboard_snapshots;
CREATE TRIGGER trg_leaderboard_snapshots_season
BEFORE INSERT ON public.leaderboard_snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_active_season_id();
