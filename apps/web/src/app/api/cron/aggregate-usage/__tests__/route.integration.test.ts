/**
 * The usage cron against real SQL (pglite).
 *
 * - Plan-usage warnings: ops this UTC month per developer (every invocation of their
 *   tools, as the usage page counts them) against the tier the usage page shows
 *   (founding members get Scale); one email per level and month.
 * - Org cost allocations are paused: cost_allocations is neither written nor deleted.
 *
 * The schema is a test-only CREATE TABLE bootstrap of the columns the route reads
 * (no drizzle-kit, no migrations). Redis is an in-memory map; emails are a mock.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({
  db: null as unknown,
  store: new Map<string, string>(),
  send: null as unknown as Mock,
}))
holder.send = vi.fn(async () => undefined)

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => 'ok' }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    get: async (k: string) => holder.store.get(k) ?? null,
    set: async (k: string, v: string, opts?: { nx?: boolean }) => {
      if (opts?.nx && holder.store.has(k)) return null
      holder.store.set(k, v)
      return 'OK'
    },
  }),
}))
vi.mock('@/lib/notifications', () => ({ sendNotificationEmail: (...a: unknown[]) => holder.send(...a) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET } from '../route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY, email text NOT NULL, name text,
    tier text NOT NULL DEFAULT 'standard', is_founding_member boolean NOT NULL DEFAULT false);
  CREATE TABLE tools (id uuid PRIMARY KEY, developer_id uuid NOT NULL);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL,
    consumer_id uuid NOT NULL, cost_cents integer NOT NULL DEFAULT 1, is_test boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL);
  CREATE TABLE organizations (id uuid PRIMARY KEY);
  CREATE TABLE organization_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL,
    user_id text NOT NULL, role text NOT NULL DEFAULT 'member');
  CREATE TABLE cost_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL,
    department_tag text NOT NULL, service_id text, period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
    total_cents integer NOT NULL DEFAULT 0, operation_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now());
`

const NOW = new Date('2026-11-22T00:00:00.000Z')
const CONSUMER = 'c0000000-0000-4000-8000-000000000001'
// Developers (standard tier: 50,000 ops; 80% = 40,000)
const AT_80 = 'd0000000-0000-4000-8000-000000000001' // 40,000 this month (10,000 of them sandbox calls)
const AT_100 = 'd0000000-0000-4000-8000-000000000002' // 50,000
const FOUNDER = 'd0000000-0000-4000-8000-000000000003' // 45,000, founding member: Scale limit, no warning
const LAST_MONTH = 'd0000000-0000-4000-8000-000000000004' // 39,999 this month + 20,000 in October
const BUILDER = 'd0000000-0000-4000-8000-000000000005' // builder tier (200,000): 45,000 is 22%
const ENTERPRISE = 'd0000000-0000-4000-8000-000000000006' // enterprise, 50,000: no cap, no warning
const ACADEMIC = 'd0000000-0000-4000-8000-000000000007' // academic (500,000): 45,000 is 9%
const LEGACY = 'd0000000-0000-4000-8000-000000000008' // legacy 'starter' = Builder (200,000): 45,000 is 22%
let pg: PGlite

async function calls(dev: string, n: number, at: string, isTest = false) {
  await pg.query(
    `INSERT INTO invocations (tool_id, consumer_id, is_test, created_at)
     SELECT (SELECT id FROM tools WHERE developer_id = $1 LIMIT 1), $2, $3, $4::timestamptz FROM generate_series(1, $5)`,
    [dev, CONSUMER, isTest, at, n],
  )
}

async function run() {
  const res = await GET(new NextRequest('http://localhost:3005/api/cron/aggregate-usage'))
  expect(res.status).toBe(200)
  return res.json()
}

const sentTo = () => holder.send.mock.calls.map((c) => (c[0] as { developerId: string }).developerId)

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })

  for (const [id, tier, founder] of [
    [AT_80, 'standard', false], [AT_100, 'standard', false], [FOUNDER, 'standard', true],
    [LAST_MONTH, 'standard', false], [BUILDER, 'builder', false], [ENTERPRISE, 'enterprise', false],
    [ACADEMIC, 'academic', false], [LEGACY, 'starter', false],
  ] as const) {
    await pg.query('INSERT INTO developers (id, email, name, tier, is_founding_member) VALUES ($1, $2, $3, $4, $5)', [id, `${id}@example.com`, 'Dev', tier, founder])
    await pg.query('INSERT INTO tools (id, developer_id) VALUES (gen_random_uuid(), $1)', [id])
  }
  await calls(AT_80, 30_000, '2026-11-01T00:00:00Z') // the first instant of the UTC month counts
  await calls(AT_80, 10_000, '2026-11-21T23:00:00Z', true) // sandbox calls count, as on the usage page
  await calls(AT_100, 50_000, '2026-11-15T00:00:00Z')
  await calls(FOUNDER, 45_000, '2026-11-15T00:00:00Z')
  await calls(LAST_MONTH, 39_999, '2026-11-15T00:00:00Z')
  await calls(LAST_MONTH, 20_000, '2026-10-31T23:59:59Z') // last UTC month: doesn't count
  await calls(BUILDER, 45_000, '2026-11-15T00:00:00Z')
  await calls(ENTERPRISE, 50_000, '2026-11-15T00:00:00Z') // over every capped limit but Scale
  await calls(ACADEMIC, 45_000, '2026-11-15T00:00:00Z')
  await calls(LEGACY, 45_000, '2026-11-15T00:00:00Z')

  // An organization whose member made this month's calls: the paused phase wrote rows for it.
  await pg.query(`INSERT INTO organizations (id) VALUES ('a0000000-0000-4000-8000-000000000001')`)
  await pg.query(`INSERT INTO organization_members (org_id, user_id) VALUES ('a0000000-0000-4000-8000-000000000001', $1)`, [CONSUMER])
  await pg.query(`INSERT INTO cost_allocations (org_id, department_tag, period_start, period_end, total_cents, operation_count)
    VALUES (gen_random_uuid(), 'default', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 30, 3),
           (gen_random_uuid(), 'default', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 30, 3)`)
}, 120_000)

beforeEach(() => { holder.send.mockClear() })

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('cron aggregate-usage (pglite)', () => {
  it('warns each developer at the highest level reached this UTC month, on the tier the usage page shows', async () => {
    const body = await run()
    expect(body.alertsSent).toBe(2)
    expect(sentTo().sort()).toEqual([AT_80, AT_100].sort())
    const byDev = Object.fromEntries(holder.send.mock.calls.map((c) => {
      const a = c[0] as { developerId: string; eventKey: string; subject: string }
      return [a.developerId, a]
    }))
    expect(byDev[AT_80].eventKey).toBe('usage_alert')
    expect(byDev[AT_80].subject).toMatch(/80%/)
    expect(byDev[AT_100].subject).not.toMatch(/80%|90%/)
    expect([...holder.store.keys()].sort()).toEqual([
      `usage-alert:${AT_80}:2026-11:80`,
      `usage-alert:${AT_100}:2026-11:100`,
    ].sort())
  }, 30_000)

  it('sends nothing again for a level already sent this month', async () => {
    const body = await run()
    expect(body.alertsSent).toBe(0)
    expect(holder.send).not.toHaveBeenCalled()
  }, 30_000)

  it('sends the next level once it is reached', async () => {
    await calls(AT_80, 5_000, '2026-11-21T23:30:00Z') // 45,000 = 90%
    const body = await run()
    expect(body.alertsSent).toBe(1)
    expect(sentTo()).toEqual([AT_80])
    expect((holder.send.mock.calls[0][0] as { subject: string }).subject).toMatch(/90%/)
  }, 30_000)

  it('leaves cost_allocations alone (paused), though an organization has members with calls', async () => {
    const r = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM cost_allocations')
    expect(r.rows[0].n).toBe(2)
  })
})
