/**
 * Period boundaries in UTC, whatever the server's time zone. Vercel runs in UTC,
 * so these match the old local-time code there; on any other server they keep
 * days and months on UTC, like the SQL that groups by UTC day.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** 00:00 UTC on the day of `now`. */
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** 00:00 UTC on the first day of the month of `now`. */
export function utcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** 00:00 UTC on the first day of the month after `now`. */
export function utcNextMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

/** "YYYY-MM" of the UTC month of `now`. */
export function utcMonthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Exactly `days` × 24 hours before `now` (a rolling window, not calendar days). */
export function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

/** Exactly `hours` hours before `now`. */
export function hoursBefore(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000)
}
