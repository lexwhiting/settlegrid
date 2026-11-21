/**
 * Eight dashboard routes against real SQL (pglite): attribution, funnel, usage,
 * fraud signals, CSV export, advanced analytics, consumer insights and the
 * security checklist.
 *
 * - No route caps the number of tools it reads: a developer's 501st tool counts
 *   like the first, and its name shows where names are shown.
 * - Consumer insights filters before it limits: churning consumers are the top
 *   spenders among those who stopped, and at-risk consumers are found among all
 *   consumers, not the first 1,000 rows of an unordered list.
 * - Advanced analytics counts returning consumers over all consumers, and
 *   compares each day with the same day one period earlier.
 * - Days, weekdays, hours and months are UTC whatever the session or server
 *   time zone.
 *
 * The schema is a test-only CREATE TABLE bootstrap of the columns these routes
 * read (no drizzle-kit, no migrations). Fixtures are SQL inserts. The clock is
 * fixed and the session time zone is UTC unless a test sets another.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { NextRequest } from 'next/server'
import * as schema from '@/lib/db/schema'

const holder = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof drizzle> }))
const authState = vi.hoisted(() => ({ id: '' }))

vi.mock('@/lib/db', () => ({ get db() { return holder.db } }))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: vi.fn(async () => ({ id: authState.id })) }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: () => 'test-ip',
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 }),
}))
vi.mock('@/lib/redis', () => ({ getRedis: () => ({ ping: vi.fn().mockResolvedValue('PONG') }) }))

import { GET as getAttribution } from '../stats/attribution/route'
import { GET as getFunnel } from '../stats/funnel/route'
import { GET as getUsage } from '../usage/route'
import { GET as getFraudSignals } from '../fraud/signals/route'
import { GET as getExport } from '../stats/export/route'
import { GET as getAdvanced } from '../stats/advanced/route'
import { GET as getInsights } from '../consumers/insights/route'
import { GET as getSecurityStatus } from '../security-status/route'

const BOOTSTRAP_SQL = `
  SET TIME ZONE 'UTC';
  CREATE TABLE developers (id uuid PRIMARY KEY, tier text NOT NULL DEFAULT 'standard',
    is_founding_member boolean NOT NULL DEFAULT false,
    stripe_connect_status text NOT NULL DEFAULT 'not_started');
  CREATE TABLE api_keys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), consumer_id uuid NOT NULL,
    tool_id uuid NOT NULL, status text NOT NULL DEFAULT 'active', ip_allowlist jsonb,
    created_at timestamptz NOT NULL);
  CREATE TABLE consumer_tool_balances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id uuid NOT NULL, tool_id uuid NOT NULL, spending_limit_cents integer);
  CREATE TABLE webhook_endpoints (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'active');
  CREATE TABLE tools (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), developer_id uuid NOT NULL,
    name text NOT NULL, status text NOT NULL DEFAULT 'active');
  CREATE TABLE consumers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL);
  CREATE TABLE invocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL,
    consumer_id uuid NOT NULL, method text NOT NULL DEFAULT 'run', cost_cents integer NOT NULL,
    latency_ms integer, status text NOT NULL DEFAULT 'success', is_test boolean NOT NULL DEFAULT false,
    session_id text, referral_code text, is_flagged boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL);
  CREATE TABLE conversion_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tool_id uuid NOT NULL,
    consumer_id uuid NOT NULL, event text NOT NULL, from_tier text, to_tier text, metadata jsonb,
    created_at timestamptz NOT NULL);
`

// "Today" is Sunday 2026-11-15 (UTC).
const NOW = new Date('2026-11-15T12:30:00.000Z')
const [HOUR, DAY] = [3_600_000, 86_400_000]
const at = (msBeforeNow: number) => new Date(NOW.getTime() - msBeforeNow).toISOString()

let n = 0 // deterministic UUIDs: prefix + counter
const uid = (prefix: string) => `${prefix}-0000-4000-8000-${String(++n).padStart(12, '0')}`
let pg: PGlite

async function developer() {
  const id = uid('d0000000')
  await pg.query("INSERT INTO developers (id, tier) VALUES ($1, 'scale')", [id])
  return id
}
async function tool(developerId: string, name: string) {
  const id = uid('a0000000')
  await pg.query('INSERT INTO tools (id, developer_id, name) VALUES ($1, $2, $3)', [id, developerId, name])
  return id
}
async function consumer(email: string, prefix = 'c0000000') {
  const id = uid(prefix)
  await pg.query('INSERT INTO consumers (id, email) VALUES ($1, $2)', [id, email])
  return id
}
/** `count` calls by one consumer on one tool, at `createdAt`, `cents` each. */
async function calls(toolId: string, consumerId: string, count: number, cents: number, createdAt: string, extra: Record<string, unknown> = {}) {
  await pg.query(
    `INSERT INTO invocations (tool_id, consumer_id, cost_cents, latency_ms, session_id, referral_code, is_flagged, created_at)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8 FROM generate_series(1, $9::int)`,
    [toolId, consumerId, cents, extra.latencyMs ?? 100, extra.sessionId ?? null, extra.referralCode ?? null, extra.flagged ?? false, createdAt, count],
  )
}

async function call(handler: (req: NextRequest) => Promise<Response>, developerId: string, path: string) {
  authState.id = developerId
  return handler(new NextRequest(`http://localhost:3005/api/dashboard/developer/${path}`))
}
async function json(handler: (req: NextRequest) => Promise<Response>, developerId: string, path: string) {
  const res = await call(handler, developerId, path)
  expect(res.status).toBe(200)
  return res.json()
}

const DEV = { big: '', churn: '', atRisk: '', utc: '', daily: '', cohort: '', trend: '', other: '', edge: '' }
const C = { big: '', stopped1: '', stopped2: '', decliner: '', faller: '', edge: '' }

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  pg = new PGlite()
  await pg.waitReady
  await pg.exec(BOOTSTRAP_SQL)
  holder.db = drizzle(pg, { schema })

  // BIG: 501 tools. All activity is on the last one created, "Tool 501".
  DEV.big = await developer()
  await pg.query(
    `INSERT INTO tools (developer_id, name) SELECT $1, 'Tool ' || g FROM generate_series(1, 500) g`,
    [DEV.big],
  )
  const tool501 = await tool(DEV.big, 'Tool 501')
  C.big = await consumer('big@example.com')
  await calls(tool501, C.big, 3, 7, at(30 * 60_000), { referralCode: 'ref-a', sessionId: 's-1', latencyMs: 120 })
  await calls(tool501, C.big, 1, 0, at(31 * 60_000), { flagged: true })
  for (const event of ['free_trial', 'upgrade']) {
    await pg.query(
      'INSERT INTO conversion_events (tool_id, consumer_id, event, from_tier, to_tier, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [tool501, C.big, event, 'free', 'pro', at(HOUR)],
    )
  }

  // CHURN: 25 big spenders active 20 days ago and still active this week; 2 smaller
  // spenders active 20 days ago who then stopped.
  DEV.churn = await developer()
  const churnTool = await tool(DEV.churn, 'Churn tool')
  for (let i = 0; i < 25; i++) {
    const c = uid('c1000000')
    await calls(churnTool, c, 1, 1000 + i, at(20 * DAY))
    await calls(churnTool, c, 1, 1, at(2 * DAY))
  }
  C.stopped1 = await consumer('stopped-1@example.com')
  C.stopped2 = await consumer('stopped-2@example.com')
  await calls(churnTool, C.stopped1, 2, 50, at(20 * DAY))
  await calls(churnTool, C.stopped2, 1, 30, at(16 * DAY))
  await calls(churnTool, C.stopped2, 1, 999, at(40 * DAY)) // before the 30-day window: not counted

  // AT RISK: 1,001 steady consumers (5 calls each week), then, inserted last: one who
  // stopped (10 → 0), one down 40% (10 → 6) and one down exactly 30% (10 → 7).
  DEV.atRisk = await developer()
  const riskTool = await tool(DEV.atRisk, 'Risk tool')
  await pg.query(
    `INSERT INTO invocations (tool_id, consumer_id, cost_cents, created_at)
     SELECT $1, ('e0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 1, w
     FROM generate_series(1, 1001) g, generate_series(1, 5) k, unnest(ARRAY[$2::timestamptz, $3::timestamptz]) w`,
    [riskTool, at(10 * DAY), at(2 * DAY)],
  )
  // Their ids sort after every steady consumer's, so a list cut at 1,000 rows in id order drops them.
  C.decliner = await consumer('decliner@example.com', 'f0000000')
  C.faller = await consumer('faller@example.com', 'f0000000')
  C.edge = await consumer('edge@example.com', 'f0000000')
  await calls(riskTool, C.decliner, 10, 1, at(10 * DAY))
  await calls(riskTool, C.faller, 10, 1, at(10 * DAY))
  await calls(riskTool, C.faller, 6, 1, at(2 * DAY))
  await calls(riskTool, C.edge, 10, 1, at(10 * DAY))
  await calls(riskTool, C.edge, 7, 1, at(2 * DAY))

  // UTC: calls at 00:30 UTC today (Sunday), 19:30 on Saturday in New York.
  DEV.utc = await developer()
  const utcTool = await tool(DEV.utc, 'UTC tool')
  await calls(utcTool, uid('c2000000'), 2, 5, '2026-11-15T00:30:00.000Z', { sessionId: 's-utc' })

  // BIG's 501st tool also has two active keys (one created 100 days ago without an IP allowlist,
  // one yesterday with one) and a consumer balance with a spending limit.
  await pg.query('INSERT INTO api_keys (consumer_id, tool_id, created_at) VALUES ($1, $2, $3)', [C.big, tool501, at(100 * DAY)])
  await pg.query(`INSERT INTO api_keys (consumer_id, tool_id, ip_allowlist, created_at) VALUES ($1, $2, '["10.0.0.0/8"]', $3)`, [C.big, tool501, at(DAY)])
  await pg.query('INSERT INTO consumer_tool_balances (consumer_id, tool_id, spending_limit_cents) VALUES ($1, $2, 500)', [C.big, tool501])

  // COHORT (7-day period): 25 consumers called in both the current and the previous period;
  // 3 more only in the previous one.
  DEV.cohort = await developer()
  const cohortTool = await tool(DEV.cohort, 'Cohort tool')
  for (let i = 0; i < 25; i++) {
    const c = uid('c4000000')
    await calls(cohortTool, c, 1, 10 + i, at(2 * DAY))
    await calls(cohortTool, c, 1, 1, at(9 * DAY))
  }
  for (let i = 0; i < 3; i++) await calls(cohortTool, uid('c5000000'), 1, 1, at(9 * DAY))

  // OTHER: another developer, whose rows must never count for anyone else. Its tool has an
  // active key with an IP allowlist created 200 days ago, a balance with a spending limit, and a
  // call last period by a consumer who calls COHORT's tool only in the current period.
  DEV.other = await developer()
  const otherTool = await tool(DEV.other, 'Other tool')
  const crossConsumer = uid('c7000000')
  await pg.query(`INSERT INTO api_keys (consumer_id, tool_id, ip_allowlist, created_at) VALUES ($1, $2, '["1.2.3.4"]', $3)`, [crossConsumer, otherTool, at(200 * DAY)])
  await pg.query('INSERT INTO consumer_tool_balances (consumer_id, tool_id, spending_limit_cents) VALUES ($1, $2, 900)', [crossConsumer, otherTool])
  await calls(otherTool, crossConsumer, 1, 1, at(9 * DAY))
  await calls(cohortTool, crossConsumer, 1, 1, at(2 * DAY))

  // EDGE (7-day period): one call at exactly the start of the current period.
  DEV.edge = await developer()
  await calls(await tool(DEV.edge, 'Edge tool'), uid('c8000000'), 1, 3, at(7 * DAY))

  // TREND (7-day period): this period has calls on Nov 12 and Nov 14; the previous one on
  // Nov 2, Nov 5 and Nov 7. Nov 12 compares with Nov 5, and Nov 14 with Nov 7.
  DEV.trend = await developer()
  const trendTool = await tool(DEV.trend, 'Trend tool')
  const trendConsumer = uid('c6000000')
  for (const [daysAgo, cents] of [[3, 30], [1, 40], [13, 5], [10, 10], [8, 20]]) {
    await calls(trendTool, trendConsumer, 1, cents, at(daysAgo * DAY))
  }

  // DAILY: one 1-cent call at 12:30 on each of the 91 UTC dates of a 90-day period, today included.
  DEV.daily = await developer()
  const dailyTool = await tool(DEV.daily, 'Daily tool')
  await pg.query(
    `INSERT INTO invocations (tool_id, consumer_id, cost_cents, created_at)
     SELECT $1, 'c3000000-0000-4000-8000-000000000001', 1, $2::timestamptz - d * interval '1 day' FROM generate_series(0, 90) d`,
    [dailyTool, NOW.toISOString()],
  )
}, 120_000)

afterAll(async () => {
  vi.useRealTimers()
  await pg?.close()
})

describe('dashboard routes: no tool cap (pglite)', () => {
  it('attribution, funnel and usage count the 501st tool', async () => {
    const attribution = await json(getAttribution, DEV.big, 'stats/attribution')
    expect(attribution.byReferralSource).toContainEqual({ referralCode: 'ref-a', invocationCount: 3, totalRevenueCents: 21 })
    expect(attribution.topReferringAgents).toEqual([{ referralCode: 'ref-a', uniqueConsumers: 1, totalRevenueCents: 21 }])
    const funnel = await json(getFunnel, DEV.big, 'stats/funnel')
    expect(funnel.funnelSummary).toEqual({ totalTrials: 1, totalUpgrades: 1, totalDowngrades: 0, totalChurns: 0 })
    const usage = await json(getUsage, DEV.big, 'usage')
    expect(usage.currentMonthOps).toBe(4)
  }, 30_000)

  it('fraud signals count the 501st tool', async () => {
    const fraud = await json(getFraudSignals, DEV.big, 'fraud/signals')
    expect(fraud.summary).toMatchObject({ scannedToday: 4, flaggedThisWeek: 1 })
  }, 20_000)

  it('the CSV export lists calls on the 501st tool under its name', async () => {
    const res = await call(getExport, DEV.big, 'stats/export')
    expect(res.status).toBe(200)
    const lines = (await res.text()).split('\n')
    expect(lines).toHaveLength(1 + 4)
    expect(lines.slice(1).every((l) => l.split(',')[1] === 'Tool 501')).toBe(true)
  }, 20_000)

  it('advanced analytics count the 501st tool and name it', async () => {
    const advanced = await json(getAdvanced, DEV.big, 'stats/advanced')
    expect(advanced.latencyByTool).toEqual([{ toolId: expect.any(String), toolName: 'Tool 501', p50: 120, p95: 120, p99: 120, sampleSize: 4 }])
    expect(advanced.revenueTrend.reduce((s: number, d: { revenueCents: number }) => s + d.revenueCents, 0)).toBe(21)
    expect(advanced.cohortMetrics.totalConsumers).toBe(1)
  }, 20_000)

  it('consumer insights count the 501st tool', async () => {
    const insights = await json(getInsights, DEV.big, 'consumers/insights')
    expect(insights.topConsumers).toEqual([expect.objectContaining({ consumerId: C.big, email: 'big@example.com', totalSpendCents: 21, totalInvocations: 4 })])
  }, 20_000)
})

describe('consumer insights: filter, then limit (pglite)', () => {
  it('churning consumers are the top spenders among those who stopped', async () => {
    const insights = await json(getInsights, DEV.churn, 'consumers/insights')
    expect(insights.churningConsumers).toEqual([
      expect.objectContaining({ consumerId: C.stopped1, email: 'stopped-1@example.com', previousSpendCents: 100, previousInvocations: 2 }),
      expect.objectContaining({ consumerId: C.stopped2, email: 'stopped-2@example.com', previousSpendCents: 30, previousInvocations: 1 }),
    ])
  }, 20_000)

  it('at-risk consumers are found among all consumers, ranked by decline, over a strict 30% threshold', async () => {
    const insights = await json(getInsights, DEV.atRisk, 'consumers/insights')
    expect(insights.atRiskConsumers).toEqual([
      { consumerId: C.decliner, email: 'decliner@example.com', currentWeekInvocations: 0, previousWeekInvocations: 10, declinePct: 100 },
      { consumerId: C.faller, email: 'faller@example.com', currentWeekInvocations: 6, previousWeekInvocations: 10, declinePct: 40 },
    ])
  }, 30_000)
})

describe('advanced analytics: daily series (pglite)', () => {
  it('a 90-day period keeps all 91 UTC dates, today included', async () => {
    const advanced = await json(getAdvanced, DEV.daily, 'stats/advanced?period=90')
    for (const series of [advanced.revenueTrend, advanced.errorTrend, advanced.costEfficiency]) {
      expect(series).toHaveLength(91)
      expect(series[0].date).toBe('2026-08-17')
      expect(series.at(-1).date).toBe('2026-11-15')
    }
  }, 20_000)
})

describe('security checklist: no tool cap (pglite)', () => {
  it('counts the keys and balances on the 501st tool, and no other developer\'s', async () => {
    const items = async (developerId: string) => {
      const res = await json(getSecurityStatus, developerId, 'security-status')
      return (id: string) => (res.items as Array<{ id: string; completed: boolean; statusDetail: string }>).find((i) => i.id === id)
    }
    const big = await items(DEV.big)
    expect(big('key-rotation')).toMatchObject({ completed: false, statusDetail: '1 key older than 90 days' }) // not 2: OTHER's old key
    expect(big('ip-allowlist')).toMatchObject({ completed: true, statusDetail: 'Enabled — 1 key without IP restrictions' })
    expect(big('budget-controls')).toMatchObject({ completed: true, statusDetail: 'Active' })
    // TREND has tools but no keys or balances: OTHER's old key and spending limit don't count for it.
    const trend = await items(DEV.trend)
    expect(trend('key-rotation')).toMatchObject({ completed: true, statusDetail: 'All keys are recent' })
    expect(trend('budget-controls')).toMatchObject({ completed: false, statusDetail: 'Not started' })
    expect(trend('ip-allowlist')).toMatchObject({ completed: false, statusDetail: 'Not started' })
  }, 20_000)
})

describe('advanced analytics: cohort and period comparison (pglite)', () => {
  it('counts returning consumers over all consumers, not the top 20, and only on the developer\'s own tools', async () => {
    const advanced = await json(getAdvanced, DEV.cohort, 'stats/advanced?period=7')
    // 26 consumers this period: 25 also called last period; one called only OTHER's tool last
    // period, so for this developer it is new.
    expect(advanced.cohortMetrics).toMatchObject({
      totalConsumers: 26,
      returningConsumers: 25,
      newConsumers: 1,
      retentionRate: 89.29, // 25 of the previous period's 28
    })
    expect(advanced.topConsumers).toHaveLength(20)
  }, 20_000)

  it('a call at exactly the start of the period counts in the current period only', async () => {
    const advanced = await json(getAdvanced, DEV.edge, 'stats/advanced?period=7')
    expect(advanced.cohortMetrics).toMatchObject({ totalConsumers: 1, returningConsumers: 0, newConsumers: 1, retentionRate: 0 })
    expect(advanced.revenueTrend).toEqual([
      { date: '2026-11-08', revenueCents: 3, invocations: 1, previousRevenueCents: 0, previousInvocations: 0 },
    ])
  }, 20_000)

  it('compares each day with the same day one period earlier', async () => {
    const advanced = await json(getAdvanced, DEV.trend, 'stats/advanced?period=7')
    expect(advanced.revenueTrend).toEqual([
      { date: '2026-11-12', revenueCents: 30, invocations: 1, previousRevenueCents: 10, previousInvocations: 1 },
      { date: '2026-11-14', revenueCents: 40, invocations: 1, previousRevenueCents: 20, previousInvocations: 1 },
    ])
  }, 20_000)
})

describe('usage and fraud signals: UTC month and day whatever the server time zone (pglite)', () => {
  it('uses the UTC month and the UTC day on a server set to Los Angeles time', async () => {
    const saved = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      expect(new Date(NOW).getHours()).toBe(4) // the server clock now reads 04:30 on Nov 15
      const usage = await json(getUsage, DEV.utc, 'usage')
      expect(usage).toMatchObject({ periodStart: '2026-11-01T00:00:00.000Z', periodEnd: '2026-12-01T00:00:00.000Z', currentMonthOps: 2 })
      const fraud = await json(getFraudSignals, DEV.utc, 'fraud/signals')
      expect(fraud.summary.scannedToday).toBe(2) // the calls at 00:30 UTC today (16:30 yesterday in Los Angeles)
    } finally {
      if (saved === undefined) delete process.env.TZ
      else process.env.TZ = saved
    }
  }, 20_000)
})

describe('dashboard routes: UTC days and hours (pglite)', () => {
  it('advanced analytics and attribution use UTC whatever the session time zone', async () => {
    await pg.exec("SET TIME ZONE 'America/New_York'")
    try {
      const advanced = await json(getAdvanced, DEV.utc, 'stats/advanced')
      expect(advanced.revenueTrend.map((d: { date: string }) => d.date)).toEqual(['2026-11-15'])
      expect(advanced.errorTrend.map((d: { date: string }) => d.date)).toEqual(['2026-11-15'])
      expect(advanced.costEfficiency.map((d: { date: string }) => d.date)).toEqual(['2026-11-15'])
      expect(advanced.hourlyHeatmap).toEqual([{ dayOfWeek: 7, hour: 0, count: 2 }]) // Sunday, 00:00 UTC
      expect(advanced.topConsumers[0]).toMatchObject({ firstSeen: '2026-11-15', lastSeen: '2026-11-15' })
      const attribution = await json(getAttribution, DEV.utc, 'stats/attribution')
      expect(attribution.sessionPatterns).toEqual([{ date: '2026-11-15', uniqueSessions: 1, totalInvocations: 2 }])
    } finally {
      await pg.exec("SET TIME ZONE 'UTC'")
    }
  }, 30_000)
})
