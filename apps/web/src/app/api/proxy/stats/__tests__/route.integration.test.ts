/**
 * GET /api/proxy/stats against real SQL (pglite).
 *
 * - Every tool the developer owns counts, however many: a 501st tool's proxy
 *   calls, name and slug, and both tool counts.
 * - Another developer's tools and calls never count.
 * - Today, this week (from Sunday) and this month start at 00:00 UTC,
 *   boundaries included, whatever the server's time zone.
 *
 * The schema is a test-only CREATE TABLE bootstrap of the columns the route
 * reads (no drizzle-kit, no migrations). Fixtures are SQL inserts. The clock
 * is fixed; the session time zone is UTC.
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

import { GET } from '../route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL,
    name text NOT NULL, slug text NOT NULL, proxy_endpoint text);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL,
    method text NOT NULL, cost_cents integer NOT NULL, latency_ms integer,
    status text NOT NULL DEFAULT 'success', created_at timestamptz NOT NULL);
`

// "Now" is Wednesday 2026-11-18 12:30 UTC: today starts Wed Nov 18 00:00, this week Sun Nov 15
// 00:00 and this month Nov 1 00:00, all UTC.
const NOW = new Date('2026-11-18T12:30:00.000Z')
const DEV = {
  big: 'd0000000-0000-4000-8000-000000000001',
  other: 'd0000000-0000-4000-8000-000000000002',
  none: 'd0000000-0000-4000-8000-000000000003',
  tz: 'd0000000-0000-4000-8000-000000000004',
}
let pg: PGlite

async function proxyCall(toolId: string, createdAt: string, cents = 1, status = 'success') {
  await pg.query(
    'INSERT INTO invocations (tool_id, method, cost_cents, latency_ms, status, created_at) VALUES ($1, $2, $3, 100, $4, $5)',
    [toolId, 'proxy:GET', cents, status, createdAt],
  )
}

async function stats(developerId: string) {
  authState.id = developerId
  const res = await GET(new NextRequest('http://localhost:3005/api/proxy/stats'))
  expect(res.status).toBe(200)
  return (await res.json()).data
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })

  // BIG: 500 tools without a proxy endpoint, then "Tool 501" with one. All calls are on Tool 501,
  // at the edges of today, this week and this month, plus one in October and one non-proxy call.
  await pg.query(
    `INSERT INTO tools (developer_id, name, slug) SELECT $1, 'Tool ' || g, 'tool-' || g FROM generate_series(1, 500) g`,
    [DEV.big],
  )
  const [{ id: tool501 }] = (await pg.query<{ id: string }>(
    `INSERT INTO tools (developer_id, name, slug, proxy_endpoint) VALUES ($1, 'Tool 501', 'tool-501', 'https://example.com') RETURNING id`,
    [DEV.big],
  )).rows
  await proxyCall(tool501, '2026-11-18T00:00:00.000Z', 4) // the first instant of today
  await proxyCall(tool501, '2026-11-17T23:59:00.000Z', 2) // this week, not today
  await proxyCall(tool501, '2026-11-15T00:00:00.000Z', 3) // the first instant of this week (Sunday)
  await proxyCall(tool501, '2026-11-14T23:59:59.000Z', 5, 'error') // Saturday: this month, not this week
  await proxyCall(tool501, '2026-11-01T03:00:00.000Z', 6) // this month, not this week
  await proxyCall(tool501, '2026-10-31T23:00:00.000Z', 99) // last month
  await pg.query(
    `INSERT INTO invocations (tool_id, method, cost_cents, status, created_at) VALUES ($1, 'run', 50, 'success', $2)`,
    [tool501, '2026-11-18T02:00:00.000Z'],
  )

  // OTHER: one tool with a proxy endpoint and a proxy call today.
  const [{ id: otherTool }] = (await pg.query<{ id: string }>(
    `INSERT INTO tools (developer_id, name, slug, proxy_endpoint) VALUES ($1, 'Other', 'other', 'https://example.org') RETURNING id`,
    [DEV.other],
  )).rows
  await proxyCall(otherTool, '2026-11-18T03:00:00.000Z', 7)

  // TZ: three tools (far below any cap) and three calls that fall in the UTC day, week and month
  // but before the same boundaries in Los Angeles time.
  await pg.query(`INSERT INTO tools (developer_id, name, slug) SELECT $1, 'TZ ' || g, 'tz-' || g FROM generate_series(1, 3) g`, [DEV.tz])
  const [{ id: tzTool }] = (await pg.query<{ id: string }>(`SELECT id FROM tools WHERE developer_id = $1 LIMIT 1`, [DEV.tz])).rows
  await proxyCall(tzTool, '2026-11-18T01:00:00.000Z') // Tue 17:00 in Los Angeles
  await proxyCall(tzTool, '2026-11-15T02:00:00.000Z') // Sat 18:00 in Los Angeles
  await proxyCall(tzTool, '2026-11-01T03:00:00.000Z') // Oct 31 in Los Angeles
}, 120_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('GET /api/proxy/stats (pglite)', () => {
  it('counts every tool the developer owns, and the proxy calls on the 501st', async () => {
    const data = await stats(DEV.big)
    expect(data.totalTools).toBe(501)
    expect(data.proxyEnabledTools).toBe(1)
    expect(data.thisMonth).toEqual({ totalCalls: 5, successCalls: 4, errorCalls: 1, totalCostCents: 20 })
    expect(data.errorRate).toBe(20)
    expect(data.averageLatencyMs).toBe(100)
    expect(data.topTools).toEqual([
      { toolId: expect.any(String), toolName: 'Tool 501', toolSlug: 'tool-501', totalCalls: 5, totalCostCents: 20, avgLatencyMs: 100, errorRate: 20 },
    ])
  }, 30_000)

  it('today starts at 00:00 UTC and this week at 00:00 UTC on Sunday, boundaries included', async () => {
    const data = await stats(DEV.big)
    expect(data.today).toEqual({ totalCalls: 1, successCalls: 1, errorCalls: 0, totalCostCents: 4 })
    expect(data.thisWeek).toEqual({ totalCalls: 3, successCalls: 3, errorCalls: 0, totalCostCents: 9 }) // Sun 00:00, Tue 23:59, Wed 00:00
  }, 20_000)

  it('never counts another developer\'s tools or calls', async () => {
    const other = await stats(DEV.other)
    expect(other).toMatchObject({ totalTools: 1, proxyEnabledTools: 1 })
    expect(other.thisMonth).toEqual({ totalCalls: 1, successCalls: 1, errorCalls: 0, totalCostCents: 7 })
    expect(other.topTools).toEqual([expect.objectContaining({ toolName: 'Other', totalCalls: 1 })])
    const none = await stats(DEV.none)
    expect(none).toMatchObject({ totalTools: 0, proxyEnabledTools: 0, topTools: [] })
    expect(none.thisMonth.totalCalls).toBe(0)
  }, 20_000)

  it('uses the UTC day, week and month on a server set to Los Angeles time', async () => {
    const saved = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      expect(new Date(NOW).getHours()).toBe(4) // the server clock reads 04:30 on Wednesday Nov 18
      const data = await stats(DEV.tz)
      expect(data.today.totalCalls).toBe(1)
      expect(data.thisWeek.totalCalls).toBe(2)
      expect(data.thisMonth.totalCalls).toBe(3)
    } finally {
      if (saved === undefined) delete process.env.TZ
      else process.env.TZ = saved
    }
  }, 20_000)
})
