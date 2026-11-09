/**
 * Runs the developer-dashboard stats and forecast routes against a real Postgres
 * (pglite) with the app schema pushed, so the scoping is proven by executed SQL.
 *
 * - Activity (invocation counts, the 24h chart, the forecast) covers the developer's
 *   tools that aren't deleted; another developer's tools never count.
 * - Earnings (lifetime and this month) cover every tool, deleted ones included.
 * - "Active Tools" counts status 'active'; tool counts aren't capped at 500 rows.
 * - The forecast reports insufficient data below 7 days of revenue.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'
import { dashboardToolsWhere } from '@/lib/dashboard-scope'

// drizzle-kit/api's ESM build is broken under vitest; load the CJS build (in-process, in-memory).
const { pushSchema } = createRequire(import.meta.url)('drizzle-kit/api') as typeof import('drizzle-kit/api')

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
import { GET as getForecast } from '../forecast/route'

const { developers, tools, consumers, apiKeys, invocations } = schema

let pg: PGlite
let db: ReturnType<typeof drizzle>
const dev: Record<'a' | 'b' | 'gone' | 'many' | 'trend', string> = { a: '', b: '', gone: '', many: '', trend: '' }
const tool: Record<'live' | 'draft' | 'deleted' | 'other', string> = { live: '', draft: '', deleted: '', other: '' }

const DAY = 24 * 60 * 60 * 1000
const ago = (ms: number) => new Date(Date.now() - ms)

async function call(handler: typeof getStats, developerId: string, path: string) {
  authState.id = developerId
  const res = await handler(new NextRequest(`http://localhost:3005${path}`))
  return { status: res.status, body: await res.json() }
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
  db = drizzle(pg, { schema })
  holder.db = db
  const res = await pushSchema(schema as Record<string, unknown>, db as never)
  await res.apply()

  const devs = await db
    .insert(developers)
    .values([
      { email: 'a@example.test', slug: 'dev-a', tier: 'builder' },
      { email: 'b@example.test', slug: 'dev-b', tier: 'builder' },
      { email: 'gone@example.test', slug: 'dev-gone' },
      { email: 'many@example.test', slug: 'dev-many' },
      { email: 'trend@example.test', slug: 'dev-trend', tier: 'builder' },
    ])
    .returning({ id: developers.id })
  ;[dev.a, dev.b, dev.gone, dev.many, dev.trend] = devs.map((d) => d.id)

  const rows = await db
    .insert(tools)
    .values([
      { developerId: dev.a, name: 'Live', slug: 'a-live', status: 'active', totalRevenueCents: 100 },
      { developerId: dev.a, name: 'Draft', slug: 'a-draft', status: 'draft', totalRevenueCents: 0 },
      { developerId: dev.a, name: 'Deleted', slug: 'a-deleted', status: 'deleted', totalRevenueCents: 40 },
      { developerId: dev.b, name: 'Other', slug: 'b-other', status: 'active', totalRevenueCents: 999 },
    ])
    .returning({ id: tools.id })
  ;[tool.live, tool.draft, tool.deleted, tool.other] = rows.map((r) => r.id)

  const [goneTool] = await db
    .insert(tools)
    .values({ developerId: dev.gone, name: 'Gone', slug: 'gone-1', status: 'deleted', totalRevenueCents: 3 })
    .returning({ id: tools.id })

  // More than 500 deleted tools ahead of one live tool.
  await db.insert(tools).values(
    Array.from({ length: 520 }, (_, i) => ({
      developerId: dev.many, name: `Old ${i}`, slug: `many-old-${i}`, status: 'deleted',
    })),
  )
  const [manyLive] = await db
    .insert(tools)
    .values({ developerId: dev.many, name: 'Live', slug: 'many-live', status: 'active' })
    .returning({ id: tools.id })

  const [trendLive, trendDeleted] = await db
    .insert(tools)
    .values([
      { developerId: dev.trend, name: 'Live', slug: 'trend-live', status: 'active' },
      { developerId: dev.trend, name: 'Deleted', slug: 'trend-deleted', status: 'deleted' },
    ])
    .returning({ id: tools.id })

  const [consumer] = await db.insert(consumers).values({ email: 'c@example.test' }).returning({ id: consumers.id })
  const keys: Record<string, string> = {}
  for (const t of [tool.live, tool.draft, tool.deleted, tool.other, goneTool.id, manyLive.id, trendLive.id, trendDeleted.id]) {
    const [k] = await db
      .insert(apiKeys)
      .values({ consumerId: consumer.id, toolId: t, keyHash: `h-${t}`, keyPrefix: 'sg_test' })
      .returning({ id: apiKeys.id })
    keys[t] = k.id
  }
  const inv = (toolId: string, costCents: number, createdAt: Date, status = 'success') => ({
    toolId, consumerId: consumer.id, apiKeyId: keys[toolId], method: 'run', costCents, status, createdAt,
  })

  await db.insert(invocations).values([
    // developer A: 3 on live (one failed), 1 on draft, 2 on the deleted tool
    inv(tool.live, 5, ago(60_000)),
    inv(tool.live, 5, ago(2 * 60 * 60 * 1000)),
    inv(tool.live, 0, ago(3 * DAY), 'error'),
    inv(tool.draft, 2, ago(60_000)),
    inv(tool.deleted, 7, ago(60_000)),
    inv(tool.deleted, 7, ago(4 * DAY)),
    // developer B
    inv(tool.other, 50, ago(60_000)),
    // a developer whose only tool is deleted
    inv(goneTool.id, 3, ago(5 * DAY)),
    // the developer with 520 deleted tools
    inv(manyLive.id, 1, ago(60_000)),
    inv(manyLive.id, 1, ago(60_000)),
    // 8 days of revenue on a live tool, plus 5 more days only on a deleted tool
    ...Array.from({ length: 8 }, (_, i) => inv(trendLive.id, 10 + i, ago((i + 1) * DAY))),
    ...Array.from({ length: 5 }, (_, i) => inv(trendDeleted.id, 10, ago((i + 10) * DAY))),
  ])
}, 120_000)

afterAll(async () => {
  await pg?.close()
})

describe('dashboard tool scope (pglite)', () => {
  it('dashboardToolsWhere selects the owner\'s tools that are not deleted', async () => {
    const rows = await db.select({ id: tools.id }).from(tools).where(dashboardToolsWhere(dev.a))
    expect(rows.map((r) => r.id).sort()).toEqual([tool.live, tool.draft].sort())
  }, 20_000)

  it('stats: activity excludes deleted and other developers\' tools; earnings keep deleted tools', async () => {
    const { status, body } = await call(getStats, dev.a, '/api/dashboard/developer/stats')
    expect(status).toBe(200)
    expect(body.toolCount).toBe(1) // status 'active' only
    expect(body.toolsCreated).toBe(3)
    expect(body.totalInvocations).toBe(4) // 3 on live (every status) + 1 on draft
    expect(body.hasInvocations).toBe(true)
    expect(body.totalRevenueCents).toBe(140) // 100 + 0 + 40, not developer B's 999
    expect(body.monthRevenueCents).toBeGreaterThanOrEqual(5 + 2 + 7) // includes the deleted tool's call
    expect(body.monthRevenueCents).toBeLessThan(50) // never developer B's
    const recent = body.recentInvocations.reduce((n: number, r: { count: number }) => n + r.count, 0)
    expect(recent).toBe(3) // last 24h: 2 on live + 1 on draft; the deleted tool's call is left out
  }, 20_000)

  it('stats: a call on a deleted tool still ticks "made a test invocation"', async () => {
    const { body } = await call(getStats, dev.gone, '/api/dashboard/developer/stats')
    expect(body.toolCount).toBe(0)
    expect(body.totalInvocations).toBe(0)
    expect(body.hasInvocations).toBe(true)
    expect(body.totalRevenueCents).toBe(3)
  }, 20_000)

  it('stats: more than 500 deleted tools do not push a live tool out of the counts', async () => {
    const { body } = await call(getStats, dev.many, '/api/dashboard/developer/stats')
    expect(body.toolCount).toBe(1)
    expect(body.toolsCreated).toBe(521)
    expect(body.totalInvocations).toBe(2)
  }, 20_000)

  it('forecast: fewer than 7 days of revenue on non-deleted tools reports insufficient data', async () => {
    const { status, body } = await call(getForecast, dev.a, '/api/dashboard/developer/stats/forecast')
    expect(status).toBe(200)
    expect(body.insufficientData).toBe(true)
    expect(body.dailyDataPoints).toBeLessThan(7)
    expect(body.projectedNextMonthCents).toBe(0)
  }, 20_000)

  it('forecast: 8 days on a live tool give a trend; days only on a deleted tool are not counted', async () => {
    const { body } = await call(getForecast, dev.trend, '/api/dashboard/developer/stats/forecast')
    expect(body.insufficientData).toBeUndefined()
    expect(body.dailyDataPoints).toBe(8)
    expect(body.projectedNextMonthCents).toBeGreaterThan(0)
  }, 20_000)
})
