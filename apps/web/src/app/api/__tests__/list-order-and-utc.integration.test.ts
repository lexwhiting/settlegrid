/**
 * Real SQL (pglite) for the list caps and UTC boundaries:
 * - GET /api/tools and GET /api/consumer/keys return at most 500 rows, newest first,
 *   so the cap never hides the newest tool or key.
 * - getSignupsByDay groups by UTC day and includes today; getInvocationsThisMonth
 *   counts from 00:00 UTC on the 1st, whatever the session or server time zone.
 *
 * The schema is a test-only CREATE TABLE bootstrap of the columns these read (no
 * drizzle-kit, no migrations). Fixtures are SQL inserts. The clock is fixed.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const authState = vi.hoisted(() => ({ id: '' }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/middleware/auth', () => ({
  requireDeveloper: vi.fn(async () => ({ id: authState.id })),
  requireConsumer: vi.fn(async () => ({ id: authState.id })),
}))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET as listTools } from '../tools/route'
import { GET as listKeys } from '../consumer/keys/route'
import { getSignupsByDay, getInvocationsThisMonth } from '@/lib/analytics'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, slug text,
    created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL,
    name text NOT NULL, slug text NOT NULL, description text, pricing_config jsonb,
    status text NOT NULL DEFAULT 'draft', category text, verified boolean NOT NULL DEFAULT false,
    total_invocations integer NOT NULL DEFAULT 0, total_revenue_cents integer NOT NULL DEFAULT 0,
    health_endpoint text, proxy_endpoint text, current_version text NOT NULL DEFAULT '1.0.0',
    listed_in_marketplace boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE api_keys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consumer_id uuid NOT NULL,
    tool_id uuid NOT NULL, key_prefix text NOT NULL, status text NOT NULL DEFAULT 'active',
    is_test_key boolean NOT NULL DEFAULT false, ip_allowlist jsonb, last_used_at timestamptz,
    created_at timestamptz NOT NULL);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL);
`

// "Now" is Sunday 2026-11-01 04:30 UTC: 21:30 on Oct 31 in Los Angeles.
const NOW = new Date('2026-11-01T04:30:00.000Z')
const DEV = 'd0000000-0000-4000-8000-000000000001'
const CONSUMER = 'c0000000-0000-4000-8000-000000000001'
let pg: PGlite

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })

  // 501 tools and 501 keys, inserted newest first, so insertion order (what an unordered
  // LIMIT 500 returns here) would drop the newest; each is one minute newer than the last.
  await pg.query(`INSERT INTO developers (id, name, slug, created_at) VALUES ($1, 'Dev', 'dev', '2026-10-01T00:00:00Z')`, [DEV])
  await pg.query(
    `INSERT INTO tools (developer_id, name, slug, created_at)
     SELECT $1, 'Tool ' || g, 'tool-' || g, timestamptz '2026-10-01T00:00:00Z' + g * interval '1 minute'
     FROM generate_series(1, 500) g`,
    [DEV],
  )
  await pg.query(
    `INSERT INTO api_keys (consumer_id, tool_id, key_prefix, created_at)
     SELECT $1, gen_random_uuid(), 'sg_' || g, timestamptz '2026-10-01T00:00:00Z' + g * interval '1 minute'
     FROM generate_series(1, 500) g`,
    [CONSUMER],
  )
  // ...then, last, the newest of each.
  await pg.query(`INSERT INTO tools (developer_id, name, slug, created_at) VALUES ($1, 'Newest tool', 'newest', '2026-10-31T23:00:00Z')`, [DEV])
  await pg.query(`INSERT INTO api_keys (consumer_id, tool_id, key_prefix, created_at) VALUES ($1, gen_random_uuid(), 'sg_newest', '2026-10-31T23:00:00Z')`, [CONSUMER])

  // Signups: one at 03:00 UTC today (Oct 31 in New York and Los Angeles), one on each of the
  // three days before, at noon UTC. Invocations: one at 01:00 UTC today, one at noon on Oct 31.
  for (const at of ['2026-11-01T03:00:00Z', '2026-10-31T12:00:00Z', '2026-10-30T12:00:00Z', '2026-10-29T12:00:00Z']) {
    await pg.query('INSERT INTO developers (created_at) VALUES ($1)', [at])
  }
  await pg.query(`INSERT INTO invocations (created_at) VALUES ('2026-11-01T01:00:00Z'), ('2026-10-31T12:00:00Z')`)
}, 120_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('list caps keep the newest rows (pglite)', () => {
  it('GET /api/tools returns 500 tools, newest first, the newest included', async () => {
    authState.id = DEV
    const res = await listTools(new NextRequest('http://localhost:3005/api/tools'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const list = body.tools as Array<{ name: string }>
    expect(list).toHaveLength(500)
    expect(list[0].name).toBe('Newest tool')
    expect(list[1].name).toBe('Tool 500')
    expect(list.map((t) => t.name)).not.toContain('Tool 1') // the oldest is the one left out
  }, 20_000)

  it('GET /api/consumer/keys returns 500 keys, newest first, the newest included', async () => {
    authState.id = CONSUMER
    const res = await listKeys(new NextRequest('http://localhost:3005/api/consumer/keys'))
    expect(res.status).toBe(200)
    const keys = (await res.json()).keys as Array<{ keyPrefix: string }>
    expect(keys).toHaveLength(500)
    expect(keys[0].keyPrefix).toBe('sg_newest')
    expect(keys.map((k) => k.keyPrefix)).not.toContain('sg_1')
  }, 20_000)
})

describe('analytics: UTC days and months (pglite)', () => {
  it('signups by day group by UTC day, today included, oldest first, under a New York session', async () => {
    await pg.exec("SET TIME ZONE 'America/New_York'")
    try {
      const days = await getSignupsByDay(3) // 3 days back touches 4 UTC dates
      expect(days).toEqual([
        { date: '2026-10-29', count: 1 },
        { date: '2026-10-30', count: 1 },
        { date: '2026-10-31', count: 1 },
        { date: '2026-11-01', count: 1 }, // 03:00 UTC: Oct 31 in New York
      ])
    } finally {
      await pg.exec("SET TIME ZONE 'UTC'")
    }
  }, 20_000)

  it('invocations this month count from 00:00 UTC on the 1st on a server in Los Angeles time', async () => {
    const saved = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      expect(new Date(NOW).getDate()).toBe(31) // the server clock still reads Oct 31
      expect(await getInvocationsThisMonth()).toBe(1) // the 01:00 UTC call; not October's
    } finally {
      if (saved === undefined) delete process.env.TZ
      else process.env.TZ = saved
    }
  }, 20_000)
})
