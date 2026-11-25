/**
 * The data-retention cron records, per developer, the invocation cutoff it actually
 * used (before deleting), for the monthly summary's completeness check
 * (lib/monthly-summary-snapshot). Real SQL (pglite) with a test-only CREATE TABLE
 * bootstrap of the columns the route reads (no drizzle-kit, no migrations); Redis is
 * an in-memory map.
 *
 * - A developer with log retention gets the cutoff recorded and older rows purged.
 * - A keep-forever developer (0) gets nothing recorded and nothing purged.
 * - If the cutoff can't be recorded, that developer's invocations are not purged that
 *   run (a purge the monthly summary doesn't know about could hide deleted rows).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown, zsets: new Map<string, number>(), ttl: new Map<string, number>(), redisDown: false }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => 'ok' }))
vi.mock('@/lib/redis', () => ({
  // A sorted set per key with one member, as ZADD GT keeps it: the score only ever rises
  getRedis: () => ({
    zadd: async (k: string, opts: { gt?: boolean }, m: { score: number; member: string }) => {
      if (holder.redisDown) throw new Error('redis down')
      const cur = holder.zsets.get(k)
      if (cur === undefined || !opts.gt || m.score > cur) holder.zsets.set(k, m.score)
      return 1
    },
    expire: async (k: string, secs: number) => { holder.ttl.set(k, secs); return 1 },
  }),
}))
vi.mock('@/lib/settlement/compliance', () => ({ processDataDeletion: vi.fn(async () => ({ success: true })) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET } from '../route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY, log_retention_days integer NOT NULL DEFAULT 90,
    webhook_log_retention_days integer NOT NULL DEFAULT 7, audit_log_retention_days integer NOT NULL DEFAULT 90);
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL, created_at timestamptz NOT NULL);
  CREATE TABLE webhook_endpoints (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL);
  CREATE TABLE webhook_deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), endpoint_id uuid NOT NULL, created_at timestamptz NOT NULL);
  CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid, created_at timestamptz NOT NULL);
  CREATE TABLE tool_health_checks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), checked_at timestamptz NOT NULL);
  CREATE TABLE conversion_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL);
  CREATE TABLE compliance_exports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_type text NOT NULL,
    status text NOT NULL, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
`

const NOW = new Date('2026-12-01T03:00:00.000Z')
const KEEPS_30 = 'd0000000-0000-4000-8000-000000000001'
const FOREVER = 'd0000000-0000-4000-8000-000000000002'
let pg: PGlite

const count = async (dev: string) =>
  (await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM invocations i JOIN tools t ON t.id = i.tool_id WHERE t.developer_id = $1', [dev])).rows[0].n

async function run() {
  const res = await GET(new NextRequest('http://localhost:3005/api/cron/data-retention'))
  expect(res.status).toBe(200)
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })
  await pg.query('INSERT INTO developers (id, log_retention_days) VALUES ($1, 30), ($2, 0)', [KEEPS_30, FOREVER])
  await pg.query('INSERT INTO tools (developer_id) VALUES ($1), ($2)', [KEEPS_30, FOREVER])
}, 60_000)

beforeEach(async () => {
  holder.zsets.clear()
  holder.ttl.clear()
  await pg.query('UPDATE developers SET log_retention_days = 30 WHERE id = $1', [KEEPS_30])
  holder.redisDown = false
  await pg.query('DELETE FROM invocations')
  // One call before the 30-day cutoff (1 Nov 03:00), one after, for each developer
  for (const at of ['2026-10-30T00:00:00Z', '2026-11-15T00:00:00Z']) {
    await pg.query(`INSERT INTO invocations (tool_id, created_at) SELECT id, $1::timestamptz FROM tools`, [at])
  }
})

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('cron data-retention: recorded invocation cutoffs (pglite)', () => {
  it('records the cutoff it used for a developer with log retention, and purges older rows', async () => {
    await run()
    expect(holder.zsets.get(`retention:invocations-cutoff-hwm:${KEEPS_30}`)).toBe(Date.parse('2026-11-01T03:00:00.000Z'))
    expect(holder.ttl.get(`retention:invocations-cutoff-hwm:${KEEPS_30}`)).toBe(70 * 24 * 60 * 60)
    expect(await count(KEEPS_30)).toBe(1)
  })

  it('records nothing and purges nothing for a keep-forever developer', async () => {
    await run()
    expect(holder.zsets.has(`retention:invocations-cutoff-hwm:${FOREVER}`)).toBe(false)
    expect(await count(FOREVER)).toBe(2)
  })

  it('the recorded cutoff never moves back: a later purge under a longer retention keeps the earlier, further cutoff', async () => {
    await run() // 30 days: cutoff 1 Nov 03:00
    await pg.query('UPDATE developers SET log_retention_days = 90 WHERE id = $1', [KEEPS_30])
    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * 60 * 1000)) // the next day's purge: cutoff 3 Sep 03:00
    try {
      await run()
    } finally {
      vi.setSystemTime(NOW)
    }
    // Still 1 Nov: rows before it were deleted, whatever the retention says now
    expect(holder.zsets.get(`retention:invocations-cutoff-hwm:${KEEPS_30}`)).toBe(Date.parse('2026-11-01T03:00:00.000Z'))
  })

  it("doesn't purge a developer's invocations when the cutoff can't be recorded (the summary must know every purge)", async () => {
    holder.redisDown = true
    await run()
    expect(await count(KEEPS_30)).toBe(2) // nothing deleted this run; tomorrow's run tries again
  })
})
