/**
 * P5.K1 — admin GET /api/admin/kernel-health route handler tests.
 *
 * Coverage (matches hostile-review fixes F1/F2/F3 + spec §P5.K1):
 *   - 429 on rate-limit miss
 *   - 404 (NOT 401/403) when requireDeveloper rejects (auth surface
 *     hidden from non-admins)
 *   - 404 when authed but not in ADMIN_EMAILS
 *   - view=overview happy path: shape includes currentQps + perAdapter
 *     with errorRate (F2 — no division-by-zero; total=0 → 0)
 *   - view=adapter: histogram + recent errors (LIMIT clamp)
 *   - view=adapter: 400 INVALID_ID on missing/oversized/invalid id
 *   - view=rails: payoutStatus uses status IN ('completed','paid',
 *     'reconciled') (F1 regression-guard — was buggy 'success' filter)
 *   - view=invalid → 400 INVALID_VIEW
 *   - windowDays clamping: default 7, min 1, max 90, non-int → 7
 *   - 500 when underlying query throws
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockRequireDeveloper, mockCheckRateLimit, mockLogger } =
  vi.hoisted(() => ({
    mockDb: {
      execute: vi.fn(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    },
    mockRequireDeveloper: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  kernelTelemetry: {
    eventName: 'event_name',
    occurredAt: 'occurred_at',
    adapter: 'adapter',
    rail: 'rail',
    devId: 'dev_id',
    props: 'props',
  },
}))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

import { GET } from '@/app/api/admin/kernel-health/route'

const ADMIN_EMAIL = 'lexwhiting365@gmail.com'

function makeRequest(query: string = ''): NextRequest {
  const url = `http://localhost:3005/api/admin/kernel-health${query}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
}

beforeEach(() => {
  mockCheckRateLimit.mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: 0,
  })
  mockRequireDeveloper.mockResolvedValue({ id: 'dev-1', email: ADMIN_EMAIL })
  // Default: empty result for any execute() call. Specific tests
  // override with mockResolvedValueOnce in the order the route makes
  // its queries.
  mockDb.execute.mockResolvedValue([])
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.orderBy.mockReturnThis()
  mockDb.limit.mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/kernel-health — auth + rate-limit gates', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMITED')
    // Rate-limit short-circuits before any auth or query work.
    expect(mockRequireDeveloper).not.toHaveBeenCalled()
    expect(mockDb.execute).not.toHaveBeenCalled()
  })

  it('returns 404 (NOT 401) when requireDeveloper rejects (hide admin surface)', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('not authenticated'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
    expect(mockDb.execute).not.toHaveBeenCalled()
  })

  it('returns 404 when authed user is not in ADMIN_EMAILS', async () => {
    mockRequireDeveloper.mockResolvedValueOnce({
      id: 'dev-99',
      email: 'random@example.com',
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.code).toBe('NOT_FOUND')
    expect(mockDb.execute).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/kernel-health — windowDays clamping', () => {
  it('defaults to 7 days when windowDays is not provided', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.windowDays).toBe(7)
  })

  it('clamps to 90 when windowDays > 90', async () => {
    const res = await GET(makeRequest('?windowDays=999'))
    const body = await res.json()
    expect(body.windowDays).toBe(90)
  })

  it('clamps to 7 when windowDays < 1 (negative or zero)', async () => {
    const res = await GET(makeRequest('?windowDays=-3'))
    const body = await res.json()
    expect(body.windowDays).toBe(7)
  })

  it('clamps to 7 when windowDays is non-integer', async () => {
    const res = await GET(makeRequest('?windowDays=3.7'))
    const body = await res.json()
    expect(body.windowDays).toBe(7)
  })

  it('clamps to 7 when windowDays is non-numeric', async () => {
    const res = await GET(makeRequest('?windowDays=banana'))
    const body = await res.json()
    expect(body.windowDays).toBe(7)
  })

  it('respects in-range integer windowDays', async () => {
    const res = await GET(makeRequest('?windowDays=14'))
    const body = await res.json()
    expect(body.windowDays).toBe(14)
  })
})

describe('GET /api/admin/kernel-health — view=overview', () => {
  it('returns overview shape with currentQps + perAdapter aggregates', async () => {
    // Order of execute calls in loadOverview:
    //   1. per-adapter latency aggregate
    //   2. total events count
    //   3. current QPS (last-60s count)
    mockDb.execute
      .mockResolvedValueOnce([
        {
          adapter: 'sg-balance',
          total: '120',
          successes: '110',
          errors: '10',
          p50: '180',
          p95: '450',
          p99: '900',
        },
        {
          adapter: 'facilitator-protocol',
          total: '40',
          successes: '40',
          errors: '0',
          p50: '50',
          p95: '110',
          p99: '210',
        },
      ])
      .mockResolvedValueOnce([{ total: '160' }])
      .mockResolvedValueOnce([{ recent: '30' }])

    const res = await GET(makeRequest('?view=overview'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.view).toBe('overview')
    expect(body.totalEvents).toBe(160)
    expect(body.currentQps).toBe(0.5) // 30 / 60
    expect(body.perAdapter).toHaveLength(2)
    const sgb = body.perAdapter.find(
      (r: { adapter: string }) => r.adapter === 'sg-balance',
    )
    expect(sgb).toMatchObject({
      total: 120,
      successes: 110,
      errors: 10,
      // F2: errorRate is errors / total when total > 0.
      errorRate: 10 / 120,
      p50: 180,
      p95: 450,
      p99: 900,
    })
  })

  it('errorRate is 0 (NOT NaN) when adapter total is 0 (F2 div-by-zero guard)', async () => {
    mockDb.execute
      .mockResolvedValueOnce([
        {
          adapter: 'sg-balance',
          total: '0',
          successes: '0',
          errors: '0',
          p50: '0',
          p95: '0',
          p99: '0',
        },
      ])
      .mockResolvedValueOnce([{ total: '0' }])
      .mockResolvedValueOnce([{ recent: '0' }])

    const res = await GET(makeRequest('?view=overview'))
    const body = await res.json()
    expect(body.perAdapter[0].errorRate).toBe(0)
    expect(Number.isNaN(body.perAdapter[0].errorRate)).toBe(false)
  })

  it('returns currentQps=0 when no latency events in last 60s', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: '0' }])
      .mockResolvedValueOnce([])
    const res = await GET(makeRequest('?view=overview'))
    const body = await res.json()
    expect(body.currentQps).toBe(0)
    expect(body.perAdapter).toEqual([])
  })

  it('treats no view= param as view=overview by default', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: '0' }])
      .mockResolvedValueOnce([])
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.view).toBe('overview')
  })
})

describe('GET /api/admin/kernel-health — view=adapter', () => {
  it('returns adapter drill with summary + histogram + recentErrors', async () => {
    // Order of execute calls in loadAdapter:
    //   1. summary aggregate
    //   2. latency histogram
    mockDb.execute
      .mockResolvedValueOnce([
        {
          total: '50',
          successes: '48',
          errors: '2',
          p50: '120',
          p95: '300',
          p99: '600',
        },
      ])
      .mockResolvedValueOnce([
        { bucket_ms: '50', count: '10' },
        { bucket_ms: '100', count: '20' },
        { bucket_ms: '5000', count: '1' },
      ])
    // Recent errors via Drizzle builder.
    mockDb.limit.mockResolvedValueOnce([
      {
        occurredAt: new Date('2026-05-07T12:00:00.000Z'),
        props: {
          error_class: 'BalanceError',
          error_message: 'insufficient funds',
        },
      },
    ])

    const res = await GET(makeRequest('?view=adapter&id=sg-balance'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.view).toBe('adapter')
    expect(body.adapter).toBe('sg-balance')
    expect(body.total).toBe(50)
    expect(body.successes).toBe(48)
    expect(body.errors).toBe(2)
    expect(body.p50).toBe(120)
    expect(body.p95).toBe(300)
    expect(body.p99).toBe(600)
    expect(body.latencyHistogram).toEqual([
      { bucketMs: 50, count: 10 },
      { bucketMs: 100, count: 20 },
      { bucketMs: 5000, count: 1 },
    ])
    expect(body.recentErrors).toEqual([
      {
        occurredAt: '2026-05-07T12:00:00.000Z',
        errorClass: 'BalanceError',
        errorMessage: 'insufficient funds',
      },
    ])
  })

  it('coalesces missing summary row to zeros (no NaN leakage)', async () => {
    // execute returns [] for the summary query; route falls back to
    // the synthetic zero row.
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockDb.limit.mockResolvedValueOnce([])
    const res = await GET(makeRequest('?view=adapter&id=sg-balance'))
    const body = await res.json()
    expect(body.total).toBe(0)
    expect(body.p50).toBe(0)
    expect(body.recentErrors).toEqual([])
  })

  it('LIMITs recent errors to 500 (dashboard OOM guard)', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockDb.limit.mockResolvedValueOnce([])
    await GET(makeRequest('?view=adapter&id=sg-balance'))
    expect(mockDb.limit).toHaveBeenCalledWith(500)
  })

  it('falls back to null when error props lack error_class / error_message', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockDb.limit.mockResolvedValueOnce([
      {
        occurredAt: new Date('2026-05-07T00:00:00.000Z'),
        props: { adapter: 'sg-balance' }, // no error_* fields
      },
    ])
    const res = await GET(makeRequest('?view=adapter&id=sg-balance'))
    const body = await res.json()
    expect(body.recentErrors[0]).toMatchObject({
      errorClass: null,
      errorMessage: null,
    })
  })

  it('returns 400 INVALID_ID when adapter id is missing', async () => {
    const res = await GET(makeRequest('?view=adapter'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_ID')
    expect(mockDb.execute).not.toHaveBeenCalled()
  })

  it('returns 400 INVALID_ID when adapter id violates enum-shape regex', async () => {
    const res = await GET(makeRequest('?view=adapter&id=has%20space'))
    expect(res.status).toBe(400)
  })

  it('returns 400 INVALID_ID when adapter id exceeds 64 chars', async () => {
    const long = 'a'.repeat(65)
    const res = await GET(makeRequest(`?view=adapter&id=${long}`))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/admin/kernel-health — view=rails (F1 status enum guard)', () => {
  it('returns rails shape including payoutStatus with mode + cron + schedule fields', async () => {
    // Order of execute calls in loadRails:
    //   1. perRail aggregate
    //   2. pending count + amount
    //   3. last success row
    //   4. failed-24h count
    mockDb.execute
      .mockResolvedValueOnce([
        {
          rail: 'stripe-acss',
          settled_count: '40',
          amount_cents_total: '4000',
          take_cents_total: '40',
        },
        {
          rail: 'usdc',
          settled_count: '20',
          amount_cents_total: '2000',
          take_cents_total: '20',
        },
      ])
      .mockResolvedValueOnce([
        { pending_count: '3', pending_amount_cents: '1234' },
      ])
      .mockResolvedValueOnce([
        {
          created_at: new Date('2026-05-06T12:00:00.000Z'),
          amount_cents: 9999,
        },
      ])
      .mockResolvedValueOnce([{ failed_count: '1' }])

    const res = await GET(makeRequest('?view=rails'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.view).toBe('rails')
    expect(body.perRail).toHaveLength(2)
    expect(body.perRail[0]).toEqual({
      rail: 'stripe-acss',
      settledCount: 40,
      amountCentsTotal: 4000,
      takeCentsTotal: 40,
    })
    expect(body.payoutStatus).toMatchObject({
      mode: 'manual',
      cronSchedule: '0 12 * * *',
      lastSuccess: {
        occurredAt: '2026-05-06T12:00:00.000Z',
        amountCents: 9999,
      },
      pending: { count: 3, amountCentsTotal: 1234 },
      failed24h: 1,
    })
    // nextCronRun is a future ISO timestamp at 12:00 UTC.
    const next = new Date(body.payoutStatus.nextCronRun)
    expect(next.getUTCHours()).toBe(12)
    expect(next.getTime()).toBeGreaterThan(Date.now())
  })

  /**
   * F1 regression guard. The hostile review found the original code
   * filtered `payouts.status = 'success'`, but production writers
   * never use that enum value — they use 'completed' (CAS-completed
   * Stripe transfer), 'paid', and 'reconciled'. A future refactor that
   * accidentally narrows this list back to 'success' would silently
   * make `lastSuccess` always null. This test asserts the SQL emitted
   * for the last-success query mentions all three current values.
   */
  it("uses status IN ('completed','paid','reconciled') for last-success query (F1)", async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ pending_count: '0', pending_amount_cents: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ failed_count: '0' }])
    await GET(makeRequest('?view=rails'))
    // The 3rd execute call is the lastSuccess query. Inspect the
    // tagged-template strings to verify all three success enums appear.
    const lastSuccessCall = mockDb.execute.mock.calls[2]
    expect(lastSuccessCall).toBeDefined()
    const tag = lastSuccessCall![0] as { queryChunks?: unknown[] }
    const serialized = JSON.stringify(tag)
    expect(serialized).toContain('completed')
    expect(serialized).toContain('paid')
    expect(serialized).toContain('reconciled')
    // And explicitly NOT the buggy 'success' string the previous
    // implementation used.
    expect(serialized).not.toContain("'success'")
  })

  it("uses status='failed' AND 24h window for the failed-24h query", async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ pending_count: '0', pending_amount_cents: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ failed_count: '0' }])
    await GET(makeRequest('?view=rails'))
    const failedCall = mockDb.execute.mock.calls[3]
    const tag = failedCall![0]
    const serialized = JSON.stringify(tag)
    expect(serialized).toContain('failed')
    expect(serialized).toContain('24 hours')
  })

  it('returns lastSuccess.occurredAt=null when no rows match the success filter', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ pending_count: '0', pending_amount_cents: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ failed_count: '0' }])
    const res = await GET(makeRequest('?view=rails'))
    const body = await res.json()
    expect(body.payoutStatus.lastSuccess).toEqual({
      occurredAt: null,
      amountCents: 0,
    })
  })

  it('coalesces missing pending row to zeros', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    const res = await GET(makeRequest('?view=rails'))
    const body = await res.json()
    expect(body.payoutStatus.pending).toEqual({
      count: 0,
      amountCentsTotal: 0,
    })
    expect(body.payoutStatus.failed24h).toBe(0)
  })

  it('handles created_at returned as a string (driver variation)', async () => {
    mockDb.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { created_at: '2026-05-05T08:00:00.000Z', amount_cents: 5000 },
      ])
      .mockResolvedValueOnce([])
    const res = await GET(makeRequest('?view=rails'))
    const body = await res.json()
    expect(body.payoutStatus.lastSuccess.occurredAt).toBe(
      '2026-05-05T08:00:00.000Z',
    )
    expect(body.payoutStatus.lastSuccess.amountCents).toBe(5000)
  })
})

describe('GET /api/admin/kernel-health — invalid view + error path', () => {
  it('returns 400 INVALID_VIEW for unknown view value', async () => {
    const res = await GET(makeRequest('?view=garbage'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_VIEW')
    expect(mockDb.execute).not.toHaveBeenCalled()
  })

  it('returns 500 when overview query throws (logged via logger.error)', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const res = await GET(makeRequest('?view=overview'))
    expect(res.status).toBe(500)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'admin_kernel_health.query_failed',
      expect.objectContaining({
        view: 'overview',
        error: 'ECONNREFUSED',
      }),
    )
  })

  it('returns 500 when adapter query throws', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('query timeout'))
    const res = await GET(makeRequest('?view=adapter&id=sg-balance'))
    expect(res.status).toBe(500)
  })

  it('returns 500 when rails query throws', async () => {
    mockDb.execute.mockRejectedValueOnce(new Error('rails query died'))
    const res = await GET(makeRequest('?view=rails'))
    expect(res.status).toBe(500)
  })
})
