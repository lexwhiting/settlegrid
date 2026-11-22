/**
 * The quality-check cron against real SQL (pglite).
 *
 * - Every active tool is checked, however many there are (a 501st tool counts).
 * - Alerts go out in order (slow response, then high error rate), oldest tool first
 *   (by creation, not insertion),
 *   at most 50 emails per run; the rest are deferred, get no cooldown, and go out on
 *   a later run.
 * - Thresholds: average latency strictly over 2000 ms across at least 10 calls with a
 *   latency; error rate strictly over 10% across at least 10 calls, any status other
 *   than 'success' counting as an error.
 * - The no-traffic alert is switched off: idle tools get no email.
 * - Cooldowns are respected; inactive tools are not checked.
 *
 * Redis is an in-memory fake; emails are captured, not sent. The schema is a
 * test-only CREATE TABLE bootstrap of the columns the route reads (no drizzle-kit,
 * no migrations). The clock is fixed.
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
const IN_LAST_HOUR = '2026-11-22T11:30:00Z'
let pg: PGlite

type Sent = { email: string; subject: string; developerId: string }
const sentEmails = () => (sendNotificationEmail.mock.calls as unknown as Array<[Sent]>).map(([p]) => p)
const toolId = async (name: string) => (await pg.query<{ id: string }>('SELECT id FROM tools WHERE name = $1', [name])).rows[0].id

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
  let minute = 1000
  const tool = async (developerId: string, name: string, extra: { status?: string; total?: number } = {}) =>
    (await pg.query<{ id: string }>(
      `INSERT INTO tools (developer_id, name, status, total_invocations, created_at) VALUES ($1, $2, $3, $4, timestamptz '2026-01-01T00:00:00Z' + $5 * interval '1 minute') RETURNING id`,
      [developerId, name, extra.status ?? 'active', extra.total ?? 10, minute++],
    )).rows[0].id
  const calls = async (id: string, n: number, latencyMs: number | null, status: string, at = IN_LAST_HOUR) =>
    pg.query(`INSERT INTO invocations (tool_id, latency_ms, status, created_at) SELECT $1, $2, $3, $4 FROM generate_series(1, $5::int)`, [id, latencyMs, status, at, n])

  // 500 quiet active tools (never called), created first.
  const quiet = await dev('quiet@example.com')
  await pg.query(
    `INSERT INTO tools (developer_id, name, created_at) SELECT $1, 'Quiet ' || g, timestamptz '2026-01-01T00:00:00Z' + g * interval '1 minute' FROM generate_series(1, 500) g`,
    [quiet],
  )

  // Slow tools: the 501st active tool, then 55 more, then one just over the threshold.
  const slowDev = await dev('slow@example.com')
  await calls(await tool(slowDev, 'Slow 501'), 10, 3000, 'success')
  const manyDev = await dev('many@example.com')
  for (let i = 1; i <= 55; i++) await calls(await tool(manyDev, `Slow extra ${String(i).padStart(2, '0')}`), 10, 2500, 'success')
  await calls(await tool(manyDev, 'Just slow'), 10, 2001, 'success') // average 2001 ms: over

  // Near misses: average exactly 2000 ms; 9 calls with a latency (plus 5 without one).
  const edgeDev = await dev('edge@example.com')
  await calls(await tool(edgeDev, 'Exactly 2000'), 10, 2000, 'success')
  const nullLatency = await tool(edgeDev, 'Nine timed')
  await calls(nullLatency, 9, 3000, 'success')
  await calls(nullLatency, 5, null, 'success')

  // Errors: 2 'timeout' in 10 calls (20%) is over; 1 error in 10 (exactly 10%) is not.
  const errDev = await dev('errors@example.com')
  const failing = await tool(errDev, 'Failing tool')
  await calls(failing, 8, 100, 'success')
  await calls(failing, 2, 100, 'timeout')
  const tenPct = await tool(edgeDev, 'Ten percent')
  await calls(tenPct, 9, 100, 'success')
  await calls(tenPct, 1, 100, 'error')

  // Idle tools (used before, no call for 10 days): the no-traffic alert is off.
  const idleDev = await dev('idle@example.com')
  for (let i = 0; i < 5; i++) await calls(await tool(idleDev, `Idle ${i}`, { total: 1 }), 1, 100, 'success', '2026-11-12T12:00:00Z')

  // An inactive tool that would otherwise be slow.
  await calls(await tool(slowDev, 'Draft tool', { status: 'draft' }), 10, 5000, 'success')

  // Inserted last but created first: the oldest slow tool, so it is alerted first.
  const oldDev = await dev('old@example.com')
  const [{ id: oldest }] = (await pg.query<{ id: string }>(
    `INSERT INTO tools (developer_id, name, total_invocations, created_at) VALUES ($1, 'Oldest slow', 10, '2025-01-01T00:00:00Z') RETURNING id`,
    [oldDev],
  )).rows
  await calls(oldest, 10, 2500, 'success')
}, 120_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

beforeEach(() => {
  sendNotificationEmail.mockClear()
})

describe('cron quality-check (pglite)', () => {
  it('checks every active tool and sends at most 50 alerts per run, slow responses first', async () => {
    fakeRedis.store.set(`quality:slow:${await toolId('Slow extra 55')}`, '1') // already on cooldown

    const body = await run()
    // 500 quiet + 58 slow + 2 near-miss latency + 2 error tools + 5 idle; not the draft
    expect(body.toolsChecked).toBe(567)
    expect(body.alerts).toEqual({ slowResponse: 50, highErrorRate: 0, noTraffic: 0 })
    expect(body.totalAlerts).toBe(50)
    expect(body.deferred).toBe(8) // 57 slow off cooldown − 50 sent = 7, plus the failing tool

    const sent = sentEmails()
    expect(sent).toHaveLength(50)
    expect(sent[0]).toMatchObject({ email: 'old@example.com', subject: 'Slow responses detected on Oldest slow' }) // oldest first, not insertion order
    expect(sent[1]).toMatchObject({ email: 'slow@example.com', subject: 'Slow responses detected on Slow 501' }) // the 501st active tool
    expect(sent.slice(2).every((e) => e.email === 'many@example.com')).toBe(true)
    expect(fakeRedis.store.has(`quality:slow:${await toolId('Slow 501')}`)).toBe(true)
  }, 30_000)

  it('sends the deferred alerts on the next run, and nothing again while cooldowns last', async () => {
    const second = await run()
    expect(second.alerts).toEqual({ slowResponse: 7, highErrorRate: 1, noTraffic: 0 })
    expect(second.deferred).toBe(0)
    const sent = sentEmails()
    expect(sent.map((e) => e.subject)).toContain('Slow responses detected on Just slow')
    expect(sent.at(-1)).toMatchObject({ email: 'errors@example.com' }) // errors after slow responses
    expect(sent.at(-1)?.subject).toMatch(/^High error rate on Failing tool/)

    sendNotificationEmail.mockClear()
    const third = await run()
    expect(third).toMatchObject({ totalAlerts: 0, deferred: 0 })
    expect(sentEmails()).toHaveLength(0)
  }, 30_000)

  it('never alerts on the near misses, idle tools or inactive tools', async () => {
    // Every alert sent sets a cooldown, so the cooldown store records who was alerted across both runs.
    for (const name of ['Exactly 2000', 'Nine timed', 'Ten percent', 'Draft tool']) {
      const id = await toolId(name)
      expect(fakeRedis.store.has(`quality:slow:${id}`)).toBe(false)
      expect(fakeRedis.store.has(`quality:error:${id}`)).toBe(false)
    }
    for (let i = 0; i < 5; i++) expect(fakeRedis.store.has(`quality:notraffic:${await toolId(`Idle ${i}`)}`)).toBe(false)
    const keys = [...fakeRedis.store.keys()]
    expect(keys.filter((k) => k.startsWith('quality:slow:'))).toHaveLength(58) // 57 sent + 1 pre-set
    expect(keys.filter((k) => k.startsWith('quality:error:'))).toHaveLength(1)
    expect(keys.filter((k) => k.startsWith('quality:notraffic:'))).toHaveLength(0)
  }, 20_000)
})
