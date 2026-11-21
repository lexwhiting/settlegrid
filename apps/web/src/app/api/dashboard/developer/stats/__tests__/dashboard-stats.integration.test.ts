/**
 * The dashboard stats, forecast and analytics routes against real SQL (pglite).
 *
 * Every figure covers all of the developer's tools, deleted ones included, and
 * never another developer's. "Active Tools" counts status 'active'. No figure
 * is capped by the number of tools. The forecast reads the last 30 complete UTC
 * days and needs 7 of them with revenue; days without revenue count as 0. The
 * analytics revenue trend covers every one of the 30 UTC days ending today.
 * Hours and days are UTC whatever the session time zone.
 *
 * The schema is a test-only CREATE TABLE bootstrap of the columns these
 * routes read (no drizzle-kit, no migrations). Fixtures are SQL inserts. The
 * clock is fixed and the session time zone is UTC unless a test sets another.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'
import { hourLabel } from '@/lib/dashboard-summaries'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const authState = vi.hoisted(() => ({ id: '' }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: vi.fn(async () => ({ id: authState.id })) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET as getStats } from '../route'
import { GET as getForecast } from '../forecast/route'
import { GET as getAnalytics } from '../analytics/route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY, tier text NOT NULL DEFAULT 'standard',
    is_founding_member boolean NOT NULL DEFAULT false);
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id uuid NOT NULL REFERENCES developers(id), status text NOT NULL DEFAULT 'draft',
    total_invocations integer NOT NULL DEFAULT 0, total_revenue_cents integer NOT NULL DEFAULT 0);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id uuid NOT NULL REFERENCES tools(id), cost_cents integer NOT NULL,
    status text NOT NULL DEFAULT 'success', created_at timestamptz NOT NULL,
    consumer_id uuid, method text, latency_ms integer);
`

// Not hour-aligned: the last 24 hours touch 25 clock hours. "Today" is 2026-11-15, so the
// forecast window is the 30 days from 2026-10-16 to 2026-11-14.
const NOW = new Date('2026-11-15T12:30:00.000Z')
const [MIN, HOUR, DAY] = [60_000, 3_600_000, 86_400_000]
const at = (msBeforeNow: number) => new Date(NOW.getTime() - msBeforeNow).toISOString()

let n = 0 // deterministic UUIDs: prefix + counter
const uid = (prefix: string) => `${prefix}-0000-4000-8000-${String(++n).padStart(12, '0')}`
let pg: PGlite

async function developer(tier = 'builder') {
  const id = uid('d0000000')
  await pg.query('INSERT INTO developers (id, tier) VALUES ($1, $2)', [id, tier])
  return id
}
/** A tool with its all-time counters (calls, revenue in cents). */
async function tool(developerId: string, status: string, calls = 0, revenueCents = 0) {
  const id = uid('a0000000')
  await pg.query(
    'INSERT INTO tools (id, developer_id, status, total_invocations, total_revenue_cents) VALUES ($1, $2, $3, $4, $5)',
    [id, developerId, status, calls, revenueCents],
  )
  return id
}
async function invocation(toolId: string, costCents: number, createdAt: string, status = 'success') {
  await pg.query(
    'INSERT INTO invocations (tool_id, cost_cents, status, created_at) VALUES ($1, $2, $3, $4)',
    [toolId, costCents, status, createdAt],
  )
}
/** A developer with one live tool and one call of `cents(d)` at 12:30 on each day `d` days ago. */
async function earner(days: number[], cents: (d: number) => number) {
  const id = await developer()
  const t = await tool(id, 'active')
  for (const d of days) await invocation(t, cents(d), at(d * DAY))
  return { id, tool: t }
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

async function call(handler: typeof getStats, developerId: string) {
  authState.id = developerId
  const res = await handler(new NextRequest('http://localhost:3005/api/dashboard/developer/stats'))
  return { status: res.status, body: await res.json() }
}

const DEV = {
  a: '', b: '', gone: '', idle: '', none: '', logOnly: '', many: '', hourly: '', steady: '', today: '',
  old: '', six: '', falling: '', rising: '', zeroDays: '', mixed: '', spread: '', spreadCents: '', stopped: '', future: '', lateNight: '',
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })

  // A: a live, a draft and a deleted tool. B: another developer.
  DEV.a = await developer()
  DEV.b = await developer()
  const live = await tool(DEV.a, 'active', 10, 100)
  const draft = await tool(DEV.a, 'draft')
  const deleted = await tool(DEV.a, 'deleted', 4, 40)
  const other = await tool(DEV.b, 'active', 99, 999)
  await invocation(live, 5, at(1 * MIN))
  await invocation(live, 5, at(2 * HOUR))
  await invocation(live, 0, at(3 * DAY), 'error')
  await invocation(draft, 2, at(1 * MIN))
  await invocation(deleted, 7, at(1 * MIN))
  await invocation(deleted, 7, at(4 * DAY))
  await invocation(live, 11, '2026-11-01T00:00:00.000Z') // the first instant of this UTC month
  await invocation(live, 13, '2026-10-31T23:59:59.999Z') // the last instant of last month
  await invocation(other, 50, at(1 * MIN))

  // Only a deleted tool; a live tool with no calls; no tools at all; a logged call the counter never saw.
  DEV.gone = await developer()
  await invocation(await tool(DEV.gone, 'deleted', 1, 3), 3, at(5 * DAY))
  DEV.idle = await developer()
  await tool(DEV.idle, 'active')
  DEV.none = await developer()
  DEV.logOnly = await developer()
  await invocation(await tool(DEV.logOnly, 'active'), 0, at(1 * DAY), 'error')

  // 520 deleted tools and one live tool, each with a counter of 1 call / 1 cent and one
  // 1-cent call at 12:31 on each of the last 30 complete days.
  DEV.many = await developer()
  await pg.query(
    `INSERT INTO tools (developer_id, status, total_invocations, total_revenue_cents)
     SELECT $1, CASE WHEN g = 1 THEN 'active' ELSE 'deleted' END, 1, 1 FROM generate_series(1, 521) g`,
    [DEV.many],
  )
  await pg.query(
    `INSERT INTO invocations (tool_id, cost_cents, created_at)
     SELECT t.id, 1, $2::timestamptz - d * interval '1 day' FROM tools t, generate_series(1, 30) d WHERE t.developer_id = $1`,
    [DEV.many, at(-1 * MIN)],
  )

  // One 1-cent call in each of the 25 clock hours the last 24 hours touch, and a larger one just before them.
  const hourlyDev = await earner([], () => 0)
  DEV.hourly = hourlyDev.id
  const hourly = hourlyDev.tool
  for (let h = 0; h < 24; h++) await invocation(hourly, 1, at(h * HOUR))
  await invocation(hourly, 1, at(24 * HOUR - 15 * MIN))
  await invocation(hourly, 99, at(24 * HOUR + MIN))

  // 1 cent on each of the 30 window days, with larger calls today and on the day before the window.
  const steady = await earner(range(1, 30), () => 1)
  DEV.steady = steady.id
  await invocation(steady.tool, 50, at(1 * MIN))
  await invocation(steady.tool, 100, at(31 * DAY))

  // 100 cents on each of the last 7 complete days, and a much larger call today.
  const today = await earner(range(1, 7), () => 100)
  DEV.today = today.id
  await invocation(today.tool, 5000, at(1 * MIN))

  DEV.old = (await earner(range(31, 37), () => 10)).id // 7 revenue days, all before the window
  DEV.six = (await earner(range(1, 6), () => 10)).id // one revenue day short
  DEV.falling = (await earner(range(1, 8), (d) => 10 + d)).id // 18 cents 8 days ago down to 11 yesterday
  DEV.rising = (await earner(range(1, 30), (d) => (31 - d) * 10)).id // 10 cents 30 days ago up to 300 yesterday
  DEV.zeroDays = (await earner(range(1, 7), (d) => (d === 1 ? 5 : 0))).id // one revenue day, six that earned nothing
  DEV.mixed = (await earner(range(1, 20), (d) => (d <= 7 ? (8 - d) * 100 : 0))).id // 7 revenue days among 20 with calls
  // Eight revenue days placed symmetrically about the middle of the window (days 30 to 1 ago), and none between.
  const spreadDays = [30, 26, 22, 18, 13, 9, 5, 1]
  DEV.spread = (await earner(spreadDays, () => 100)).id
  DEV.spreadCents = (await earner(spreadDays, () => 1)).id
  DEV.stopped = (await earner(range(24, 30), () => 100)).id // 100 cents on each of the first 7 window days, then nothing
  // 100 cents at 00:30 UTC on each of the last 7 complete days: the evening before, in New York.
  const lateNight = await earner([], () => 0)
  DEV.lateNight = lateNight.id
  for (const d of range(1, 7)) await invocation(lateNight.tool, 100, new Date(Date.UTC(2026, 10, 15 - d, 0, 30)).toISOString())
  // 5 cents today and a future-dated 7 cents tomorrow (a skewed clock).
  const future = await earner([], () => 0)
  DEV.future = future.id
  await invocation(future.tool, 5, at(1 * MIN))
  await invocation(future.tool, 7, at(-1 * DAY))
}, 120_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('dashboard stats and forecast (pglite)', () => {
  it('stats: active tools, tools created, all-time counters and this month\'s revenue cover the developer\'s own tools', async () => {
    const { status, body } = await call(getStats, DEV.a)
    expect(status).toBe(200)
    expect(body.toolCount).toBe(1) // status 'active' only
    expect(body.toolsCreated).toBe(3)
    expect(body.totalInvocations).toBe(14) // counters: 10 + 0 + 4 on the deleted tool
    expect(body.totalRevenueCents).toBe(140)
    expect(body.hasInvocations).toBe(true)
    expect(body.monthRevenueCents).toBe(37) // 5 + 5 + 0 + 2 + 7 + 7 + 11; not October's 13 or B's 50
    const b = await call(getStats, DEV.b)
    expect(b.body.totalInvocations).toBe(99)
    expect(b.body.monthRevenueCents).toBe(50)
  }, 20_000)

  it('analytics: covers only the developer\'s own tools, deleted ones included, never another developer\'s', async () => {
    // A: 8 calls (live, draft and deleted tools; one error), 50 cents in all. B: one 50-cent call on its own tool.
    const a = (await call(getAnalytics, DEV.a)).body
    const aCalls = (a.methodBreakdown as Array<{ count: number }>).reduce((s, m) => s + m.count, 0)
    expect(aCalls).toBe(8) // not 9: B's call is left out
    expect((a.revenueTrend as Array<{ revenueCents: number }>).reduce((s, d) => s + d.revenueCents, 0)).toBe(50) // not 100
    expect(a.errorRate).toBe(12.5) // 1 error in A's 8 calls
    const b = (await call(getAnalytics, DEV.b)).body
    expect((b.methodBreakdown as Array<{ count: number }>).reduce((s, m) => s + m.count, 0)).toBe(1)
    expect((b.revenueTrend as Array<{ revenueCents: number }>).reduce((s, d) => s + d.revenueCents, 0)).toBe(50)
    expect(b.errorRate).toBe(0)
    // A developer with no tools gets the empty response, not anyone else's data.
    const none = (await call(getAnalytics, DEV.none)).body
    expect(none).toMatchObject({ methodBreakdown: [], topConsumers: [], revenueTrend: [], errorRate: 0 })
  }, 20_000)

  it('stats: the last 24 hours cover every tool the developer owns', async () => {
    const { body } = await call(getStats, DEV.a)
    const rows = body.recentInvocations as Array<{ count: number; revenueCents: number }>
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(4)
    expect(rows.reduce((s, r) => s + r.revenueCents, 0)).toBe(19)
  }, 20_000)

  it('stats: "made a test invocation" follows the counter or the logs', async () => {
    const gone = await call(getStats, DEV.gone)
    expect(gone.body).toMatchObject({ toolCount: 0, toolsCreated: 1, totalInvocations: 1, hasInvocations: true, totalRevenueCents: 3 })
    const logOnly = await call(getStats, DEV.logOnly)
    expect(logOnly.body).toMatchObject({ totalInvocations: 0, hasInvocations: true })
    const idle = await call(getStats, DEV.idle)
    expect(idle.body).toMatchObject({ toolCount: 1, toolsCreated: 1, hasInvocations: false, recentInvocations: [] })
    const none = await call(getStats, DEV.none)
    expect(none.body).toMatchObject({ toolCount: 0, toolsCreated: 0, totalInvocations: 0, hasInvocations: false, monthRevenueCents: 0 })
  }, 20_000)

  it('stats, forecast and analytics count all 521 tools of one developer in every query', async () => {
    const stats = await call(getStats, DEV.many)
    expect(stats.body).toMatchObject({ toolCount: 1, toolsCreated: 521, totalInvocations: 521, totalRevenueCents: 521 })
    expect(stats.body.monthRevenueCents).toBe(14 * 521) // Nov 1 to Nov 14
    const rows = stats.body.recentInvocations as Array<{ count: number; revenueCents: number }>
    expect(rows.reduce((s, r) => s + r.revenueCents, 0)).toBe(521) // yesterday at 12:31
    const forecast = await call(getForecast, DEV.many)
    expect(forecast.body).toMatchObject({ dailyDataPoints: 30, projectedNextMonthCents: 30 * 521, currentMonthRevenueCents: 14 * 521 })
    const analytics = (await call(getAnalytics, DEV.many)).body
    const trend = analytics.revenueTrend as Array<{ revenueCents: number }>
    expect(trend.reduce((sum, d) => sum + d.revenueCents, 0)).toBe(29 * 521) // the 29 window days before today
    expect(analytics.methodBreakdown).toEqual([expect.objectContaining({ count: 30 * 521, totalRevenueCents: 30 * 521 })])
  }, 30_000)

  it('stats: the last 24 hours keep all 25 clock hours, the current one included, and nothing older', async () => {
    const { body } = await call(getStats, DEV.hourly)
    const rows = body.recentInvocations as Array<{ hour: string; count: number; revenueCents: number }>
    expect(rows).toHaveLength(25)
    expect(rows.at(-1)?.hour).toBe('2026-11-15T12:00:00Z') // ISO 8601, UTC
    expect(rows.reduce((s, r) => s + r.revenueCents, 0)).toBe(25)
  }, 20_000)

  it('forecast: below 7 revenue days it reports insufficient data, with this month\'s revenue as stats gives it', async () => {
    // [developer, revenue days in the window, this month's revenue]
    const expected = [
      [DEV.a, 3, 37], [DEV.gone, 1, 3], [DEV.zeroDays, 1, 5], [DEV.six, 6, 60], [DEV.idle, 0, 0], [DEV.none, 0, 0], [DEV.old, 0, 0],
    ] as const
    for (const [id, revenueDays, monthCents] of expected) {
      const { status, body } = await call(getForecast, id)
      expect(status).toBe(200)
      expect(body).toMatchObject({ insufficientData: true, dailyDataPoints: revenueDays, projectedNextMonthCents: 0, trend: 'stable' })
      expect(body.currentMonthRevenueCents).toBe(monthCents)
      expect((await call(getStats, id)).body.monthRevenueCents).toBe(monthCents)
    }
  }, 30_000)

  it('forecast: reads the 30 complete days before today, not today and nothing older', async () => {
    const steady = await call(getForecast, DEV.steady)
    expect(steady.body.insufficientData).toBeUndefined()
    expect(steady.body).toMatchObject({ dailyDataPoints: 30, projectedNextMonthCents: 30, growthRate: 0, trend: 'stable' })
    expect(steady.body.currentMonthRevenueCents).toBe(64) // Nov 1 to Nov 14, plus today's 50
    const today = await call(getForecast, DEV.today)
    expect(today.body).toMatchObject({ dailyDataPoints: 7, projectedNextMonthCents: 3000, growthRate: 0, trend: 'stable' })
  }, 20_000)

  it('forecast: 7 or more revenue days give a projection and trend; confidence counts revenue days only', async () => {
    const falling = await call(getForecast, DEV.falling)
    expect(falling.body.insufficientData).toBeUndefined()
    expect(falling.body).toMatchObject({
      dailyDataPoints: 8, projectedNextMonthCents: 55, growthRate: -0.2424, trend: 'declining', confidence: 'medium',
    })
    const rising = await call(getForecast, DEV.rising)
    expect(rising.body).toMatchObject({
      dailyDataPoints: 30, projectedNextMonthCents: 13650, growthRate: 1.875, trend: 'growing', confidence: 'high',
    })
    const mixed = await call(getForecast, DEV.mixed)
    expect(mixed.body.insufficientData).toBeUndefined()
    expect(mixed.body).toMatchObject({ dailyDataPoints: 7, confidence: 'medium' })
  }, 20_000)

  it('forecast: days without calls count as 0, and the daily predictions are rounded once', async () => {
    // 100 cents on 8 days spread over the window: 800 cents a month, not 100 a day for 30 days.
    const spread = await call(getForecast, DEV.spread)
    expect(spread.body).toMatchObject({ dailyDataPoints: 8, projectedNextMonthCents: 800, growthRate: 0, trend: 'stable', confidence: 'medium' })
    // 1 cent on the same days: 8/30 of a cent a day rounds to 0 each day but 8 cents over 30.
    const cents = await call(getForecast, DEV.spreadCents)
    expect(cents.body).toMatchObject({ dailyDataPoints: 8, projectedNextMonthCents: 8 })
    // Revenue in the first week only: nothing projected, and the trend says so.
    const stopped = await call(getForecast, DEV.stopped)
    expect(stopped.body.insufficientData).toBeUndefined()
    expect(stopped.body).toMatchObject({ dailyDataPoints: 7, projectedNextMonthCents: 0, growthRate: -1, trend: 'declining' })
  }, 20_000)

  it('analytics: the revenue trend covers the 30 UTC days ending today, today included', async () => {
    const { status, body } = await call(getAnalytics, DEV.steady)
    expect(status).toBe(200)
    const trend = body.revenueTrend as Array<{ date: string; revenueCents: number }>
    expect(trend).toHaveLength(30)
    expect(trend[0]).toEqual({ date: '2026-10-17', revenueCents: 1 }) // 29 days before today
    expect(trend.at(-1)).toEqual({ date: '2026-11-15', revenueCents: 50 }) // today
    expect(trend.reduce((s, d) => s + d.revenueCents, 0)).toBe(29 + 50) // not the call 31 days ago
  }, 20_000)

  it('analytics: days without calls are in the trend as 0, and nothing after today is', async () => {
    const spread = (await call(getAnalytics, DEV.spread)).body.revenueTrend as Array<{ date: string; revenueCents: number }>
    expect(spread).toHaveLength(30)
    expect(spread.map((d) => d.date)).toEqual(
      Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 17 + i)).toISOString().slice(0, 10)),
    )
    expect(spread.filter((d) => d.revenueCents > 0)).toHaveLength(7) // the call 30 days ago is before the window
    expect(spread.filter((d) => d.revenueCents === 0)).toHaveLength(23)
    const future = (await call(getAnalytics, DEV.future)).body.revenueTrend as Array<{ date: string; revenueCents: number }>
    expect(future).toHaveLength(30)
    expect(future.at(-1)).toEqual({ date: '2026-11-15', revenueCents: 5 })
    expect(future.reduce((s, d) => s + d.revenueCents, 0)).toBe(5)
  }, 20_000)

  it('hours and days stay UTC when the database session uses another time zone', async () => {
    await pg.exec("SET TIME ZONE 'America/New_York'")
    try {
      const hourly = (await call(getStats, DEV.hourly)).body.recentInvocations as Array<{ hour: string; revenueCents: number }>
      expect(hourly).toHaveLength(25)
      expect(hourly.at(-1)?.hour).toBe('2026-11-15T12:00:00Z')
      expect(hourLabel(hourly.at(-1)!.hour)).toBe('12:00')
      const analytics = (await call(getAnalytics, DEV.hourly)).body
      const hours = analytics.hourlyDistribution as Array<{ hour: number; count: number }>
      expect(hours.find((h) => h.hour === 12)?.count).toBe(3) // 12:30 today; 12:29 and 12:45 yesterday (UTC)
      expect(hours.find((h) => h.hour === 7)?.count).toBe(1) // 07:30 UTC today, not New York's 7 a.m.
      const trend = (await call(getAnalytics, DEV.steady)).body.revenueTrend as Array<{ date: string; revenueCents: number }>
      expect(trend[0]).toEqual({ date: '2026-10-17', revenueCents: 1 })
      expect(trend.at(-1)).toEqual({ date: '2026-11-15', revenueCents: 50 })
      const steady = (await call(getForecast, DEV.steady)).body
      expect(steady).toMatchObject({ dailyDataPoints: 30, projectedNextMonthCents: 30 })
      // Calls at 00:30 UTC belong to that UTC day, not to the New York evening before.
      const hourlyTrend = (await call(getAnalytics, DEV.hourly)).body.revenueTrend as Array<{ date: string; revenueCents: number }>
      expect(hourlyTrend.at(-1)).toEqual({ date: '2026-11-15', revenueCents: 13 }) // 00:30 to 12:30 UTC today
      expect(hourlyTrend.at(-2)).toEqual({ date: '2026-11-14', revenueCents: 111 }) // 12:29 to 23:30 UTC yesterday
      const lateNight = (await call(getForecast, DEV.lateNight)).body
      expect(lateNight).toMatchObject({ dailyDataPoints: 7, projectedNextMonthCents: 3000, growthRate: 0, trend: 'stable' })
    } finally {
      await pg.exec("SET TIME ZONE 'UTC'")
    }
  }, 30_000)
})
