/**
 * P3.RAIL3 — Pure helpers for the /dashboard/payouts page.
 *
 * Extracted from page.tsx so unit tests can import them without
 * dragging the server-component imports (`db`, `requireDeveloper`,
 * `getStripeClient`) into the test environment.
 */

export const SCHEDULE_TTL_MS = 60 * 60 * 1000

export const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

export type ScheduleInterval = 'daily' | 'weekly' | 'monthly' | 'manual'
export type ScheduleWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

/**
 * Compute the next `count` scheduled payout dates from `from` + the
 * developer's cached schedule. Pure / deterministic — no Stripe call;
 * Stripe is the source of truth at run-time, but this gives the
 * developer a reasonable preview to plan against.
 *
 * Spec calls for "upcoming scheduled payouts with dates and amounts".
 * Concrete dollar amounts depend on the developer's settled balance at
 * payout time, which would require summing unsettled ledger credits;
 * the page surfaces dates from this helper plus in-flight balance from
 * the `payouts` table (status pending/in_transit) in lieu of
 * projecting an amount.
 */
export function nextPayoutDates(
  schedule: {
    interval: ScheduleInterval
    weekday: string | null
    monthDay: number | null
  },
  count = 3,
  from: Date = new Date(),
): Date[] {
  if (schedule.interval === 'manual') return []
  const out: Date[] = []
  const cursor = new Date(from)
  cursor.setUTCHours(12, 0, 0, 0) // noon UTC for stability across DST

  if (schedule.interval === 'daily') {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    for (let i = 0; i < count; i++) {
      out.push(new Date(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return out
  }

  if (schedule.interval === 'weekly') {
    const weekdayIdx = WEEKDAY_INDEX[schedule.weekday ?? 'friday'] ?? 5
    let daysUntil = (weekdayIdx - cursor.getUTCDay() + 7) % 7
    if (daysUntil === 0) daysUntil = 7
    cursor.setUTCDate(cursor.getUTCDate() + daysUntil)
    for (let i = 0; i < count; i++) {
      out.push(new Date(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }
    return out
  }

  // monthly
  const monthDay = schedule.monthDay ?? 1
  let year = cursor.getUTCFullYear()
  let month = cursor.getUTCMonth()
  for (let i = 0; i < count; i++) {
    // Stripe collapses monthDay > last-day-of-month to last-day-of-month.
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const day = Math.min(monthDay, lastDay)
    const candidate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0))
    if (candidate <= cursor) {
      // already past this month — advance.
      month++
      if (month > 11) {
        month = 0
        year++
      }
      i-- // re-try with the next month, doesn't count toward output
      continue
    }
    out.push(candidate)
    month++
    if (month > 11) {
      month = 0
      year++
    }
  }
  return out
}
