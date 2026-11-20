import { describe, it, expect } from 'vitest'
import { denseDailyCents, forecastFromDailyCents, linearRegression } from '@/lib/revenue-forecast'

const START = new Date('2026-10-16T00:00:00.000Z')
/** A 30-day series with `cents` on the given day indexes and 0 elsewhere. */
const on = (days: number[], cents: number) => Array.from({ length: 30 }, (_, i) => (days.includes(i) ? cents : 0))
// Eight days placed symmetrically about the middle of the month, so the fitted line is flat.
const SPREAD = [0, 4, 8, 12, 17, 21, 25, 29]

describe('denseDailyCents', () => {
  it('puts each row on its calendar day and fills days without a row with 0', () => {
    const rows = [
      { date: '2026-10-16', revenueCents: 5 },
      { date: '2026-10-18', revenueCents: 7 },
      { date: '2026-11-14', revenueCents: 9 },
    ]
    const series = denseDailyCents(rows, START, 30)
    expect(series).toHaveLength(30)
    expect(series[0]).toBe(5)
    expect(series[1]).toBe(0)
    expect(series[2]).toBe(7)
    expect(series[29]).toBe(9)
    expect(series.reduce((s, c) => s + c, 0)).toBe(21)
  })

  it('ignores rows outside the window', () => {
    expect(denseDailyCents([{ date: '2026-10-15', revenueCents: 99 }, { date: '2026-11-15', revenueCents: 99 }], START, 30))
      .toEqual(Array(30).fill(0))
  })
})

describe('forecastFromDailyCents', () => {
  it('reads days spread over the month as a month, not as consecutive days', () => {
    // $1 on 8 days of 30: the flat line is 800/30 cents a day, so 800 cents over the next 30 days
    // (as consecutive days it would be $1 a day, $30 a month).
    expect(forecastFromDailyCents(on(SPREAD, 100), 30)).toEqual({ projectedCents: 800, growthRate: 0, rSquared: 0 })
  })

  it('sums the unrounded daily predictions and rounds once', () => {
    // 8/30 of a cent a day rounds to 0 each day, but 8 cents over 30 days.
    expect(forecastFromDailyCents(on(SPREAD, 1), 30).projectedCents).toBe(8)
  })

  it('starts at the first day with revenue; later days without revenue stay in as 0', () => {
    // 100 cents on each of the last 7 days: a steady 100 a day, not a ramp from zero.
    expect(forecastFromDailyCents(on([23, 24, 25, 26, 27, 28, 29], 100), 30)).toEqual({ projectedCents: 3000, growthRate: 0, rSquared: 0 })
    // Revenue on the first 7 days, then nothing: the line falls through zero, so nothing is projected.
    const stopped = forecastFromDailyCents(on([0, 1, 2, 3, 4, 5, 6], 100), 30)
    expect(stopped.projectedCents).toBe(0)
    expect(stopped.growthRate).toBe(-1)
  })

  it('gives nothing for a month without revenue', () => {
    expect(forecastFromDailyCents(Array(30).fill(0), 30)).toEqual({ projectedCents: 0, growthRate: 0, rSquared: 0 })
  })

  it('follows a straight line exactly', () => {
    const series = Array.from({ length: 30 }, (_, i) => 10 * (i + 1)) // 10 to 300 cents
    // Days 31 to 60 at 10 cents each: 10 × (31 + … + 60) = 13650; second-half average 230 against 80.
    expect(forecastFromDailyCents(series, 30)).toEqual({ projectedCents: 13650, growthRate: 1.875, rSquared: 1 })
  })
})

describe('linearRegression', () => {
  it('handles empty, single and flat input', () => {
    expect(linearRegression([])).toEqual({ slope: 0, intercept: 0, rSquared: 0 })
    expect(linearRegression([4])).toEqual({ slope: 0, intercept: 4, rSquared: 0 })
    expect(linearRegression([3, 3, 3])).toEqual({ slope: 0, intercept: 3, rSquared: 0 })
  })
})
