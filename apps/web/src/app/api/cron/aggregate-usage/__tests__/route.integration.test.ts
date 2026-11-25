/**
 * The usage cron with both phases off (pglite): org cost allocations are paused and
 * plan-usage warning emails are off until their delivery is reworked.
 *
 * - cost_allocations is neither written nor deleted, though an organization has
 *   members with calls this month (the earlier phase added a row per member per run).
 * - No warning email is sent, though a developer is over their plan's monthly ops.
 *
 * The schema is a test-only CREATE TABLE bootstrap (no drizzle-kit, no migrations).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown, send: vi.fn(async () => 'sent') }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => 'ok' }))
vi.mock('@/lib/redis', () => ({ getRedis: () => ({ get: vi.fn(async () => null), set: vi.fn(async () => 'OK') }) }))
vi.mock('@/lib/notifications', () => ({ sendNotificationEmail: (...a: unknown[]) => holder.send(...(a as [])) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET } from '../route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE organizations (id uuid PRIMARY KEY);
  CREATE TABLE organization_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL,
    user_id text NOT NULL, role text NOT NULL DEFAULT 'member');
  CREATE TABLE developers (id uuid PRIMARY KEY, email text NOT NULL, name text, tier text NOT NULL DEFAULT 'standard',
    is_founding_member boolean NOT NULL DEFAULT false);
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL, consumer_id uuid NOT NULL,
    cost_cents integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL);
  CREATE TABLE cost_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL,
    department_tag text NOT NULL, service_id text, period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
    total_cents integer NOT NULL DEFAULT 0, operation_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now());
`

const NOW = new Date('2026-11-22T00:00:00.000Z')
const ORG = 'a0000000-0000-4000-8000-000000000001'
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
  await pg.query('INSERT INTO organizations (id) VALUES ($1)', [ORG])
  await pg.query('INSERT INTO organization_members (org_id, user_id) VALUES ($1, $2)', [ORG, CONSUMER])
  await pg.query(`INSERT INTO developers (id, email, name) VALUES ($1, 'dev@example.com', 'Dev')`, [DEV])
  await pg.query('INSERT INTO tools (developer_id) VALUES ($1)', [DEV])
  // 60,000 calls this month: over the standard plan's 50,000
  await pg.query(
    `INSERT INTO invocations (tool_id, consumer_id, created_at)
     SELECT (SELECT id FROM tools LIMIT 1), $1, '2026-11-10T00:00:00Z' FROM generate_series(1, 60000)`,
    [CONSUMER],
  )
  await pg.query(`INSERT INTO cost_allocations (org_id, department_tag, period_start, period_end, total_cents, operation_count)
    VALUES ($1, 'default', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 30, 3)`, [ORG])
}, 120_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('cron aggregate-usage with both phases off (pglite)', () => {
  it('writes and deletes no cost allocations, sends no warning, and reports the UTC month', async () => {
    const res = await GET(new NextRequest('http://localhost:3005/api/cron/aggregate-usage'))
    expect(res.status).toBe(200)
    const rows = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM cost_allocations')
    expect(rows.rows[0].n).toBe(1) // the one row from before; none added or removed
    expect(holder.send).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({
      period: '2026-11-01T00:00:00.000Z', month: '2026-11', costAllocations: 'paused', usageAlerts: 'off', alertsSent: 0,
    })
  }, 30_000)
})
