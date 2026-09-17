/**
 * Centralized week numbering for Fanta Lambro.
 *
 * All week-related calculations in the app go through this module so that:
 *  - week numbers assigned to weekly_events (manual events, matches, trainings)
 *  - the "current week" used by challenges
 *  - the week shown in UI labels
 * always agree for the same calendar date.
 *
 * Numbering is season-relative: week 1 starts on the season's starts_at date.
 * Days 0-6 from start → week 1, days 7-13 → week 2, etc.
 *
 * IMPORTANT: dates are normalized to UTC midnight before counting days,
 * so the hour of day never affects the resulting week number. This avoids
 * the historical "Monday is week N but Monday afternoon is week N+1" bug.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcMidnight(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : new Date(date.getTime());
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Returns the season-relative week number for the given date.
 * Both `date` and `seasonStart` are normalized to UTC midnight.
 */
export function weekOf(date: Date | string, seasonStart: string | null | undefined): number {
  if (!seasonStart) return 1;
  const startMs = utcMidnight(seasonStart);
  const dMs = utcMidnight(date);
  const days = Math.floor((dMs - startMs) / MS_PER_DAY);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/**
 * Returns the current week (now) relative to the given season start.
 */
export function currentWeek(seasonStart: string | null | undefined): number {
  return weekOf(new Date(), seasonStart);
}
