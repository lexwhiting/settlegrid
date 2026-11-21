/**
 * GET /api/proxy/stats against real SQL (pglite).
 *
 * - Every tool the developer owns counts, however many: a 501st tool's proxy
 *   calls, name and slug, and both tool counts.
 * - Another developer's tools and calls never count.
 * - Today, this week (from Sunday) and this month are UTC, whatever the
 *   server's time zone.
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

// "Now" is Sunday 2026-11-15 12:30 UTC: today, this week and this month all start at
// 00:00 UTC on Nov 15, Nov 15 and Nov 1.
const NOW = new Date('2026-11-15T12:30:00.000Z')
const DEV = { big: 'd0000000-0000-4000-8000-000000000001', other: 'd0000000-0000-4000-8000-000000000002', none: 'd0000000-0000-4000-8000-000000000003' }
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

  // BIG: 500 tools without a proxy endpoint, then "Tool 501" with one. All calls are on Tool 501:
  // one at 01:00 UTC today, one on Nov 1 at 03:00 UTC (this month, not this week), one in October,
  // and one non-proxy call today.
  await pg.query(
    `INSERT INTO tools (developer_id, name, slug) SELECT $1, 'Tool ' || g, 'tool-' || g FROM generate_series(1, 500) g`,
    [DEV.big],
  )
  const [{ id: tool501 }] = (await pg.query<{ id: string }>(
    `INSERT INTO tools (developer_id, name, slug, proxy_endpoint) VALUES ($1, 'Tool 501', 'tool-501', 'https://example.com') RETURNING id`,
    [DEV.big],
  )).rows
  await proxyCall(tool501, '2026-11-15T01:00:00.000Z', 4)
  await proxyCall(tool501, '2026-11-01T03:00:00.000Z', 6, 'error')
  await proxyCall(tool501, '2026-10-31T23:00:00.000Z', 99)
  await pg.query(
    `INSERT INTO invocations (tool_id, method, cost_cents, status, created_at) VALUES ($1, 'run', 50, 'success', $2)`,
    [tool501, '2026-11-15T02:00:00.000Z'],
  )

  // OTHER: one tool with a proxy endpoint and a proxy call today.
  const [{ id: otherTool }] = (await pg.query<{ id: string }>(
    `INSERT INTO tools (developer_id, name, slug, proxy_endpoint) VALUES ($1, 'Other', 'other', 'https://example.org') RETURNING id`,
    [DEV.other],
  )).rows
  await proxyCall(otherTool, '2026-11-15T03:00:00.000Z', 7)
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
    expect(data.today).toEqual({ totalCalls: 1, successCalls: 1, errorCalls: 0, totalCostCents: 4 })
    expect(data.thisWeek).toEqual({ totalCalls: 1, successCalls: 1, errorCalls: 0, totalCostCents: 4 })
    expect(data.thisMonth).toEqual({ totalCalls: 2, successCalls: 1, errorCalls: 1, totalCostCents: 10 })
    expect(data.errorRate).toBe(50)
    expect(data.topTools).toEqual([
      { toolId: expect.any(String), toolName: 'Tool 501', toolSlug: 'tool-501', totalCalls: 2, totalCostCents: 10, avgLatencyMs: 100, errorRate: 50 },
    ])
  }, 30_000)

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
      expect(new Date(NOW).getHours()).toBe(4) // the server clock reads 04:30 on Sunday Nov 15
      const data = await stats(DEV.big)
      expect(data.today.totalCalls).toBe(1) // 01:00 UTC today (17:00 on Saturday in Los Angeles)
      expect(data.thisWeek.totalCalls).toBe(1)
      expect(data.thisMonth.totalCalls).toBe(2) // Nov 1 03:00 UTC (Oct 31 in Los Angeles)
    } finally {
      if (saved === undefined) delete process.env.TZ
      else process.env.TZ = saved
    }
  }, 20_000)
})
