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
  send: null as unknown as Mock,
  template: null as unknown as Mock,
}))
holder.send = vi.fn(async () => undefined)
holder.template = vi.fn(() => ({ subject: 'Your monthly summary', html: '<p>summary</p>' }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/cron-auth', () => ({ verifyCronAuth: () => 'ok' }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    get: async (k: string) => holder.store.get(k) ?? null,
    set: async (k: string, v: string, opts?: { nx?: boolean }) => {
      if (opts?.nx && holder.store.has(k)) return null
      holder.store.set(k, v)
      return 'OK'
    },
  }),
}))
vi.mock('@/lib/notifications', () => ({ sendNotificationEmail: (...a: unknown[]) => holder.send(...a) }))
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

// 1 December 03:00 UTC is still 30 November in Los Angeles: the report is on November.
const NOW = new Date('2026-12-01T03:00:00.000Z')
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

beforeEach(() => { holder.send.mockClear(); holder.template.mockClear() })

afterAll(async () => {
  vi.useRealTimers()
  if (savedTz === undefined) delete process.env.TZ
  else process.env.TZ = savedTz
  await pg?.close()
})

describe('cron monthly-summary (pglite)', () => {
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
    expect([...holder.store.keys()].sort()).toEqual([`monthly-summary:${ACTIVE}:2026-11`, `monthly-summary:${TIED}:2026-11`])
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
    holder.send.mockImplementationOnce(async () => { vi.setSystemTime(new Date(NOW.getTime() + 50_000)) })
    const first = await run()
    expect(first).toMatchObject({ emailsSent: 1, remaining: 1 })
    expect(holder.send.mock.calls.map((c) => (c[0] as { developerId: string }).developerId)).toEqual([ACTIVE])

    vi.setSystemTime(NOW)
    holder.send.mockClear()
    const second = await run()
    expect(second).toMatchObject({ emailsSent: 1, remaining: 0 })
    expect(holder.send.mock.calls.map((c) => (c[0] as { developerId: string }).developerId)).toEqual([TIED])
  }, 20_000)
})
