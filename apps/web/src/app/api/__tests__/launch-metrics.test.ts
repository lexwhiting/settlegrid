/**
 * P4.7 — launch-metrics route + pure helpers.
 *
 * Coverage:
 *   - parseHnRankFromHtml: pure parser, 5 cases
 *   - parsePostHogFunnelRow: pure mapper, 4 cases
 *   - GET handler: rate-limited (429), unauth (401), non-admin (403),
 *     authed-admin with all envs unset (200, all-null payload),
 *     authed-admin with mocked HN/Stripe/PostHog/Sentry fetches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted so mocks reference the same instances vi.mock receives.
const {
  mockDb,
  mockRequireDeveloper,
  mockCheckRateLimit,
  mockLogger,
} = vi.hoisted(() => ({
  mockDb: {
    execute: vi.fn(),
    select: vi.fn(),
    from: vi.fn(),
    limit: vi.fn(),
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
vi.mock('@/lib/db/schema', () => ({ invocations: { id: 'id' } }))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: mockRequireDeveloper }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))
vi.mock('drizzle-orm', () => ({
  sql: vi.fn().mockImplementation((strings: unknown, ...values: unknown[]) => ({
    sql: strings,
    values,
  })),
}))

import { GET } from '../admin/launch-metrics/route'
import {
  parseHnRankFromHtml,
  parsePostHogFunnelRow,
} from '../admin/launch-metrics/helpers'

const ADMIN_EMAIL = 'lexwhiting365@gmail.com'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3005/api/admin/launch-metrics', {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
  })
}

const ENV_KEYS = [
  'POSTHOG_PERSONAL_API_KEY',
  'POSTHOG_PROJECT_ID',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'STRIPE_SECRET_KEY',
  'LAUNCH_HN_ITEM_ID',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
] as const
let envSnapshot: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}

beforeEach(() => {
  // Snapshot + clear every env var the route reads.
  envSnapshot = {}
  for (const k of ENV_KEYS) {
    envSnapshot[k] = process.env[k]
    delete process.env[k]
  }
  // Default mocks: rate limit pass + admin auth.
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockRequireDeveloper.mockResolvedValue({ id: 'dev-1', email: ADMIN_EMAIL })
  // Default DB execute for the SELECT 1 fallback (latency probe).
  mockDb.execute.mockResolvedValue([{ p50: 5, p95: 12 }])
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = envSnapshot[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('parseHnRankFromHtml', () => {
  it('returns 1-based rank when item is present at top', () => {
    const html = `
      <tr class="athing submission" id="100"></tr>
      <tr class="athing submission" id="200"></tr>
      <tr class="athing submission" id="300"></tr>
    `
    expect(parseHnRankFromHtml(html, 100)).toBe(1)
    expect(parseHnRankFromHtml(html, 200)).toBe(2)
    expect(parseHnRankFromHtml(html, 300)).toBe(3)
  })
  it('returns null when item is not on the page', () => {
    const html = `<tr class="athing submission" id="100"></tr>`
    expect(parseHnRankFromHtml(html, 999)).toBeNull()
  })
  it('returns null on empty HTML', () => {
    expect(parseHnRankFromHtml('', 100)).toBeNull()
  })
  it('ignores tr rows that are not athing', () => {
    // HN markup intersperses non-athing tr rows (subtitle, spacer);
    // those must NOT be counted in the rank denominator.
    const html = `
      <tr class="spacer"></tr>
      <tr class="athing submission" id="100"></tr>
      <tr class="subtext"></tr>
      <tr class="athing submission" id="200"></tr>
    `
    expect(parseHnRankFromHtml(html, 100)).toBe(1)
    expect(parseHnRankFromHtml(html, 200)).toBe(2)
  })
  it('handles attributes on the tr beyond class+id', () => {
    const html =
      '<tr data-foo="bar" class="athing submission" data-x="1" id="42">'
    expect(parseHnRankFromHtml(html, 42)).toBe(1)
  })
})

describe('parsePostHogFunnelRow', () => {
  it('maps a 9-element row to the typed funnel object', () => {
    const out = parsePostHogFunnelRow([10, 20, 30, 40, 50, 60, 70, 80, 90])
    expect(out).toEqual({
      galleryViewedLast15m: 10,
      galleryViewedLast1h: 20,
      galleryViewedLast24h: 30,
      templateDetailLast24h: 40,
      scaffoldSuccessLast24h: 50,
      scaffoldFailedLast24h: 60,
      cliInstallStartedLast15m: 70,
      cliInstallStartedLast1h: 80,
      cliInstallStartedLast24h: 90,
    })
  })
  it('returns null for a row that is too short', () => {
    expect(parsePostHogFunnelRow([1, 2, 3])).toBeNull()
  })
  it('returns null for a non-array', () => {
    expect(parsePostHogFunnelRow(null)).toBeNull()
    expect(parsePostHogFunnelRow(undefined)).toBeNull()
    expect(parsePostHogFunnelRow({ x: 1 })).toBeNull()
  })
  it('coerces nullish cell values to 0 (HogQL can return null on no rows)', () => {
    const out = parsePostHogFunnelRow([null, undefined, 0, 0, 0, 0, 0, 0, 0])
    expect(out).not.toBeNull()
    expect(out!.galleryViewedLast15m).toBe(0)
    expect(out!.galleryViewedLast1h).toBe(0)
  })
})

describe('GET /api/admin/launch-metrics — auth gates', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
  })
  it('returns 401 when requireDeveloper throws', async () => {
    mockRequireDeveloper.mockRejectedValueOnce(new Error('not authenticated'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })
  it('returns 403 when authed user is not in ADMIN_EMAILS', async () => {
    mockRequireDeveloper.mockResolvedValueOnce({
      id: 'dev-2',
      email: 'someone-else@example.com',
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/launch-metrics — graceful degradation', () => {
  it('returns 200 with all upstream null when env vars are unset', async () => {
    // Stub fetch to error on any call so HN's no-LAUNCH_HN_ITEM_ID
    // path isn't masked by a rogue passing fetch.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch should not be called when env unset')
      }),
    )
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posthog).toBeNull()
    expect(body.cliInstalls).toBeNull()
    expect(body.scaffolds).toBeNull()
    expect(body.stripeConnections).toBeNull()
    expect(body.hn).toBeNull()
    expect(body.sentryErrorsLastHour).toBeNull()
    // DB latency probe ran via mocked db.execute and returned a sample.
    // Either the pg_stat_statements branch (5,12) or fallback works.
    expect(body.dbLatency.p50Ms).not.toBeNull()
  })

  it('falls back to roundtrip probe when pg_stat_statements is missing', async () => {
    // First execute() throws (extension missing); second succeeds (SELECT 1).
    mockDb.execute
      .mockRejectedValueOnce(new Error('relation "pg_stat_statements" does not exist'))
      .mockResolvedValueOnce(undefined)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Both should be the same value (single sample).
    expect(body.dbLatency.p50Ms).toBe(body.dbLatency.p95Ms)
    expect(typeof body.dbLatency.p50Ms).toBe('number')
  })

  it('returns dbLatency null/null when both DB probes fail', async () => {
    mockDb.execute.mockRejectedValue(new Error('connection refused'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dbLatency).toEqual({ p50Ms: null, p95Ms: null })
  })
})

describe('GET /api/admin/launch-metrics — happy-path payload assembly', () => {
  it('shapes Stripe connections with truncated=false on partial page', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('https://api.stripe.com/')) {
          return new Response(
            JSON.stringify({
              data: [
                { details_submitted: true, charges_enabled: true },
                { details_submitted: true, charges_enabled: true },
                { details_submitted: false, charges_enabled: false },
              ],
              has_more: false,
            }),
            { status: 200 },
          )
        }
        return new Response('{}', { status: 500 })
      }),
    )
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stripeConnections).toEqual({ count: 2, truncated: false })
  })

  it('marks Stripe connections truncated=true when has_more is set', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('https://api.stripe.com/')) {
          return new Response(
            JSON.stringify({
              data: Array.from({ length: 100 }, () => ({
                details_submitted: true,
                charges_enabled: true,
              })),
              has_more: true,
            }),
            { status: 200 },
          )
        }
        return new Response('{}', { status: 500 })
      }),
    )
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stripeConnections).toEqual({ count: 100, truncated: true })
  })

  it('parses HN item details + rank when LAUNCH_HN_ITEM_ID is set', async () => {
    process.env.LAUNCH_HN_ITEM_ID = '12345'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('hacker-news.firebaseio.com')) {
          return new Response(
            JSON.stringify({
              title: 'Show HN: SettleGrid',
              score: 87,
              descendants: 23,
            }),
            { status: 200 },
          )
        }
        if (url === 'https://news.ycombinator.com/news') {
          return new Response(
            `<tr class="athing submission" id="999"></tr>
             <tr class="athing submission" id="12345"></tr>
             <tr class="athing submission" id="111"></tr>`,
            { status: 200 },
          )
        }
        return new Response('{}', { status: 500 })
      }),
    )
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hn).toMatchObject({
      itemId: 12345,
      url: 'https://news.ycombinator.com/item?id=12345',
      title: 'Show HN: SettleGrid',
      points: 87,
      descendants: 23,
      rank: 2,
    })
  })

  it('returns hn=null when LAUNCH_HN_ITEM_ID is malformed', async () => {
    process.env.LAUNCH_HN_ITEM_ID = 'not-a-number'
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hn).toBeNull()
  })

  it('flags HN posts that were deleted/dead (points=0, rank=null)', async () => {
    process.env.LAUNCH_HN_ITEM_ID = '12345'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('hacker-news.firebaseio.com')) {
          return new Response(
            JSON.stringify({
              title: 'Show HN: SettleGrid',
              dead: true,
              descendants: 5,
            }),
            { status: 200 },
          )
        }
        return new Response('{}', { status: 500 })
      }),
    )
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.hn?.points).toBe(0)
    expect(body.hn?.rank).toBeNull()
  })

  it('parses PostHog funnel + maps cliInstalls + scaffolds', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phc_test'
    process.env.POSTHOG_PROJECT_ID = '12345'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/projects/')) {
          return new Response(
            JSON.stringify({
              results: [[5, 30, 200, 80, 18, 2, 1, 6, 24]],
            }),
            { status: 200 },
          )
        }
        return new Response('{}', { status: 500 })
      }),
    )
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.posthog).toMatchObject({
      galleryViewedLast15m: 5,
      galleryViewedLast24h: 200,
      cliInstallStartedLast15m: 1,
      cliInstallStartedLast1h: 6,
      cliInstallStartedLast24h: 24,
    })
    expect(body.cliInstalls).toEqual({ last15m: 1, last1h: 6, last24h: 24 })
    expect(body.scaffolds).toEqual({
      successLast24h: 18,
      failedLast24h: 2,
      successRate: 0.9,
    })
  })

  it('scaffolds.successRate is null when no scaffolds happened in 24h', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phc_test'
    process.env.POSTHOG_PROJECT_ID = '12345'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ results: [[0, 0, 0, 0, 0, 0, 0, 0, 0]] }),
          { status: 200 },
        )
      }),
    )
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.scaffolds?.successRate).toBeNull()
  })

  it('returns 200 with one null source when its fetch throws (graceful per-source failure)', async () => {
    // PostHog configured, fetch throws. Other sources unconfigured →
    // null. Route must still return 200 with posthog: null and the
    // logger.warn must record the failure.
    process.env.POSTHOG_PERSONAL_API_KEY = 'phc_test'
    process.env.POSTHOG_PROJECT_ID = '12345'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNRESET — PostHog down')
      }),
    )
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posthog).toBeNull()
    // Logger.warn should have been called for the PostHog failure.
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'admin.launch_metrics.posthog_failed',
      expect.objectContaining({ error: expect.stringContaining('ECONNRESET') }),
    )
  })

  it('counts Sentry events when fully configured', async () => {
    process.env.SENTRY_AUTH_TOKEN = 'token'
    process.env.SENTRY_ORG = 'sg'
    process.env.SENTRY_PROJECT = 'web'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('https://sentry.io/')) {
          return new Response(
            JSON.stringify({
              data: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
            }),
            { status: 200 },
          )
        }
        return new Response('{}', { status: 500 })
      }),
    )
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.sentryErrorsLastHour).toBe(3)
  })
})
