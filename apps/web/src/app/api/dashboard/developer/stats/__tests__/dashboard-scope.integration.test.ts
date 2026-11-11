/**
 * The dashboard routes (stats, analytics, insights, forecast) against real SQL (pglite).
 * Activity covers the developer's non-deleted tools; earnings cover every tool;
 * no route caps the tool set; the forecast needs 7 days. The schema is a test-only
 * CREATE TABLE bootstrap of the columns these routes read (no drizzle-kit, no
 * migrations); fixtures are SQL inserts; the clock is fixed.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'
import { dashboardToolsWhere, invocationsInDashboardScope } from '@/lib/dashboard-scope'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const authState = vi.hoisted(() => ({ id: '' }))

vi.mock('@/lib/db', () => ({
  db: new Proxy(
    {},
    {
      get(_t, prop, recv) {
        const real = holder.db as unknown as Record<string | symbol, unknown>
        if (!real) throw new Error('pglite db not initialized (beforeAll did not run)')
        const value = Reflect.get(real, prop, recv)
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
      },
    },
  ),
}))
vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: vi.fn(async () => ({ id: authState.id, email: 'dev@example.test' })),
}))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET as getStats } from '../route'
import { GET as getAnalytics } from '../analytics/route'
import { GET as getForecast } from '../forecast/route'
import { GET as getInsights } from '../../consumers/insights/route'

const { tools, invocations } = schema

/** Only the columns the routes read (total_invocations: read by the stats route on main). */
const BOOTSTRAP_SQL = `
  CREATE TABLE developers (id uuid PRIMARY KEY, tier text NOT NULL DEFAULT 'standard',
    is_founding_member boolean NOT NULL DEFAULT false);
  CREATE TABLE tools (id uuid PRIMARY KEY, developer_id uuid NOT NULL REFERENCES developers(id),
    status text NOT NULL DEFAULT 'draft', total_invocations integer NOT NULL DEFAULT 0,
    total_revenue_cents integer NOT NULL DEFAULT 0);
  CREATE TABLE consumers (id uuid PRIMARY KEY, email text NOT NULL UNIQUE);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id uuid NOT NULL REFERENCES tools(id), consumer_id uuid NOT NULL REFERENCES consumers(id),
    method text NOT NULL DEFAULT 'run', cost_cents integer NOT NULL, latency_ms integer,
    status text NOT NULL DEFAULT 'success', is_test boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL);
`

const NOW = new Date('2026-11-15T12:00:00.000Z')
const [MIN, HOUR, DAY] = [60_000, 3_600_000, 86_400_000]
const at = (msBeforeNow: number) => new Date(NOW.getTime() - msBeforeNow).toISOString()

let n = 0 // deterministic UUIDs: prefix + counter
const uid = (prefix: string) => `${prefix}-0000-4000-8000-${String(++n).padStart(12, '0')}`

const DEV = { a: '', b: '', gone: '', manyDeleted: '', wide: '', trend: '' }
const TOOL = { live: '', draft: '', deleted: '', other: '' }
const C1 = uid('c0000001')
const C2 = uid('c0000002')

let pg: PGlite

async function developer(tier = 'standard') {
  const id = uid('d0000000')
  await pg.query('INSERT INTO developers (id, tier) VALUES ($1, $2)', [id, tier])
  return id
}
async function tool(developerId: string, status: string, totalRevenueCents = 0) {
  const id = uid('a0000000')
  await pg.query(
    'INSERT INTO tools (id, developer_id, status, total_revenue_cents) VALUES ($1, $2, $3, $4)',
    [id, developerId, status, totalRevenueCents],
  )
  return id
}
async function invocation(toolId: string, consumerId: string, costCents: number, createdAt: string, status = 'success') {
  await pg.query(
    'INSERT INTO invocations (tool_id, consumer_id, cost_cents, status, created_at) VALUES ($1, $2, $3, $4, $5)',
    [toolId, consumerId, costCents, status, createdAt],
  )
}

async function call(handler: typeof getStats, developerId: string, path: string) {
  authState.id = developerId
  const res = await handler(new NextRequest(`http://localhost:3005${path}`))
  return { status: res.status, body: await res.json() }
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)

  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })

  await pg.query('INSERT INTO consumers (id, email) VALUES ($1, $2), ($3, $4)', [C1, 'c1@example.test', C2, 'c2@example.test'])

  // Developer A: one live, one draft and one deleted tool. Developer B: one live tool.
  DEV.a = await developer('scale')
  DEV.b = await developer('scale')
  TOOL.live = await tool(DEV.a, 'active', 100)
  TOOL.draft = await tool(DEV.a, 'draft', 0)
  TOOL.deleted = await tool(DEV.a, 'deleted', 40)
  TOOL.other = await tool(DEV.b, 'active', 999)
  await invocation(TOOL.live, C1, 5, at(1 * MIN))
  await invocation(TOOL.live, C1, 5, at(2 * HOUR))
  await invocation(TOOL.live, C2, 0, at(3 * DAY), 'error')
  await invocation(TOOL.draft, C2, 2, at(1 * MIN))
  await invocation(TOOL.deleted, C1, 7, at(1 * MIN))
  await invocation(TOOL.deleted, C1, 7, at(4 * DAY))
  await invocation(TOOL.other, C1, 50, at(1 * MIN))

  // A developer whose only tool is deleted.
  DEV.gone = await developer()
  await invocation(await tool(DEV.gone, 'deleted', 3), C1, 3, at(5 * DAY))

  // 520 deleted tools ahead of one live tool.
  DEV.manyDeleted = await developer()
  await pg.query(
    `INSERT INTO tools (id, developer_id, status)
     SELECT gen_random_uuid(), $1, 'deleted' FROM generate_series(1, 520)`,
    [DEV.manyDeleted],
  )
  const manyLive = await tool(DEV.manyDeleted, 'active')
  await invocation(manyLive, C1, 1, at(1 * MIN))
  await invocation(manyLive, C1, 1, at(1 * MIN))

  // 520 live tools, one 1-cent call each, spread over 8 days this month.
  DEV.wide = await developer('scale')
  await pg.query(
    `INSERT INTO tools (id, developer_id, status)
     SELECT gen_random_uuid(), $1, 'active' FROM generate_series(1, 520)`,
    [DEV.wide],
  )
  await pg.query(
    `INSERT INTO invocations (tool_id, consumer_id, cost_cents, created_at)
     SELECT t.id, $2, 1, $3::timestamptz - ((row_number() OVER (ORDER BY t.id)) % 8 + 1) * interval '1 day'
     FROM tools t WHERE t.developer_id = $1`,
    [DEV.wide, C2, NOW.toISOString()],
  )

  // 8 days of revenue on a live tool, plus 5 more days only on a deleted tool.
  DEV.trend = await developer('builder')
  const trendLive = await tool(DEV.trend, 'active')
  const trendDeleted = await tool(DEV.trend, 'deleted')
  for (let i = 0; i < 8; i++) await invocation(trendLive, C1, 10 + i, at((i + 1) * DAY))
  for (let i = 0; i < 5; i++) await invocation(trendDeleted, C1, 10, at((i + 10) * DAY))
}, 120_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('dashboard tool scope (pglite)', () => {
  it('dashboardToolsWhere and invocationsInDashboardScope select the owner\'s non-deleted tools, uncapped', async () => {
    const db = holder.db
    const rows = await db.select({ id: tools.id }).from(tools).where(dashboardToolsWhere(DEV.a))
    expect(rows.map((r) => r.id).sort()).toEqual([TOOL.live, TOOL.draft].sort())
    const [scoped] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(invocations)
      .where(invocationsInDashboardScope(DEV.wide))
    expect(scoped.n).toBe(520)
  }, 20_000)

  it('stats: activity excludes deleted and other developers\' tools; earnings keep deleted tools', async () => {
    const { status, body } = await call(getStats, DEV.a, '/api/dashboard/developer/stats')
    expect(status).toBe(200)
    expect(body.toolCount).toBe(1) // status 'active' only
    expect(body.toolsCreated).toBe(3)
    expect(body.totalInvocations).toBe(4) // 3 on live (every status) + 1 on draft
    expect(body.hasInvocations).toBe(true)
    expect(body.totalRevenueCents).toBe(140) // 100 + 0 + 40, not developer B's 999
    expect(body.monthRevenueCents).toBe(26) // every November call on A's tools, deleted one included
  }, 20_000)

  it('stats: the last 24h counts calls on non-deleted tools but keeps a deleted tool\'s revenue', async () => {
    const { body } = await call(getStats, DEV.a, '/api/dashboard/developer/stats')
    const rows = body.recentInvocations as Array<{ count: number; revenueCents: number }>
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(3) // 2 on live + 1 on draft
    expect(rows.reduce((s, r) => s + r.revenueCents, 0)).toBe(19) // 5 + 5 + 2 + 7 on the deleted tool
  }, 20_000)

  it('stats: a call on a deleted tool still ticks "made a test invocation"', async () => {
    const { body } = await call(getStats, DEV.gone, '/api/dashboard/developer/stats')
    expect(body.toolCount).toBe(0)
    expect(body.totalInvocations).toBe(0)
    expect(body.hasInvocations).toBe(true)
    expect(body.totalRevenueCents).toBe(3)
  }, 20_000)

  it('stats: more than 500 deleted tools do not push a live tool out of the counts', async () => {
    const { body } = await call(getStats, DEV.manyDeleted, '/api/dashboard/developer/stats')
    expect(body.toolCount).toBe(1)
    expect(body.toolsCreated).toBe(521)
    expect(body.totalInvocations).toBe(2)
  }, 20_000)

  it('stats, analytics, insights and forecast all count every one of 520 live tools', async () => {
    const stats = await call(getStats, DEV.wide, '/api/dashboard/developer/stats')
    expect(stats.body.toolCount).toBe(520)
    expect(stats.body.totalInvocations).toBe(520)

    const analytics = await call(getAnalytics, DEV.wide, '/api/dashboard/developer/stats/analytics')
    expect(analytics.status).toBe(200)
    const breakdown = analytics.body.methodBreakdown as Array<{ count: number }>
    expect(breakdown.reduce((s, m) => s + m.count, 0)).toBe(520)

    const insights = await call(getInsights, DEV.wide, '/api/dashboard/developer/consumers/insights')
    expect(insights.status).toBe(200)
    expect(insights.body.topConsumers[0].totalInvocations).toBe(520)

    const forecast = await call(getForecast, DEV.wide, '/api/dashboard/developer/stats/forecast')
    expect(forecast.body.dailyDataPoints).toBe(8)
    expect(forecast.body.currentMonthRevenueCents).toBe(520)
  }, 30_000)

  it('analytics and insights leave out deleted tools and other developers\' calls', async () => {
    const analytics = await call(getAnalytics, DEV.a, '/api/dashboard/developer/stats/analytics')
    const breakdown = analytics.body.methodBreakdown as Array<{ count: number }>
    expect(breakdown.reduce((s, m) => s + m.count, 0)).toBe(4)

    const insights = await call(getInsights, DEV.a, '/api/dashboard/developer/consumers/insights')
    const top = insights.body.topConsumers as Array<{ consumerId: string; totalSpendCents: number }>
    expect(top.find((c) => c.consumerId === C1)?.totalSpendCents).toBe(10) // not the 14 on the deleted tool or B's 50
  }, 20_000)

  it('forecast: fewer than 7 days of revenue on non-deleted tools reports insufficient data', async () => {
    const { status, body } = await call(getForecast, DEV.a, '/api/dashboard/developer/stats/forecast')
    expect(status).toBe(200)
    expect(body.insufficientData).toBe(true)
    expect(body.dailyDataPoints).toBe(2)
    expect(body.projectedNextMonthCents).toBe(0)
  }, 20_000)

  it('forecast: 8 days on a live tool give a trend; days only on a deleted tool are not counted', async () => {
    const { body } = await call(getForecast, DEV.trend, '/api/dashboard/developer/stats/forecast')
    expect(body.insufficientData).toBeUndefined()
    expect(body.dailyDataPoints).toBe(8)
    expect(body.projectedNextMonthCents).toBeGreaterThan(0)
  }, 20_000)
})
