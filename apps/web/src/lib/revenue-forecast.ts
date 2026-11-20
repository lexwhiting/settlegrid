/**
 * Revenue forecast maths for GET /api/dashboard/developer/stats/forecast.
 *
 * The route reads revenue per UTC day. Days with no calls have no row, so the
 * rows are first spread over a dense series of calendar days (missing days are
 * 0) before any trend is read from them.
 */

const DAY_MS = 86_400_000

/** One revenue figure (cents) per UTC day, `days` days from `start`; a day with no row is 0. */
export function denseDailyCents(
  rows: ReadonlyArray<{ date: string; revenueCents: number }>,
  start: Date,
  days: number,
): number[] {
  const byDate = new Map(rows.map((r) => [r.date, Number(r.revenueCents) || 0]))
  return Array.from(
    { length: days },
    (_, i) => byDate.get(new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10)) ?? 0,
  )
}

/** Least-squares line y = slope·x + intercept through (index, value), with R². */
export function linearRegression(ys: readonly number[]): { slope: number; intercept: number; rSquared: number } {
  const n = ys.length
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 }
  if (n === 1) return { slope: 0, intercept: ys[0], rSquared: 0 }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  ys.forEach((y, x) => {
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  })

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  const meanY = sumY / n
  let ssRes = 0
  let ssTot = 0
  ys.forEach((y, x) => {
    ssRes += (y - (slope * x + intercept)) ** 2
    ssTot += (y - meanY) ** 2
  })
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot)

  return { slope, intercept, rSquared }
}

/**
 * Projection and growth from a dense daily series (oldest first).
 *
 * The series starts at the first day with revenue: days before a developer first
 * earned in the window are not read as a ramp from zero. Later days without
 * revenue stay in as zeros. The projection sums the unrounded daily predictions
 * (each floored at 0) and rounds once. Growth compares the average of the second
 * half of the series with the first half; it is 0 when the first half earned nothing.
 */
export function forecastFromDailyCents(
  series: readonly number[],
  projectionDays: number,
): { projectedCents: number; growthRate: number; rSquared: number } {
  const first = series.findIndex((c) => c > 0)
  const ys = first === -1 ? [] : series.slice(first)
  if (ys.length === 0) return { projectedCents: 0, growthRate: 0, rSquared: 0 }

  const { slope, intercept, rSquared } = linearRegression(ys)
  const last = ys.length - 1
  let projected = 0
  for (let i = 1; i <= projectionDays; i++) projected += Math.max(0, slope * (last + i) + intercept)

  const midpoint = Math.max(1, Math.floor(ys.length / 2))
  const avg = (xs: readonly number[]) => (xs.length > 0 ? xs.reduce((s, c) => s + c, 0) / xs.length : 0)
  const firstHalfAvg = avg(ys.slice(0, midpoint))
  const secondHalfAvg = avg(ys.slice(midpoint))
  const growthRate = firstHalfAvg > 0
    ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 10000) / 10000
    : 0

  return { projectedCents: Math.round(projected), growthRate, rSquared }
}
