/**
 * The quality-check cron against real SQL (pglite).
 *
 * - Every active tool is checked, however many there are (a 501st tool counts).
 * - Alerts go out in order (slow response, then high error rate, then no traffic),
 *   at most 50 emails per run; the rest are deferred, get no cooldown, and go out
 *   on a later run.
 * - Cooldowns are respected; inactive tools are not checked.
 *
 * Redis is an in-memory fake; emails are captured, not sent. The schema is a
 * test-only CREATE TABLE bootstrap of the columns the route reads (no
 * drizzle-kit, no migrations). The clock is fixed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const fakeRedis = vi.hoisted(() => {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); return 'OK' }),
    mget: vi.fn(async (...keys: string[]) => keys.map((k) => store.get(k) ?? null)),
  }
})
const sendNotificationEmail = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/redis', () => ({ getRedis: () => fakeRedis }))
vi.mock('@/lib/notifications', () => ({ sendNotificationEmail }))
vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => 'ok' }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET } from '../route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, name text,
    notification_preferences jsonb);
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL, name text NOT NULL,
    status text NOT NULL DEFAULT 'active', total_invocations integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL,
    latency_ms integer, status text NOT NULL DEFAULT 'success', created_at timestamptz NOT NULL);
`

const NOW = new Date('2026-11-22T12:00:00.000Z')
let pg: PGlite

type Sent = { email: string; subject: string; developerId: string }
const sentEmails = () => (sendNotificationEmail.mock.calls as unknown as Array<[Sent]>).map(([p]) => p)

async function run() {
  const res = await GET(new NextRequest('http://localhost:3005/api/cron/quality-check'))
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

  const dev = async (email: string) =>
    (await pg.query<{ id: string }>('INSERT INTO developers (email, name) VALUES ($1, $2) RETURNING id', [email, email.split('@')[0]])).rows[0].id
  const tool = async (developerId: string, name: string, minutes: number, extra: { status?: string; total?: number } = {}) =>
    (await pg.query<{ id: string }>(
      `INSERT INTO tools (developer_id, name, status, total_invocations, created_at) VALUES ($1, $2, $3, $4, timestamptz '2026-01-01T00:00:00Z' + $5 * interval '1 minute') RETURNING id`,
      [developerId, name, extra.status ?? 'active', extra.total ?? 0, minutes],
    )).rows[0].id
  const calls = async (toolId: string, n: number, latencyMs: number, status: string, at: string) =>
    pg.query(`INSERT INTO invocations (tool_id, latency_ms, status, created_at) SELECT $1, $2, $3, $4 FROM generate_series(1, $5::int)`, [toolId, latencyMs, status, at, n])

  // 500 quiet active tools (never called), created first.
  const quiet = await dev('quiet@example.com')
  await pg.query(
    `INSERT INTO tools (developer_id, name, created_at) SELECT $1, 'Quiet ' || g, timestamptz '2026-01-01T00:00:00Z' + g * interval '1 minute' FROM generate_series(1, 500) g`,
    [quiet],
  )
  // The 501st active tool: slow in the last hour (10 calls at 3 s).
  const slowDev = await dev('slow@example.com')
  const slow = await tool(slowDev, 'Slow tool', 600, { total: 10 })
  await calls(slow, 10, 3000, 'success', '2026-11-22T11:30:00Z')
  // A failing tool: 10 calls in the last hour, 2 errors (20%).
  const errDev = await dev('errors@example.com')
  const failing = await tool(errDev, 'Failing tool', 601, { total: 10 })
  await calls(failing, 8, 100, 'success', '2026-11-22T11:40:00Z')
  await calls(failing, 2, 100, 'error', '2026-11-22T11:41:00Z')
  // 60 previously used tools with no call for 10 days.
  const idleDev = await dev('idle@example.com')
  for (let i = 0; i < 60; i++) {
    const t = await tool(idleDev, `Idle ${String(i).padStart(2, '0')}`, 700 + i, { total: 1 })
    await calls(t, 1, 100, 'success', '2026-11-12T12:00:00Z')
  }
  // An inactive tool that would otherwise be slow: never checked.
  const draft = await tool(slowDev, 'Draft tool', 800, { status: 'draft', total: 10 })
  await calls(draft, 10, 5000, 'success', '2026-11-22T11:30:00Z')
}, 120_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

beforeEach(() => {
  sendNotificationEmail.mockClear()
})

describe('cron quality-check (pglite)', () => {
  it('checks every active tool and sends at most 50 alerts per run, last-hour checks first', async () => {
    // One idle tool already has a no-traffic cooldown.
    const [{ id: idle59 }] = (await pg.query<{ id: string }>(`SELECT id FROM tools WHERE name = 'Idle 59'`)).rows
    fakeRedis.store.set(`quality:notraffic:${idle59}`, '1')

    const body = await run()
    expect(body.toolsChecked).toBe(562) // 500 quiet + slow + failing + 60 idle; not the draft
    expect(body.alerts).toEqual({ slowResponse: 1, highErrorRate: 1, noTraffic: 48 })
    expect(body.totalAlerts).toBe(50)
    expect(body.deferred).toBe(11) // 59 idle candidates off cooldown, 48 sent

    const sent = sentEmails()
    expect(sent).toHaveLength(50)
    expect(sent[0]).toMatchObject({ email: 'slow@example.com' }) // the 501st active tool
    expect(sent[1]).toMatchObject({ email: 'errors@example.com' })
    expect(sent.slice(2).every((e) => e.email === 'idle@example.com')).toBe(true)
    expect(sent.some((e) => /Draft tool/.test(e.subject))).toBe(false)
    expect(fakeRedis.store.has(`quality:slow:${(await pg.query<{ id: string }>(`SELECT id FROM tools WHERE name = 'Slow tool'`)).rows[0].id}`)).toBe(true)
  }, 30_000)

  it('sends the deferred alerts on the next run, and nothing again while cooldowns last', async () => {
    const second = await run()
    expect(second.alerts).toEqual({ slowResponse: 0, highErrorRate: 0, noTraffic: 11 })
    expect(second.deferred).toBe(0)
    expect(sentEmails()).toHaveLength(11)

    sendNotificationEmail.mockClear()
    const third = await run()
    expect(third).toMatchObject({ totalAlerts: 0, deferred: 0 })
    expect(sentEmails()).toHaveLength(0)
  }, 30_000)
})
