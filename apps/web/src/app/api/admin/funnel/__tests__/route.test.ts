/**
 * P5.1 — admin /api/admin/funnel route handler tests.
 *
 * Coverage:
 *   - 429 on rate-limit miss
 *   - 401 when requireDeveloper rejects
 *   - 403 when authed but email not in ADMIN_EMAILS
 *   - 200 with data:null + reason:'not_configured' when runFunnelQueries
 *     returns null (env vars unset)
 *   - 200 with data:null + reason:'upstream_error' when runFunnelQueries
 *     throws (PostHog reachable but query failed)
 *   - 200 with full data shape when runFunnelQueries succeeds
 *
 * The route delegates to `runFunnelQueries` from `@/lib/funnel-queries`;
 * we mock that boundary directly so the route logic (auth + rate limit +
 * empty-state branching) is what gets exercised, not the HogQL plumbing.
 * The HogQL side is covered separately by funnel-queries.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockRequireDeveloper,
  mockCheckRateLimit,
  mockRunFunnelQueries,
  mockLogger,
} = vi.hoisted(() => ({
  mockRequireDeveloper: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockRunFunnelQueries: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))
vi.mock('@/lib/funnel-queries', () => ({
  runFunnelQueries: mockRunFunnelQueries,
}))

import { GET } from '@/app/api/admin/funnel/route'

const ADMIN_EMAIL = 'lexwhiting365@gmail.com'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3005/api/admin/funnel', {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
}

beforeEach(() => {
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockRequireDeveloper.mockResolvedValue({ id: 'dev-1', email: ADMIN_EMAIL })
  mockRunFunnelQueries.mockResolvedValue(null)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/funnel — auth + rate-limit gates', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 100, remaining: 0, reset: 0 })
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
    // Rate limiter should short-circuit before requireDeveloper runs.
    expect(mockRequireDeveloper).not.toHaveBeenCalled()
  })

  it('returns 401 when requireDeveloper rejects', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('Authentication required'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
    // Auth failure should short-circuit before runFunnelQueries.
    expect(mockRunFunnelQueries).not.toHaveBeenCalled()
  })

  it('returns 403 when authed but email is not in ADMIN_EMAILS', async () => {
    mockRequireDeveloper.mockResolvedValueOnce({ id: 'dev-99', email: 'random@example.com' })
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('FORBIDDEN')
    expect(mockRunFunnelQueries).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/funnel — empty / error states', () => {
  it("returns 200 with data:null + reason:'not_configured' when runFunnelQueries returns null", async () => {
    mockRunFunnelQueries.mockResolvedValueOnce(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeNull()
    expect(body.reason).toBe('not_configured')
    expect(typeof body.generatedAt).toBe('string')
    // Critical: we still log the access for audit trail.
    expect(mockLogger.info).toHaveBeenCalledWith(
      'admin.funnel_accessed',
      expect.objectContaining({ email: ADMIN_EMAIL, hasData: false }),
    )
  })

  it("returns 200 with data:null + reason:'upstream_error' when runFunnelQueries throws", async () => {
    mockRunFunnelQueries.mockRejectedValueOnce(new Error('PostHog HogQL 500: query failed'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeNull()
    expect(body.reason).toBe('upstream_error')
    // Upstream failure logged so Sentry alerts can fire.
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'admin.funnel.upstream_failed',
      expect.objectContaining({ error: expect.stringContaining('PostHog HogQL 500') }),
    )
  })
})

describe('GET /api/admin/funnel — happy path', () => {
  it('returns 200 with full FunnelData shape when runFunnelQueries succeeds', async () => {
    const fakeData = {
      generatedAt: '2026-05-07T00:00:00.000Z',
      windowDays: 30,
      events: {
        gallery_viewed: { total: 100, unique: 80 },
        template_detail_viewed: { total: 60, unique: 50 },
        shadow_directory_viewed: { total: 0, unique: 0 },
        cli_install_started: { total: 30, unique: 25 },
        scaffold_success: { total: 20, unique: 18 },
        scaffold_failed: { total: 5, unique: 4 },
        sdk_first_init: { total: 15, unique: 12 },
        first_billed_call: { total: 8, unique: 7 },
      },
      daily: [
        { day: '2026-05-01', event: 'gallery_viewed', count: 12 },
        { day: '2026-05-02', event: 'gallery_viewed', count: 18 },
      ],
      dailyStats: {
        gallery_viewed: {
          total: 100,
          activeDays: 14,
          minNonZero: 1,
          median: 6,
          max: 24,
          peakDay: '2026-05-04',
          spikeRatio: 4,
        },
      },
      hourClusters: [{ hourUtc: 14, count: 42 }],
      conversions: [
        {
          fromStage: 'gallery_viewed',
          toStage: 'template_detail_viewed',
          fromUniques: 80,
          toUniques: 50,
          rate: 0.625,
          medianMinutesToConvert: 0.4,
        },
      ],
      topTemplates: [{ slug: 'classifier', successes: 12 }],
      topErrors: [{ code: 'ERR_NPM_INSTALL', failures: 3 }],
      geoBreakdown: [{ country: 'US', events: 70 }],
    }
    mockRunFunnelQueries.mockResolvedValueOnce(fakeData)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(fakeData)
    expect(body.reason).toBeUndefined()
    expect(typeof body.generatedAt).toBe('string')
    expect(mockLogger.info).toHaveBeenCalledWith(
      'admin.funnel_accessed',
      expect.objectContaining({ email: ADMIN_EMAIL, hasData: true }),
    )
  })

  it('passes days:30 to runFunnelQueries (matches spec D1 — 30-day window)', async () => {
    await GET(makeRequest())
    expect(mockRunFunnelQueries).toHaveBeenCalledWith({ days: 30 })
  })
})
