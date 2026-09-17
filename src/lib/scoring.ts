import { supabase } from "@/integrations/supabase/client";
import { SEASON } from "@/lib/constants";

export type TeamScore = {
  team_id: string;
  team_name: string;
  manager_id: string;
  manager_name: string;
  total: number;
};

export type PlayerWindow = {
  team_id: string;
  player_id: string;
  joined_at: string;
  left_at: string | null;
};

type EventRow = { player_id: string; ts: number; pts: number; week: number };

async function loadAll(seasonId?: string | null) {
  const weeklyQ = supabase
    .from("weekly_events")
    .select("player_id,rule_key,quantity,match_id,created_at,season_id,season,week");
  const compsQ = supabase
    .from("special_action_completions")
    .select("action_id,player_id,created_at,special_actions(season_id,season)");
  const [
    teams,
    history,
    weekly,
    rules,
    matches,
    comps,
    actions,
    coachLinks,
    coachScores,
    cfg,
    penalties,
    profiles,
    roleHistory,
  ] = await Promise.all([
    supabase
      .from("teams")
      .select(
        "id,name,manager_id,captain_player_id,talisman_player_id,silverback_player_id,captain_changed_at,talisman_changed_at,silverback_changed_at",
      ),
    supabase.from("team_player_history").select("team_id,player_id,joined_at,left_at"),
    seasonId ? weeklyQ.or(`season_id.eq.${seasonId},season.eq.${SEASON}`) : weeklyQ.eq("season", SEASON),
    supabase.from("scoring_rules").select("key,points").eq("is_active", true),
    supabase.from("matches").select("id,match_date"),
    compsQ,
    supabase.from("special_actions").select("id,points,season_id,season"),
    supabase.from("team_coaches").select("team_id,coach_id"),
    supabase.from("coach_scores").select("coach_id,total_points"),
    supabase
      .from("team_config")
      .select("key,value")
      .in("key", ["multiplier_captain", "multiplier_talisman", "multiplier_silverback"]),
    supabase.from("team_penalties").select("team_id,points"),
    supabase.from("profiles").select("id,display_name"),
    supabase.from("role_assignment_history").select("team_id,player_id,role,assigned_at,removed_at"),
  ]);
  return {
    teams,
    history,
    weekly,
    rules,
    matches,
    comps,
    actions,
    coachLinks,
    coachScores,
    cfg,
    penalties,
    profiles,
    roleHistory,
  };
}

function buildPlayerEvents(
  weekly: any[],
  rules: any[],
  matches: any[],
  comps: any[],
  actions: any[],
  seasonId?: string | null,
): Map<string, EventRow[]> {
  const ruleMap = new Map(rules.map((r: any) => [r.key, r.points]));
  const matchDate = new Map(matches.map((m: any) => [m.id, new Date(m.match_date + "T12:00:00Z").getTime()]));
  const events = new Map<string, EventRow[]>();
  const push = (pid: string, ts: number, pts: number, week: number) => {
    if (!events.has(pid)) events.set(pid, []);
    events.get(pid)!.push({ player_id: pid, ts, pts, week });
  };
  for (const we of weekly) {
    const pts = (ruleMap.get(we.rule_key) || 0) * (we.quantity || 0);
    if (!pts || isNaN(pts)) continue;
    const ts = (we.match_id && matchDate.get(we.match_id)) || new Date(we.created_at).getTime();
    push(we.player_id, ts, pts, we.week || 0);
  }
  // Filter completions by season (action's season)
  const filteredComps = comps.filter((c: any) => {
    if (!seasonId) return true;
    const sa = c.special_actions || {};
    if (sa.season_id) return sa.season_id === seasonId;
    if (sa.season) return sa.season === SEASON;
    return true;
  });
  // Special actions: if action completed by >1 player, all become negative
  const counts = new Map<string, number>();
  for (const c of filteredComps) counts.set(c.action_id, (counts.get(c.action_id) || 0) + 1);
  const actionPts = new Map(actions.map((a: any) => [a.id, a.points]));
  const actionWeeks = new Map(actions.map((a: any) => [a.id, a.week || 0]));
  for (const c of filteredComps) {
    if (!c.player_id) continue;
    const base = actionPts.get(c.action_id) || 0;
    const pts = (counts.get(c.action_id) || 0) > 1 ? -base : base;
    if (!pts) continue;
    push(c.player_id, new Date(c.created_at).getTime(), pts, actionWeeks.get(c.action_id) || 0);
  }
  return events;
}

function sumWindow(events: EventRow[] | undefined, joined: number, left: number | null): number {
  if (!events) return 0;
  let s = 0;
  for (const e of events) {
    if (e.ts >= joined && (left === null || e.ts <= left)) s += e.pts;
  }
  return s;
}

export type WindowedPlayerContribution = {
  player_id: string;
  joined_at: string;
  left_at: string | null;
  base_points: number;
  multiplier: number;
  contributed: number;
  last_week_points: number;
};

function getLastWeek(weekly: any[]): number {
  let max = 0;
  for (const e of weekly) {
    if ((e.week || 0) > max) max = e.week;
  }
  return max;
}

type RoleWindow = { assigned_at: number; removed_at: number | null; multiplier: number };

function buildRoleWindows(
  roleHistory: any[],
  teamId: string,
  playerId: string,
  mCap: number,
  mTal: number,
  mSil: number,
): RoleWindow[] {
  return roleHistory
    .filter((r) => r.team_id === teamId && r.player_id === playerId)
    .map((r) => ({
      assigned_at: new Date(r.assigned_at).getTime(),
      removed_at: r.removed_at ? new Date(r.removed_at).getTime() : null,
      multiplier: r.role === "captain" ? mCap : r.role === "talisman" ? mTal : r.role === "silverback" ? mSil : 1,
    }));
}

function sumWithRoleHistory(
  events: EventRow[] | undefined,
  roleWindows: RoleWindow[],
  joined: number,
  left: number | null,
): number {
  if (!events) return 0;
  let total = 0;
  for (const e of events) {
    if (e.ts < joined) continue;
    if (left !== null && e.ts > left) continue;
    let mult = 1;
    for (const w of roleWindows) {
      if (e.ts >= w.assigned_at && (w.removed_at === null || e.ts <= w.removed_at)) {
        mult = w.multiplier;
        break;
      }
    }
    total += e.pts * mult;
  }
  return total;
}

function sumLastWeekWithRole(
  events: EventRow[] | undefined,
  weekly: any[],
  roleWindows: RoleWindow[],
  player_id: string,
  joined: number,
  left: number | null,
): number {
  if (!events) return 0;
  const lastWeek = getLastWeek(weekly);
  if (!lastWeek) return 0;

  let total = 0;
  for (const e of events) {
    // Use the week field stored directly on the EventRow — no timestamp guessing
    if (e.week !== lastWeek) continue;
    if (e.ts < joined) continue;
    if (left !== null && e.ts > left) continue;
    let mult = 1;
    for (const w of roleWindows) {
      if (e.ts >= w.assigned_at && (w.removed_at === null || e.ts <= w.removed_at)) {
        mult = w.multiplier;
        break;
      }
    }
    total += e.pts * mult;
  }
  return total;
}

export async function computeTeamBreakdown(
  teamId: string,
  seasonId?: string | null,
): Promise<{
  total: number;
  contributions: WindowedPlayerContribution[];
  penalties: number;
  coachPoints: number;
} | null> {
  const all = await loadAll(seasonId);
  const team = (all.teams.data || []).find((t: any) => t.id === teamId);
  if (!team) return null;
  const cfgMap = new Map((all.cfg.data || []).map((r: any) => [r.key, r.value]));
  const mCap = Number(cfgMap.get("multiplier_captain") ?? 2);
  const mTal = Number(cfgMap.get("multiplier_talisman") ?? 4);
  const mSil = Number(cfgMap.get("multiplier_silverback") ?? 5);
  const events = buildPlayerEvents(
    all.weekly.data || [],
    all.rules.data || [],
    all.matches.data || [],
    all.comps.data || [],
    all.actions.data || [],
    seasonId,
  );
  const history = (all.history.data || []).filter((h: any) => h.team_id === teamId);
  const roleHistoryAll = all.roleHistory.data || [];

  const contribs: WindowedPlayerContribution[] = [];
  let total = 0;
  for (const h of history) {
    const joined = new Date(h.joined_at).getTime();
    const left = h.left_at ? new Date(h.left_at).getTime() : null;
    const base = sumWindow(events.get(h.player_id), joined, left);
    const roleWindows = buildRoleWindows(roleHistoryAll, teamId, h.player_id, mCap, mTal, mSil);
    const contributed = sumWithRoleHistory(events.get(h.player_id), roleWindows, joined, left);
    const lastWeekPts = sumLastWeekWithRole(
      events.get(h.player_id),
      all.weekly.data || [],
      roleWindows,
      h.player_id,
      joined,
      left,
    );
    const activeWindow = roleWindows.find((w) => w.removed_at === null);
    const displayMult = activeWindow ? activeWindow.multiplier : 1;
    contribs.push({
      player_id: h.player_id,
      joined_at: h.joined_at,
      left_at: h.left_at,
      base_points: base,
      multiplier: displayMult,
      contributed,
      last_week_points: lastWeekPts,
    });
    total += contributed;
  }
  // Coaches
  const coachIds = (all.coachLinks.data || []).filter((r: any) => r.team_id === teamId).map((r: any) => r.coach_id);
  const coachScoreMap = new Map((all.coachScores.data || []).map((s: any) => [s.coach_id, s.total_points || 0]));
  let coachPoints = 0;
  for (const cid of coachIds) coachPoints += coachScoreMap.get(cid) || 0;
  total += coachPoints;
  // Penalties
  const penalties = (all.penalties.data || [])
    .filter((p: any) => p.team_id === teamId)
    .reduce((s: number, p: any) => s + (p.points || 0), 0);
  total += penalties;
  return { total, contributions: contribs, penalties, coachPoints };
}

export async function computeAllTeamScores(seasonId?: string | null): Promise<TeamScore[]> {
  const all = await loadAll(seasonId);
  const cfgMap = new Map((all.cfg.data || []).map((r: any) => [r.key, r.value]));
  const mCap = Number(cfgMap.get("multiplier_captain") ?? 2);
  const mTal = Number(cfgMap.get("multiplier_talisman") ?? 4);
  const mSil = Number(cfgMap.get("multiplier_silverback") ?? 5);
  const events = buildPlayerEvents(
    all.weekly.data || [],
    all.rules.data || [],
    all.matches.data || [],
    all.comps.data || [],
    all.actions.data || [],
    seasonId,
  );
  const profileMap = new Map((all.profiles.data || []).map((p: any) => [p.id, p.display_name]));
  const coachScoreMap = new Map((all.coachScores.data || []).map((s: any) => [s.coach_id, s.total_points || 0]));
  const coachByTeam = new Map<string, string[]>();
  (all.coachLinks.data || []).forEach((r: any) => {
    if (!coachByTeam.has(r.team_id)) coachByTeam.set(r.team_id, []);
    coachByTeam.get(r.team_id)!.push(r.coach_id);
  });
  const penByTeam = new Map<string, number>();
  (all.penalties.data || []).forEach((r: any) =>
    penByTeam.set(r.team_id, (penByTeam.get(r.team_id) || 0) + (r.points || 0)),
  );
  const histByTeam = new Map<string, any[]>();
  (all.history.data || []).forEach((h: any) => {
    if (!histByTeam.has(h.team_id)) histByTeam.set(h.team_id, []);
    histByTeam.get(h.team_id)!.push(h);
  });

  const results: TeamScore[] = (all.teams.data || [])
    .map((t: any) => {
      const roleHistoryAll = all.roleHistory.data || [];
      let total = 0;
      for (const h of histByTeam.get(t.id) || []) {
        const joined = new Date(h.joined_at).getTime();
        const left = h.left_at ? new Date(h.left_at).getTime() : null;
        const roleWindows = buildRoleWindows(roleHistoryAll, t.id, h.player_id, mCap, mTal, mSil);
        total += sumWithRoleHistory(events.get(h.player_id), roleWindows, joined, left);
      }
      for (const cid of coachByTeam.get(t.id) || []) total += coachScoreMap.get(cid) || 0;
      total += penByTeam.get(t.id) || 0;
      return {
        team_id: t.id,
        team_name: t.name,
        manager_id: t.manager_id,
        manager_name: profileMap.get(t.manager_id) || "—",
        total,
      };
    })
    .sort((a, b) => b.total - a.total);
  return results;
}
