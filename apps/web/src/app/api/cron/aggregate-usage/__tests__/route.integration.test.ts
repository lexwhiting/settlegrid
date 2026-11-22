/**
 * The usage cron's cost-allocation phase against real SQL (pglite).
 *
 * - One 'default' row per organization and UTC month: the sum over its members'
 *   invocations, recomputed and replaced on every run, so runs never add a second row
 *   (cost_allocations has no unique key) and earlier duplicates for the month go.
 * - Rows for other months, departments or services are left alone.
 * - An organization whose members made no calls this month keeps no 'default' row.
 *
 * The schema is a test-only CREATE TABLE bootstrap of the columns the route reads
 * (no drizzle-kit, no migrations). Redis and emails are not reached (no developers).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => 'ok' }))
vi.mock('@/lib/redis', () => ({ getRedis: () => ({ get: vi.fn(async () => null), set: vi.fn(async () => 'OK') }) }))
vi.mock('@/lib/notifications', () => ({ sendNotificationEmail: vi.fn(async () => 'sent') }))
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
  CREATE TABLE developers (id uuid PRIMARY KEY, email text NOT NULL, name text, tier text NOT NULL DEFAULT 'standard');
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid, consumer_id uuid NOT NULL,
    cost_cents integer NOT NULL, created_at timestamptz NOT NULL);
  CREATE TABLE cost_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL,
    department_tag text NOT NULL, service_id text, period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
    total_cents integer NOT NULL DEFAULT 0, operation_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now());
`

const NOW = new Date('2026-11-22T02:00:00.000Z')
const NOV = '2026-11-01T00:00:00Z'
const DEC = '2026-12-01T00:00:00Z'
const ORG = 'a0000000-0000-4000-8000-000000000001'
const QUIET_ORG = 'a0000000-0000-4000-8000-000000000002'
const ALICE = 'c0000000-0000-4000-8000-000000000001'
const BOB = 'c0000000-0000-4000-8000-000000000002'
const OUTSIDER = 'c0000000-0000-4000-8000-000000000003'
let pg: PGlite

const rows = async (orgId: string) =>
  (await pg.query<{ department_tag: string; service_id: string | null; period_start: string; total_cents: number; operation_count: number }>(
    `SELECT department_tag, service_id, to_char(period_start, 'YYYY-MM') AS period_start, total_cents, operation_count
     FROM cost_allocations WHERE org_id = $1 ORDER BY period_start, department_tag, service_id NULLS FIRST`,
    [orgId],
  )).rows

async function run() {
  const res = await GET(new NextRequest('http://localhost:3005/api/cron/aggregate-usage'))
  expect(res.status).toBe(200)
  return res.json()
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })

  await pg.query('INSERT INTO organizations (id) VALUES ($1), ($2)', [ORG, QUIET_ORG])
  await pg.query('INSERT INTO organization_members (org_id, user_id) VALUES ($1, $2), ($1, $3), ($4, $5)', [ORG, ALICE, BOB, QUIET_ORG, OUTSIDER])
  // November: Alice 3 calls (10 cents each), Bob 2 calls (25 each); an outsider's call doesn't count for ORG.
  // October: a call that belongs to last month.
  await pg.query(`INSERT INTO invocations (consumer_id, cost_cents, created_at) SELECT $1, 10, '2026-11-10T00:00:00Z' FROM generate_series(1, 3)`, [ALICE])
  await pg.query(`INSERT INTO invocations (consumer_id, cost_cents, created_at) SELECT $1, 25, '2026-11-21T23:59:00Z' FROM generate_series(1, 2)`, [BOB])
  await pg.query(`INSERT INTO invocations (consumer_id, cost_cents, created_at) VALUES ($1, 500, '2026-10-31T23:00:00Z')`, [ALICE])
  await pg.query(`INSERT INTO invocations (consumer_id, cost_cents, created_at) VALUES ($1, 999, '2026-10-15T00:00:00Z')`, [OUTSIDER])

  // Rows from earlier runs: three duplicates for November, plus rows the job must not touch.
  for (let i = 0; i < 3; i++) {
    await pg.query(`INSERT INTO cost_allocations (org_id, department_tag, period_start, period_end, total_cents, operation_count) VALUES ($1, 'default', $2, $3, 30, 3)`, [ORG, NOV, DEC])
  }
  await pg.query(`INSERT INTO cost_allocations (org_id, department_tag, period_start, period_end, total_cents, operation_count) VALUES ($1, 'default', '2026-10-01T00:00:00Z', $2, 500, 1)`, [ORG, NOV])
  await pg.query(`INSERT INTO cost_allocations (org_id, department_tag, period_start, period_end, total_cents, operation_count) VALUES ($1, 'eng', $2, $3, 1, 1)`, [ORG, NOV, DEC])
  await pg.query(`INSERT INTO cost_allocations (org_id, department_tag, service_id, period_start, period_end, total_cents, operation_count) VALUES ($1, 'default', 'tool-x', $2, $3, 2, 1)`, [ORG, NOV, DEC])
  // QUIET_ORG: a stale November row, though its member made no call in November.
  await pg.query(`INSERT INTO cost_allocations (org_id, department_tag, period_start, period_end, total_cents, operation_count) VALUES ($1, 'default', $2, $3, 7, 1)`, [QUIET_ORG, NOV, DEC])
}, 60_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('cron aggregate-usage: cost allocations (pglite)', () => {
  it("replaces the month's rows with one per organization: the sum over its members", async () => {
    const body = await run()
    expect(body.allocationsCreated).toBe(1) // one row for ORG (not one per member)
    expect(await rows(ORG)).toEqual([
      { department_tag: 'default', service_id: null, period_start: '2026-10', total_cents: 500, operation_count: 1 }, // October untouched
      { department_tag: 'default', service_id: null, period_start: '2026-11', total_cents: 80, operation_count: 5 }, // 3 × 10 + 2 × 25
      { department_tag: 'default', service_id: 'tool-x', period_start: '2026-11', total_cents: 2, operation_count: 1 }, // another service: untouched
      { department_tag: 'eng', service_id: null, period_start: '2026-11', total_cents: 1, operation_count: 1 }, // another department: untouched
    ])
    expect(await rows(QUIET_ORG)).toEqual([]) // no calls this month: no row
  }, 20_000)

  it('a second run leaves exactly the same rows (no duplicates)', async () => {
    await run()
    const nov = (await rows(ORG)).filter((r) => r.period_start === '2026-11' && r.department_tag === 'default' && r.service_id === null)
    expect(nov).toEqual([{ department_tag: 'default', service_id: null, period_start: '2026-11', total_cents: 80, operation_count: 5 }])
    expect(await rows(ORG)).toHaveLength(4)
  }, 20_000)
})
