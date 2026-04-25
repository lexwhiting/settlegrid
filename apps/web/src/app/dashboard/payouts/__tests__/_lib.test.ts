/**
 * P3.RAIL3 — Unit tests for the /dashboard/payouts pure helpers.
 *
 * The page server-component drags `db` + `requireDeveloper` +
 * `getStripeClient` into the import graph; the helpers under test live
 * in `_lib.ts` so vitest can import them in isolation.
 */

import { describe, it, expect } from 'vitest'
import { nextPayoutDates, SCHEDULE_TTL_MS, WEEKDAY_INDEX } from '../_lib'

describe('SCHEDULE_TTL_MS', () => {
  it('is exactly one hour in milliseconds', () => {
    expect(SCHEDULE_TTL_MS).toBe(60 * 60 * 1000)
  })
})

describe('WEEKDAY_INDEX', () => {
  it('maps days to JS UTCDay() positions', () => {
    expect(WEEKDAY_INDEX.sunday).toBe(0)
    expect(WEEKDAY_INDEX.monday).toBe(1)
    expect(WEEKDAY_INDEX.tuesday).toBe(2)
    expect(WEEKDAY_INDEX.wednesday).toBe(3)
    expect(WEEKDAY_INDEX.thursday).toBe(4)
    expect(WEEKDAY_INDEX.friday).toBe(5)
    expect(WEEKDAY_INDEX.saturday).toBe(6)
  })
})

describe('nextPayoutDates', () => {
  // Anchor the "from" so tests are deterministic regardless of when
  // they run. 2026-04-15 is a Wednesday (UTCDay = 3).
  const anchor = new Date('2026-04-15T10:00:00.000Z')

  it('returns [] for manual schedule', () => {
    const dates = nextPayoutDates(
      { interval: 'manual', weekday: null, monthDay: null },
      5,
      anchor,
    )
    expect(dates).toEqual([])
  })

  it('daily emits the next N consecutive days at noon UTC', () => {
    const dates = nextPayoutDates(
      { interval: 'daily', weekday: null, monthDay: null },
      3,
      anchor,
    )
    expect(dates).toHaveLength(3)
    expect(dates[0].toISOString()).toBe('2026-04-16T12:00:00.000Z')
    expect(dates[1].toISOString()).toBe('2026-04-17T12:00:00.000Z')
    expect(dates[2].toISOString()).toBe('2026-04-18T12:00:00.000Z')
  })

  it('weekly emits the next N occurrences of the chosen weekday', () => {
    // Friday from Wed 4/15 → 4/17, 4/24, 5/1
    const dates = nextPayoutDates(
      { interval: 'weekly', weekday: 'friday', monthDay: null },
      3,
      anchor,
    )
    expect(dates.map((d) => d.toISOString())).toEqual([
      '2026-04-17T12:00:00.000Z',
      '2026-04-24T12:00:00.000Z',
      '2026-05-01T12:00:00.000Z',
    ])
  })

  it('weekly skips the current weekday — never returns "today" even at midnight', () => {
    // Wednesday from Wed 4/15 → 4/22 (NOT 4/15 itself).
    const dates = nextPayoutDates(
      { interval: 'weekly', weekday: 'wednesday', monthDay: null },
      2,
      anchor,
    )
    expect(dates.map((d) => d.toISOString())).toEqual([
      '2026-04-22T12:00:00.000Z',
      '2026-04-29T12:00:00.000Z',
    ])
  })

  it('weekly defaults to friday when weekday is null', () => {
    const withNull = nextPayoutDates(
      { interval: 'weekly', weekday: null, monthDay: null },
      1,
      anchor,
    )
    const explicit = nextPayoutDates(
      { interval: 'weekly', weekday: 'friday', monthDay: null },
      1,
      anchor,
    )
    expect(withNull[0].toISOString()).toBe(explicit[0].toISOString())
  })

  it('weekly with bogus weekday name falls back to friday', () => {
    const dates = nextPayoutDates(
      { interval: 'weekly', weekday: 'fooday', monthDay: null },
      1,
      anchor,
    )
    expect(dates[0].toISOString()).toBe('2026-04-17T12:00:00.000Z')
  })

  it('monthly with day=15 from anchor 2026-04-15 returns May 15, Jun 15, Jul 15', () => {
    // Cursor sets to noon today; April 15 noon == cursor; <= condition triggers; advance.
    const dates = nextPayoutDates(
      { interval: 'monthly', weekday: null, monthDay: 15 },
      3,
      anchor,
    )
    expect(dates.map((d) => d.toISOString())).toEqual([
      '2026-05-15T12:00:00.000Z',
      '2026-06-15T12:00:00.000Z',
      '2026-07-15T12:00:00.000Z',
    ])
  })

  it('monthly with monthDay=31 falls back to the last day of shorter months', () => {
    // From Jan 15 2026 with monthDay=31:
    //   Jan 31, Feb 28 (non-leap), Mar 31
    const fromJan = new Date('2026-01-15T10:00:00.000Z')
    const dates = nextPayoutDates(
      { interval: 'monthly', weekday: null, monthDay: 31 },
      3,
      fromJan,
    )
    expect(dates.map((d) => d.toISOString())).toEqual([
      '2026-01-31T12:00:00.000Z',
      '2026-02-28T12:00:00.000Z',
      '2026-03-31T12:00:00.000Z',
    ])
  })

  it('monthly defaults monthDay=1 when null', () => {
    const dates = nextPayoutDates(
      { interval: 'monthly', weekday: null, monthDay: null },
      1,
      anchor,
    )
    expect(dates[0].toISOString()).toBe('2026-05-01T12:00:00.000Z')
  })

  it('monthly handles year-boundary crossings (Dec → Jan)', () => {
    const fromDec = new Date('2026-12-15T10:00:00.000Z')
    const dates = nextPayoutDates(
      { interval: 'monthly', weekday: null, monthDay: 1 },
      2,
      fromDec,
    )
    expect(dates.map((d) => d.toISOString())).toEqual([
      '2027-01-01T12:00:00.000Z',
      '2027-02-01T12:00:00.000Z',
    ])
  })

  it('count=0 returns empty', () => {
    const dates = nextPayoutDates(
      { interval: 'daily', weekday: null, monthDay: null },
      0,
      anchor,
    )
    expect(dates).toEqual([])
  })

  it('respects the count parameter exactly', () => {
    const fiveDaily = nextPayoutDates(
      { interval: 'daily', weekday: null, monthDay: null },
      5,
      anchor,
    )
    expect(fiveDaily).toHaveLength(5)
  })

  it('does not mutate the from Date passed by the caller', () => {
    const before = anchor.toISOString()
    nextPayoutDates(
      { interval: 'daily', weekday: null, monthDay: null },
      3,
      anchor,
    )
    expect(anchor.toISOString()).toBe(before)
  })

  it('all returned dates are at noon UTC for DST stability', () => {
    const dates = nextPayoutDates(
      { interval: 'weekly', weekday: 'monday', monthDay: null },
      4,
      anchor,
    )
    for (const d of dates) {
      expect(d.getUTCHours()).toBe(12)
      expect(d.getUTCMinutes()).toBe(0)
      expect(d.getUTCSeconds()).toBe(0)
      expect(d.getUTCMilliseconds()).toBe(0)
    }
  })
})
