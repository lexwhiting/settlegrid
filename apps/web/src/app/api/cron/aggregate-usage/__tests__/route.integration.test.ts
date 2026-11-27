/**
 * The usage cron against real SQL (pglite).
 *
 * - Plan-usage warnings: ops this UTC month per developer (every invocation of their
 *   tools, as the usage page counts them) against the tier the usage page shows
 *   (founding members get Scale); one email per level and month.
 * - Month-end catch-up: for two days after a month ends, its levels are still checked
 *   under its keys (a level crossed after its last run; a send left unresolved).
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
  ttl: new Map<string, number | undefined>(),
  send: null as unknown as Mock,
}))
holder.send = vi.fn(async () => 'sent')

function upstashValue(v: string | undefined): unknown {
  if (v === undefined) return null
  try { return JSON.parse(v) } catch { return v }
}

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => 'ok' }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    // Like Upstash: stored JSON comes back parsed
    get: async (k: string) => upstashValue(holder.store.get(k)),
    mget: async (...ks: string[]) => ks.map((k) => upstashValue(holder.store.get(k))),
    set: async (k: string, v: string, opts?: { nx?: boolean; ex?: number }) => {
      if (opts?.nx && holder.store.has(k)) return null
      holder.store.set(k, v)
      holder.ttl.set(k, opts?.ex)
      return 'OK'
    },
    del: async (k: string) => (holder.store.delete(k) ? 1 : 0),
    // The delivery scripts (lib/notification-delivery), each one atomic step
    eval: async (_script: string, keys: string[], args: string[]) => {
      if (keys.length === 3) {
        // Begin: the record, the claim, the attempt
        if (holder.store.has(keys[0])) return ['delivered']
        if (holder.store.get(keys[1]) !== args[0]) return ['lost']
        const a = holder.store.get(keys[2])
        if (a !== undefined) return ['existing', upstashValue(a)]
        if (args[1] === '') return ['missing']
        holder.store.set(keys[2], args[1])
        holder.ttl.set(keys[2], Number(args[2]))
        return ['created']
      }
      // Release the claim, or clear a refused attempt: delete the last key if every key
      // still holds its argument
      return keys.every((k, i) => holder.store.get(k) === args[i]) && holder.store.delete(keys[keys.length - 1]) ? 1 : 0
    },
  }),
}))
vi.mock('@/lib/notifications', () => ({
  sendNotificationEmail: (...a: unknown[]) => holder.send(...a),
  sendNotificationEmailResult: (...a: unknown[]) => holder.send(...a),
}))
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
const LATE = 'd0000000-0000-4000-8000-000000000009' // 39,000 this month (78%); crosses 80% at 23:55 on 30 Nov
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
    [ACADEMIC, 'academic', false], [LEGACY, 'starter', false], [LATE, 'standard', false],
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
  await calls(LATE, 39_000, '2026-11-15T00:00:00Z')

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

  it('a failed send releases its claim and is sent by the next run; an opted-out one is not counted or retried', async () => {
    holder.store.clear()
    holder.send.mockImplementation(async (a: { developerId: string }) => (a.developerId === AT_100 ? 'unknown' : 'opted_out'))
    try {
      const first = await run()
      expect(first).toMatchObject({ alertsSent: 0, failed: 1, skipped: 1 })
      // AT_100 not recorded (retried); its first attempt is remembered; claims released
      expect([...holder.store.keys()].sort()).toEqual([`usage-alert:${AT_100}:2026-11:100:attempt`, `usage-alert:${AT_80}:2026-11:90`].sort())
    } finally {
      holder.send.mockImplementation(async () => 'sent')
    }
    holder.send.mockClear()
    const second = await run()
    expect(second).toMatchObject({ alertsSent: 1, failed: 0, skipped: 0 })
    expect(sentTo()).toEqual([AT_100])
  }, 30_000)

  it('a run killed mid-send blocks nobody: its claim expires and a later run sends it, with the same idempotency key', async () => {
    holder.store.clear()
    holder.store.set(`usage-alert:${AT_100}:2026-11:100:inflight`, '1') // claimed, never recorded
    holder.send.mockClear()
    const first = await run()
    expect(sentTo()).toEqual([AT_80]) // AT_100 is busy
    expect(first).toMatchObject({ alertsSent: 1 })
    holder.store.delete(`usage-alert:${AT_100}:2026-11:100:inflight`) // the claim's 10 minutes are up
    holder.send.mockClear()
    await run()
    expect(holder.send.mock.calls[0][0]).toMatchObject({ developerId: AT_100, idempotencyKey: `usage-alert:${AT_100}:2026-11:100` })
  }, 30_000)

  it("a level crossed after the month's last run is sent on the 1st, under that month's key and naming the month", async () => {
    holder.store.clear()
    vi.setSystemTime(new Date('2026-11-30T23:50:00.000Z')) // November's last run
    try {
      await run()
      expect(sentTo()).not.toContain(LATE) // 78%
      await calls(LATE, 1_500, '2026-11-30T23:55:00Z') // 40,500 = 81%, after the last run
      holder.send.mockClear()
      vi.setSystemTime(new Date('2026-12-01T00:50:00.000Z')) // December's first run
      const body = await run()
      expect(body).toMatchObject({ period: '2026-12-01T00:00:00.000Z', caughtUp: '2026-11-01T00:00:00.000Z', alertsSent: 1 })
      expect(sentTo()).toEqual([LATE])
      const sent = holder.send.mock.calls[0][0] as { subject: string; idempotencyKey: string }
      expect(sent.idempotencyKey).toBe(`usage-alert:${LATE}:2026-11:80`)
      expect(sent.subject).toContain('November 2026')
      holder.send.mockClear()
      await run()
      expect(holder.send).not.toHaveBeenCalled() // once only

      // November's records outlive November and its two-day catch-up
      expect(holder.ttl.get(`usage-alert:${LATE}:2026-11:80`)).toBeGreaterThanOrEqual((31 + 2) * 24 * 60 * 60)

      // November is still checked for two days, so a missed run or two loses nothing...
      vi.setSystemTime(new Date('2026-12-02T23:50:00.000Z'))
      expect((await run()).caughtUp).toBe('2026-11-01T00:00:00.000Z')
      expect(holder.send).not.toHaveBeenCalled()

      // ...and once the catch-up is over, it is no longer checked (December has no calls)
      holder.store.clear()
      vi.setSystemTime(new Date('2026-12-03T00:00:00.000Z'))
      const after = await run()
      expect(after.caughtUp).toBeUndefined()
      expect(holder.send).not.toHaveBeenCalled()
    } finally {
      vi.setSystemTime(NOW)
    }
  }, 60_000)

  it('a send left unresolved just before midnight is retried after the rollover with its original payload and key, then recorded as ambiguous', async () => {
    holder.store.clear()
    holder.send.mockImplementation(async (a: { developerId: string }) => (a.developerId === AT_100 ? 'unknown' : 'sent'))
    try {
      vi.setSystemTime(new Date('2026-11-30T23:50:00.000Z'))
      await run()
      const first = holder.send.mock.calls.find((c) => (c[0] as { developerId: string }).developerId === AT_100)![0]
      expect(holder.store.has(`usage-alert:${AT_100}:2026-11:100:attempt`)).toBe(true)

      holder.send.mockClear()
      vi.setSystemTime(new Date('2026-12-01T00:50:00.000Z')) // still inside Resend's 24 h window
      const retry = await run()
      expect(sentTo()).toEqual([AT_100])
      expect(holder.send.mock.calls[0][0]).toEqual(first) // same recipient, subject, HTML and key
      expect(retry).toMatchObject({ alertsSent: 0, failed: 1 })

      holder.send.mockClear()
      vi.setSystemTime(new Date('2026-12-01T23:50:00.000Z')) // 24 h after the first attempt
      const late = await run()
      expect(holder.send).not.toHaveBeenCalled() // never resent outside the window
      expect(late).toMatchObject({ failed: 1 })
      expect(holder.store.get(`usage-alert:${AT_100}:2026-11:100`)).toBe('ambiguous')
    } finally {
      holder.send.mockImplementation(async () => 'sent')
      vi.setSystemTime(NOW)
    }
  }, 60_000)

  it('leaves cost_allocations alone (paused), though an organization has members with calls', async () => {
    const r = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM cost_allocations')
    expect(r.rows[0].n).toBe(2)
  })
})
