/**
 * The monthly summary cron while it is off (pglite): it sends nothing, though a
 * developer with an active tool had calls last month.
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
vi.mock('@/lib/notifications', () => ({ sendNotificationEmail: (...a: unknown[]) => holder.send(...(a as [])) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET } from '../route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY, email text NOT NULL, name text);
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL, name text NOT NULL,
    status text NOT NULL DEFAULT 'active');
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL, consumer_id uuid NOT NULL,
    cost_cents integer NOT NULL, is_test boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL);
`

const DEV = 'd0000000-0000-4000-8000-000000000001'
let pg: PGlite

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-12-01T09:00:00.000Z'))
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })
  await pg.query(`INSERT INTO developers (id, email, name) VALUES ($1, 'dev@example.com', 'Dev')`, [DEV])
  await pg.query(`INSERT INTO tools (developer_id, name) VALUES ($1, 'search')`, [DEV])
  await pg.query(`INSERT INTO invocations (tool_id, consumer_id, cost_cents, created_at)
    SELECT id, gen_random_uuid(), 50, '2026-11-15T00:00:00Z' FROM tools`)
}, 60_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('cron monthly-summary while off (pglite)', () => {
  it('sends nothing, though a developer had calls last month', async () => {
    const res = await GET(new NextRequest('http://localhost:3005/api/cron/monthly-summary'))
    expect(res.status).toBe(200)
    expect(holder.send).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({ summaries: 'off', emailsSent: 0 })
  }, 20_000)
})
