/**
 * ISO week-key arithmetic for the Healthcheck page.
 *
 * Pure helpers for navigating between ISO week keys (YYYY-Www) on the client.
 * Mirrors the backend `iso-week.ts` week-year rules (Jan-4 anchor) so the two
 * sides agree on week boundaries.
 */

/**
 * The calendar Y/M/D of an instant as observed in a given IANA timezone.
 * Mirrors the backend `dateParts` helper so client and server agree on which
 * calendar day (and therefore ISO week) an instant falls in.
 */
function calendarDateInTz(
  date: Date,
  tz: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month') - 1, day: get('day') }
}

/** Convert a Date to an ISO week key (YYYY-Www), bucketed in the given timezone. */
export function dateToIsoWeekKey(date: Date, tz: string = 'UTC'): string {
  const { year, month, day } = calendarDateInTz(date, tz)
  const d = new Date(Date.UTC(year, month, day))
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  const thursday = new Date(d)
  thursday.setUTCDate(d.getUTCDate() + (4 - dow))
  const isoYear = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay()
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1))
  const weekNum = Math.round((thursday.getTime() - week1Mon.getTime()) / (7 * 86_400_000)) + 1
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`
}

/** Current ISO week key, bucketed in the given timezone (defaults to UTC). */
export function currentIsoWeek(tz: string = 'UTC', now: Date = new Date()): string {
  return dateToIsoWeekKey(now, tz)
}

/** Parse a YYYY-Www key to the UTC Date of that week's Monday, or null. */
export function isoWeekToMonday(week: string): Date | null {
  const m = week.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return null
  const isoYear = parseInt(m[1], 10)
  const weekNum = parseInt(m[2], 10)
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4Dow = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay()
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1))
  const monday = new Date(week1Mon)
  monday.setUTCDate(week1Mon.getUTCDate() + (weekNum - 1) * 7)
  return monday
}

/** Format YYYY-Www as "W20 '26". */
export function formatWeekLabel(week: string): string {
  const m = week.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return week
  return `W${m[2]} '${m[1].slice(2)}`
}

/** Previous ISO week key (handles week 53 / year boundaries). */
export function prevWeek(week: string): string {
  const monday = isoWeekToMonday(week)
  if (!monday) return week
  monday.setUTCDate(monday.getUTCDate() - 7)
  return dateToIsoWeekKey(monday)
}

/** Next ISO week key (handles week 53 / year boundaries). */
export function nextWeek(week: string): string {
  const monday = isoWeekToMonday(week)
  if (!monday) return week
  monday.setUTCDate(monday.getUTCDate() + 7)
  return dateToIsoWeekKey(monday)
}

/** The last completed ISO week (the week before the current one), in `tz`. */
export function lastCompletedWeek(tz: string = 'UTC', now: Date = new Date()): string {
  return prevWeek(currentIsoWeek(tz, now))
}
