/**
 * The dashboard stats and forecast routes against real SQL (pglite).
 *
 * Every figure covers all of the developer's tools, deleted ones included, and
 * never another developer's. "Active Tools" counts status 'active'. No figure
 * is capped by the number of tools. The forecast reads the last 30 complete UTC
 * days and needs 7 of them with revenue.
 *
 * The schema is a test-only CREATE TABLE bootstrap of the columns these two
 * routes read (no drizzle-kit, no migrations). Fixtures are SQL inserts. The
 * clock is fixed and the session time zone is UTC.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

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

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY, tier text NOT NULL DEFAULT 'standard',
    is_founding_member boolean NOT NULL DEFAULT false);
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id uuid NOT NULL REFERENCES developers(id), status text NOT NULL DEFAULT 'draft',
    total_invocations integer NOT NULL DEFAULT 0, total_revenue_cents integer NOT NULL DEFAULT 0);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id uuid NOT NULL REFERENCES tools(id), cost_cents integer NOT NULL,
    status text NOT NULL DEFAULT 'success', created_at timestamptz NOT NULL);
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
  old: '', six: '', falling: '', rising: '', zeroDays: '', mixed: '',
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

  it('stats and forecast count all 521 tools of one developer in every query', async () => {
    const stats = await call(getStats, DEV.many)
    expect(stats.body).toMatchObject({ toolCount: 1, toolsCreated: 521, totalInvocations: 521, totalRevenueCents: 521 })
    expect(stats.body.monthRevenueCents).toBe(14 * 521) // Nov 1 to Nov 14
    const rows = stats.body.recentInvocations as Array<{ count: number; revenueCents: number }>
    expect(rows.reduce((s, r) => s + r.revenueCents, 0)).toBe(521) // yesterday at 12:31
    const forecast = await call(getForecast, DEV.many)
    expect(forecast.body).toMatchObject({ dailyDataPoints: 30, projectedNextMonthCents: 30 * 521, currentMonthRevenueCents: 14 * 521 })
  }, 30_000)

  it('stats: the last 24 hours keep all 25 clock hours, the current one included, and nothing older', async () => {
    const { body } = await call(getStats, DEV.hourly)
    const rows = body.recentInvocations as Array<{ hour: string; count: number; revenueCents: number }>
    expect(rows).toHaveLength(25)
    expect(rows.at(-1)?.hour).toContain('2026-11-15 12:00')
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
})
