/**
 * The usage page's plan limit (pglite): the same limits the usage-warning emails use
 * (tier-config), so the page and the email agree.
 *
 * - Legacy starter/growth count as Builder; academic has its own limit.
 * - Founding members get Scale; enterprise (uncapped) shows a display limit.
 *
 * The schema is a test-only CREATE TABLE bootstrap (no drizzle-kit, no migrations).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown, id: '' }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: vi.fn(async () => ({ id: holder.id })) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET } from '../route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY, tier text NOT NULL DEFAULT 'standard',
    is_founding_member boolean NOT NULL DEFAULT false);
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL,
    created_at timestamptz NOT NULL);
`

const DEVS: Array<[string, string, boolean, number]> = [
  // id, stored tier, founding member, expected limit
  ['d0000000-0000-4000-8000-000000000001', 'standard', false, 50_000],
  ['d0000000-0000-4000-8000-000000000002', 'starter', false, 200_000],
  ['d0000000-0000-4000-8000-000000000003', 'growth', false, 200_000],
  ['d0000000-0000-4000-8000-000000000004', 'academic', false, 500_000],
  ['d0000000-0000-4000-8000-000000000005', 'standard', true, 2_000_000],
  ['d0000000-0000-4000-8000-000000000006', 'enterprise', false, 10_000_000],
]
let pg: PGlite

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T00:00:00.000Z'))
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })
  for (const [id, tier, founder] of DEVS) {
    await pg.query('INSERT INTO developers (id, tier, is_founding_member) VALUES ($1, $2, $3)', [id, tier, founder])
    await pg.query('INSERT INTO tools (developer_id) VALUES ($1)', [id])
  }
  await pg.query(`INSERT INTO invocations (tool_id, created_at) SELECT id, '2026-11-10T00:00:00Z' FROM tools`)
}, 60_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('GET /api/dashboard/developer/usage: plan limits (pglite)', () => {
  it.each(DEVS)('developer %s (tier %s, founding member %s) sees a limit of %d', async (id, _tier, _founder, limit) => {
    holder.id = id
    const res = await GET(new NextRequest('http://localhost:3005/api/dashboard/developer/usage'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ currentMonthOps: 1, tierLimit: limit })
  }, 20_000)
})
