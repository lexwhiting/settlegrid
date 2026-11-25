/**
 * The monthly summary cron against real SQL (pglite).
 *
 * - Reports on the last UTC calendar month, whatever the server's time zone, with
 *   the month before it for the trend.
 * - Sandbox (test) calls don't count. Developers with no calls last month, or no
 *   active tool, get no email.
 * - One email per developer and month: a second run sends nothing; a run that ran
 *   out of time leaves the rest to the next run.
 * - The top tool is the one with most revenue (ties: the name that sorts first). No
 *   trend when the month before may be partly purged (short log retention).
 *
 * The schema is a test-only CREATE TABLE bootstrap of the columns the route reads
 * (no drizzle-kit, no migrations). Redis is an in-memory map; the email template
 * and the sender are mocks, so the figures passed to the template are checked.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({
  db: null as unknown,
  store: new Map<string, string>(),
  zsets: new Map<string, number>(),
  send: null as unknown as Mock,
  template: null as unknown as Mock,
}))
holder.send = vi.fn(async () => 'sent')
holder.template = vi.fn(() => ({ subject: 'Your monthly summary', html: '<p>summary</p>' }))

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
    zscore: async (k: string) => holder.zsets.get(k) ?? null,
    set: async (k: string, v: string, opts?: { nx?: boolean }) => {
      if (opts?.nx && holder.store.has(k)) return null
      holder.store.set(k, v)
      return 'OK'
    },
    del: async (k: string) => (holder.store.delete(k) ? 1 : 0),
  }),
}))
vi.mock('@/lib/notifications', () => ({
  sendNotificationEmail: (...a: unknown[]) => holder.send(...a),
  sendNotificationEmailResult: (...a: unknown[]) => holder.send(...a),
}))
vi.mock('@/lib/email', () => ({ monthlyDeveloperSummaryEmail: (...a: unknown[]) => holder.template(...a) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))

import { GET } from '../route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY, email text NOT NULL, name text,
    log_retention_days integer NOT NULL DEFAULT 90);
  CREATE TABLE tools (id uuid PRIMARY KEY, developer_id uuid NOT NULL, name text NOT NULL,
    status text NOT NULL DEFAULT 'active');
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL,
    consumer_id uuid NOT NULL, cost_cents integer NOT NULL, is_test boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL);
`

// 1 December 02:00 UTC (inside the capture window, before the 03:00 purge) is still
// 30 November in Los Angeles: the report is on November.
const NOW = new Date('2026-12-01T02:00:00.000Z')
const CONSUMER = 'c0000000-0000-4000-8000-000000000001'
const ACTIVE = 'd0000000-0000-4000-8000-000000000001'
const QUIET = 'd0000000-0000-4000-8000-000000000002' // calls in October only
const RETIRED = 'd0000000-0000-4000-8000-000000000003' // calls in November, no active tool
const SANDBOX = 'd0000000-0000-4000-8000-000000000004' // sandbox calls only
const TIED = 'd0000000-0000-4000-8000-000000000005' // two tools tied on revenue; 30-day log retention
const T_SEARCH = 'e0000000-0000-4000-8000-000000000001'
const T_MAPS = 'e0000000-0000-4000-8000-000000000002'
const T_RETIRED = 'e0000000-0000-4000-8000-000000000003'
const T_QUIET = 'e0000000-0000-4000-8000-000000000004'
const T_SANDBOX = 'e0000000-0000-4000-8000-000000000005'
const T_BETA = 'e0000000-0000-4000-8000-000000000006'
const T_ALPHA = 'e0000000-0000-4000-8000-000000000007'
let pg: PGlite
let savedTz: string | undefined

async function calls(tool: string, n: number, cents: number, at: string, isTest = false) {
  await pg.query(
    `INSERT INTO invocations (tool_id, consumer_id, cost_cents, is_test, created_at)
     SELECT $1, $2, $3, $4, $5::timestamptz FROM generate_series(1, $6)`,
    [tool, CONSUMER, cents, isTest, at, n],
  )
}

async function run() {
  const res = await GET(new NextRequest('http://localhost:3005/api/cron/monthly-summary'))
  expect(res.status).toBe(200)
  return res.json()
}
const runStatus = async () => (await GET(new NextRequest('http://localhost:3005/api/cron/monthly-summary'))).status

beforeAll(async () => {
  savedTz = process.env.TZ
  process.env.TZ = 'America/Los_Angeles'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })

  for (const id of [ACTIVE, QUIET, RETIRED, SANDBOX]) {
    await pg.query('INSERT INTO developers (id, email, name) VALUES ($1, $2, $3)', [id, `${id}@example.com`, 'Dev'])
  }
  await pg.query(`INSERT INTO tools (id, developer_id, name, status) VALUES
    ($1, $5, 'search', 'active'), ($2, $5, 'maps', 'active'), ($3, $6, 'old', 'inactive'),
    ($4, $7, 'quiet', 'active'), ($8, $9, 'sandboxed', 'active')`,
    [T_SEARCH, T_MAPS, T_RETIRED, T_QUIET, ACTIVE, RETIRED, QUIET, T_SANDBOX, SANDBOX])

  // November (UTC): search 4 × 50¢, maps 10 × 10¢ → 300¢, 14 calls; top tool search (200¢)
  await calls(T_SEARCH, 4, 50, '2026-11-01T00:00:00Z') // first instant of November counts
  await calls(T_MAPS, 10, 10, '2026-11-30T23:59:59Z') // last second of November counts
  await calls(T_SEARCH, 5, 1000, '2026-11-15T00:00:00Z', true) // sandbox: doesn't count
  // October: 150¢, 7 calls (the trend base); December: not reported
  await calls(T_SEARCH, 3, 50, '2026-10-01T00:00:00Z')
  await calls(T_MAPS, 4, 0, '2026-10-31T23:59:59Z')
  await calls(T_SEARCH, 9, 999, '2026-12-01T00:00:00Z')
  // September: outside both months
  await calls(T_MAPS, 9, 999, '2026-09-30T23:59:59Z')

  await calls(T_QUIET, 2, 10, '2026-10-15T00:00:00Z')
  await calls(T_RETIRED, 2, 10, '2026-11-15T00:00:00Z')
  await calls(T_SANDBOX, 3, 10, '2026-11-15T00:00:00Z', true)

  await pg.query('INSERT INTO developers (id, email, name, log_retention_days) VALUES ($1, $2, $3, 30)', [TIED, `${TIED}@example.com`, 'Tied'])
  await pg.query(`INSERT INTO tools (id, developer_id, name) VALUES ($1, $3, 'beta'), ($2, $3, 'alpha')`, [T_BETA, T_ALPHA, TIED])
  await calls(T_BETA, 2, 30, '2026-11-20T00:00:00Z') // 60¢
  await calls(T_ALPHA, 3, 20, '2026-11-20T00:00:00Z') // 60¢: tied, 'alpha' sorts first
  await calls(T_ALPHA, 1, 30, '2026-10-20T00:00:00Z') // October survives here, but 30-day retention may have purged some
}, 60_000)

const templateFor = (name: string) => holder.template.mock.calls.find((c) => c[0] === name)
// Delivery records (not the snapshot, done marker or in-flight claims)
const sentKeys = () => [...holder.store.keys()].filter((k) => /^monthly-summary:[0-9a-f-]{36}:2026-11$/.test(k)).sort()

beforeEach(() => { holder.send.mockClear(); holder.template.mockClear() })

afterAll(async () => {
  vi.useRealTimers()
  if (savedTz === undefined) delete process.env.TZ
  else process.env.TZ = savedTz
  await pg?.close()
})

describe('cron monthly-summary (pglite)', () => {
  it('is scheduled every 20 minutes through the month, from 00:15 on the 1st (before the 03:00 purge)', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, '../../../../../../vercel.json'), 'utf8'))
    const crons = vercel.crons as Array<{ path: string; schedule: string }>
    expect(crons.find((c) => c.path === '/api/cron/monthly-summary')?.schedule).toBe('15,35,55 * * * *')
    expect(crons.find((c) => c.path === '/api/cron/data-retention')?.schedule).toBe('0 3 * * *')
    expect(crons.find((c) => c.path === '/api/cron/aggregate-usage')?.schedule).toBe('50 * * * *')
  })

  it("reports last UTC month's figures to developers with activity and an active tool", async () => {
    const body = await run()
    expect(body).toMatchObject({ month: 'November 2026', devsChecked: 2, emailsSent: 2, remaining: 0 })
    expect(holder.template).toHaveBeenCalledTimes(2)
    expect(templateFor('Dev')).toEqual(['Dev', 'November 2026', {
      totalRevenueCents: 300,
      totalInvocations: 14,
      topToolName: 'search',
      topToolRevenueCents: 200,
      momRevenuePct: 100, // 150¢ → 300¢
      momInvocationPct: 100, // 7 → 14
    }])
    expect(templateFor('Tied')).toEqual(['Tied', 'November 2026', {
      totalRevenueCents: 120,
      totalInvocations: 5,
      topToolName: 'alpha',
      topToolRevenueCents: 60,
      momRevenuePct: null, // October may be partly purged under 30-day retention
      momInvocationPct: null,
    }])
    expect(holder.send).toHaveBeenCalledTimes(2)
    expect(holder.send.mock.calls.map((c) => c[0])).toEqual([
      expect.objectContaining({ developerId: ACTIVE, eventKey: 'monthly_summary' }),
      expect.objectContaining({ developerId: TIED, eventKey: 'monthly_summary' }),
    ])
    expect(sentKeys()).toEqual([`monthly-summary:${ACTIVE}:2026-11`, `monthly-summary:${TIED}:2026-11`])
    // The send carries the delivery key as Resend's idempotency key
    expect(holder.send.mock.calls[0][0]).toMatchObject({ idempotencyKey: `monthly-summary:${ACTIVE}:2026-11` })
  }, 20_000)

  it('a second run sends nothing (one summary per developer and month)', async () => {
    const body = await run()
    expect(body).toMatchObject({ emailsSent: 0 })
    expect(holder.send).not.toHaveBeenCalled()
  }, 20_000)

  it('two overlapping runs send one summary between them', async () => {
    holder.store.clear()
    const [a, b] = await Promise.all([run(), run()])
    expect(a.emailsSent + b.emailsSent).toBe(2)
    expect(holder.send).toHaveBeenCalledTimes(2)
  }, 20_000)

  it('a run out of time leaves the rest, and the next run sends only those', async () => {
    holder.store.clear()
    // The first send takes the run past its 45 s budget.
    holder.send.mockImplementationOnce(async () => { vi.setSystemTime(new Date(NOW.getTime() + 50_000)); return 'sent' })
    const first = await run()
    expect(first).toMatchObject({ emailsSent: 1, remaining: 1 })
    expect(holder.send.mock.calls.map((c) => (c[0] as { developerId: string }).developerId)).toEqual([ACTIVE])

    vi.setSystemTime(NOW)
    holder.send.mockClear()
    const second = await run()
    expect(second).toMatchObject({ emailsSent: 1, remaining: 0 })
    expect(holder.send.mock.calls.map((c) => (c[0] as { developerId: string }).developerId)).toEqual([TIED])
  }, 20_000)

  it('a failed send releases its claim and is sent by the next run; an opted-out one is not counted or retried', async () => {
    holder.store.clear()
    holder.send.mockImplementation(async (a: { developerId: string }) => (a.developerId === ACTIVE ? 'unknown' : 'opted_out'))
    try {
      const first = await run()
      expect(first).toMatchObject({ emailsSent: 0, failed: 1, skipped: 1 })
      expect(sentKeys()).toEqual([`monthly-summary:${TIED}:2026-11`]) // ACTIVE not recorded: retried
      expect([...holder.store.keys()].filter((k) => k.endsWith(':inflight'))).toEqual([]) // claims released
    } finally {
      holder.send.mockImplementation(async () => 'sent')
    }
    holder.send.mockClear()
    const second = await run()
    expect(second).toMatchObject({ emailsSent: 1, failed: 0, skipped: 0 })
    expect(holder.send.mock.calls.map((c) => (c[0] as { developerId: string }).developerId)).toEqual([ACTIVE])
  }, 20_000)

  it('a run killed mid-send blocks nobody: its claim expires and a later run sends it', async () => {
    holder.store.clear()
    // A run claimed ACTIVE's summary and died before recording it: the claim is held...
    holder.store.set(`monthly-summary:${ACTIVE}:2026-11:inflight`, '1')
    holder.send.mockClear()
    const first = await run()
    expect(first).toMatchObject({ emailsSent: 1 }) // TIED only; ACTIVE is busy
    expect(holder.store.has('monthly-summary:done:2026-11')).toBe(false) // not finished
    // ...until it expires (10 minutes; the mock store has no TTL, so drop it)
    holder.store.delete(`monthly-summary:${ACTIVE}:2026-11:inflight`)
    holder.send.mockClear()
    const second = await run()
    expect(second).toMatchObject({ emailsSent: 1 })
    expect(holder.send.mock.calls[0][0]).toMatchObject({ developerId: ACTIVE, idempotencyKey: `monthly-summary:${ACTIVE}:2026-11` })
  }, 20_000)

  it('work left after the 1st goes out on a later day from the stored figures, after the log purge; then runs stop', async () => {
    holder.store.clear()
    holder.send.mockClear()
    holder.template.mockClear()
    holder.send.mockImplementationOnce(async () => { vi.setSystemTime(new Date(NOW.getTime() + 50_000)); return 'sent' })
    const first = await run()
    expect(first).toMatchObject({ emailsSent: 1, remaining: 1 })

    // Past every run on the 1st; the logs the figures came from are purged
    await pg.query('DELETE FROM invocations')
    vi.setSystemTime(new Date('2026-12-02T10:15:00.000Z'))
    try {
      holder.send.mockClear()
      holder.template.mockClear()
      const later = await run()
      expect(later).toMatchObject({ month: 'November 2026', emailsSent: 1, remaining: 0 })
      expect(holder.template.mock.calls).toEqual([['Tied', 'November 2026', {
        totalRevenueCents: 120,
        totalInvocations: 5,
        topToolName: 'alpha',
        topToolRevenueCents: 60,
        momRevenuePct: null,
        momInvocationPct: null,
      }]])
      expect(holder.store.has('monthly-summary:done:2026-11')).toBe(true)

      holder.send.mockClear()
      const after = await run()
      expect(after).toMatchObject({ done: true, emailsSent: 0 })
      expect(holder.send).not.toHaveBeenCalled()
    } finally {
      vi.setSystemTime(NOW)
    }
  }, 20_000)

  it('a fresh cache outside the capture window (after the purge, or a mid-month deploy) sends nothing and does not mark the month done', async () => {
    // State after the previous test: November's invocations are purged
    holder.store.clear()
    holder.send.mockClear()
    vi.setSystemTime(new Date('2026-12-02T10:15:00.000Z'))
    try {
      expect(await runStatus()).toBe(503) // the first miss fails the cron run, so it shows
      expect(holder.send).not.toHaveBeenCalled()
      expect(holder.store.has('monthly-summary:done:2026-11')).toBe(false)
      expect([...holder.store.keys()].filter((k) => k.startsWith('monthly-summary:snapshot:'))).toEqual([]) // nothing captured
      expect(holder.store.has('monthly-summary:not-captured:2026-11')).toBe(true) // logged once
      const again = await run()
      expect(again).toMatchObject({ captured: false, emailsSent: 0 })
      expect(holder.send).not.toHaveBeenCalled()
    } finally {
      vi.setSystemTime(NOW)
    }
  }, 20_000)

  it('an incomplete stored snapshot outside the window fails closed: nothing recomputed or sent', async () => {
    // Restore some November data, capture it inside the window, then lose a chunk
    await pg.query('DELETE FROM invocations')
    await calls(T_SEARCH, 4, 50, '2026-11-01T00:00:00Z')
    await calls(T_ALPHA, 1, 20, '2026-11-20T00:00:00Z')
    holder.store.clear()
    holder.send.mockImplementationOnce(async () => { vi.setSystemTime(new Date(NOW.getTime() + 50_000)); return 'sent' })
    expect(await run()).toMatchObject({ emailsSent: 1, remaining: 1 }) // captured; one summary left
    const chunk = [...holder.store.keys()].find((k) => /^monthly-summary:snapshot:2026-11:.+:0$/.test(k))!
    holder.store.delete(chunk)
    vi.setSystemTime(new Date('2026-12-02T10:15:00.000Z'))
    try {
      holder.send.mockClear()
      expect(await runStatus()).toBe(503)
      expect(await run()).toMatchObject({ captured: false, emailsSent: 0 })
      expect(holder.send).not.toHaveBeenCalled()
      expect(holder.store.has('monthly-summary:done:2026-11')).toBe(false)
    } finally {
      vi.setSystemTime(NOW)
    }
  }, 20_000)

  it('after a 31-day month, a developer on 30-day retention (day 1 partly purged) gets no summary rather than understated totals', async () => {
    await pg.query('DELETE FROM invocations')
    await calls(T_SEARCH, 2, 50, '2026-12-01T01:00:00Z') // ACTIVE (90-day retention)
    await calls(T_ALPHA, 2, 20, '2026-12-15T00:00:00Z') // TIED (30-day retention): 1–3 Dec 03:00 may be gone
    holder.store.clear()
    holder.send.mockClear()
    holder.template.mockClear()
    vi.setSystemTime(new Date('2027-01-01T01:00:00.000Z'))
    try {
      const body = await run()
      expect(body).toMatchObject({ month: 'December 2026', devsChecked: 1, emailsSent: 1 })
      expect(holder.send.mock.calls.map((c) => (c[0] as { developerId: string }).developerId)).toEqual([ACTIVE])
    } finally {
      vi.setSystemTime(NOW)
    }
  }, 20_000)

  it("a developer whose month a recorded purge already reached (an early run, or a retention change) is left out", async () => {
    await pg.query('DELETE FROM invocations')
    await calls(T_SEARCH, 2, 50, '2026-11-20T00:00:00Z') // ACTIVE (90-day retention)
    await calls(T_ALPHA, 2, 20, '2026-11-20T00:00:00Z') // TIED
    holder.store.clear()
    holder.send.mockClear()
    // The purge recorded a cutoff inside November for ACTIVE (it ran early, with a shorter retention)
    holder.zsets.set(`retention:invocations-cutoff:${ACTIVE}`, Date.parse('2026-11-05T00:00:00.000Z'))
    const body = await run()
    expect(body).toMatchObject({ month: 'November 2026', devsChecked: 1, emailsSent: 1 })
    expect(holder.send.mock.calls.map((c) => (c[0] as { developerId: string }).developerId)).toEqual([TIED])
  }, 20_000)

  it('an incomplete stored snapshot inside the capture window is not repaired either: logged once, 503, nothing sent', async () => {
    holder.store.clear()
    holder.zsets.clear()
    holder.send.mockImplementationOnce(async () => { vi.setSystemTime(new Date(NOW.getTime() + 50_000)); return 'sent' })
    await run() // captured; one summary left
    vi.setSystemTime(NOW) // still inside the window
    const chunk = [...holder.store.keys()].find((k) => /^monthly-summary:snapshot:2026-11:.+:0$/.test(k))!
    holder.store.delete(chunk)
    const meta = holder.store.get('monthly-summary:snapshot:2026-11')
    holder.send.mockClear()
    expect(await runStatus()).toBe(503)
    expect(holder.store.has('monthly-summary:not-captured:2026-11')).toBe(true) // logged as not captured
    expect(holder.store.get('monthly-summary:snapshot:2026-11')).toBe(meta) // not replaced
    expect(holder.send).not.toHaveBeenCalled()
  }, 20_000)

  it('a summary not sent because email is not configured stays pending, and a later configured run sends it', async () => {
    holder.store.clear()
    holder.zsets.clear()
    holder.send.mockClear()
    holder.send.mockImplementation(async () => 'not_sent') // no Resend key: sendNotificationEmailResult says not_sent
    try {
      const first = await run()
      expect(first).toMatchObject({ emailsSent: 0 })
      expect(first.failed).toBeGreaterThan(0)
      expect(sentKeys()).toEqual([]) // nothing recorded as delivered
    } finally {
      holder.send.mockImplementation(async () => 'sent')
    }
    const later = await run()
    expect(later.emailsSent).toBe(later.devsChecked)
    expect(sentKeys().length).toBe(later.devsChecked)
  }, 20_000)

  it('a purge high-water mark inside the month before (retention raised since) drops the trend', async () => {
    // ACTIVE keeps 90 days now, but an earlier purge under 30 days already deleted
    // October's first days: the recorded mark is 5 Oct, so October is incomplete
    await pg.query('DELETE FROM invocations')
    await calls(T_SEARCH, 2, 50, '2026-11-20T00:00:00Z')
    await calls(T_SEARCH, 1, 50, '2026-10-20T00:00:00Z')
    holder.store.clear()
    holder.zsets.clear()
    holder.send.mockClear()
    holder.template.mockClear()
    holder.zsets.set(`retention:invocations-cutoff:${ACTIVE}`, Date.parse('2026-10-05T00:00:00.000Z'))
    expect(await run()).toMatchObject({ emailsSent: 1 })
    expect(templateFor('Dev')?.[2]).toMatchObject({ totalRevenueCents: 100, momRevenuePct: null, momInvocationPct: null })
  }, 20_000)
})
