/**
 * P4.1 — /api/telemetry/capture proxy tests.
 *
 * Wire-shape integration coverage (the lesson from the Phase 3
 * Python SDK meter bug — every cross-module seam must capture the
 * actual outbound request body and assert key-set against the
 * receiving contract). Here the receiver is PostHog's `/i/v0/e/`
 * capture endpoint — the test mocks `globalThis.fetch` and asserts
 * the proxy posts `{ api_key, event, distinct_id, properties,
 * timestamp }` with the server-enriched fields stamped in.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCheckRateLimit } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn().mockResolvedValue({
    success: true,
    limit: 60,
    remaining: 59,
    reset: 0,
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: vi.fn(() => ({})),
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Save originals so each test starts with a clean fetch + env state.
const originalFetch = globalThis.fetch
const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    POSTHOG_API_KEY: 'phc_test_key',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://posthog.test',
  }
  mockCheckRateLimit.mockResolvedValue({
    success: true,
    limit: 60,
    remaining: 59,
    reset: 0,
  })
})

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env = { ...ORIGINAL_ENV }
  vi.resetAllMocks()
})

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest('http://localhost/api/telemetry/capture', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/telemetry/capture — wire-shape', () => {
  it('forwards a canonical event with the documented PostHog body shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('../route')
    const res = await POST(
      makeRequest(
        {
          event: 'scaffold_success',
          properties: { template_slug: 'neon-mcp', duration_ms: 1234 },
          distinct_id: 'cli-uuid-abc',
        },
        {
          'x-forwarded-for': '203.0.113.42',
          'x-vercel-ip-country': 'US',
        },
      ),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, forwarded: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://posthog.test/i/v0/e/')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).redirect).toBe('error')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(Object.keys(body).sort()).toEqual([
      'api_key',
      'distinct_id',
      'event',
      'properties',
      'timestamp',
    ])
    expect(body.api_key).toBe('phc_test_key')
    expect(body.event).toBe('scaffold_success')
    expect(body.distinct_id).toBe('cli-uuid-abc')
    expect(body.properties.template_slug).toBe('neon-mcp')
    expect(body.properties.duration_ms).toBe(1234)
    expect(body.properties.ip_country).toBe('US')
    // ISO-8601 millisecond-precision UTC, both server-stamped fields.
    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    expect(body.properties.received_at).toMatch(ISO_RE)
    expect(body.timestamp).toMatch(ISO_RE)
  })

  it('overwrites client-supplied ip_country and received_at', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { POST } = await import('../route')
    await POST(
      makeRequest(
        {
          event: 'gallery_viewed',
          properties: {
            ip_country: 'ZZ',
            received_at: '1970-01-01T00:00:00.000Z',
          },
          distinct_id: 'd-1',
        },
        { 'x-vercel-ip-country': 'GB' },
      ),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.properties.ip_country).toBe('GB')
    expect(body.properties.received_at).not.toBe('1970-01-01T00:00:00.000Z')
  })

  it('falls back ip_country to XX when header absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'd-1',
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.properties.ip_country).toBe('XX')
  })
})

describe('POST /api/telemetry/capture — validation', () => {
  it('rejects unknown event names with 400', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({
        event: 'malicious_event',
        properties: {},
        distinct_id: 'd-1',
      }),
    )
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.code).toBe('INVALID_PAYLOAD')
    // No info leak: response must NOT echo the event name or distinct_id.
    expect(JSON.stringify(body)).not.toContain('malicious_event')
    expect(JSON.stringify(body)).not.toContain('d-1')
  })

  it('rejects empty distinct_id with 400', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: '',
      }),
    )
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects oversized distinct_id (>256 chars) with 400', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'x'.repeat(257),
      }),
    )
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects oversized properties payload (>4KB) with 413', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    const blob = 'a'.repeat(5000)
    const res = await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: { huge: blob },
        distinct_id: 'd-1',
      }),
    )
    expect(res.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('rejects malformed JSON with 400', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    const res = await POST(
      makeRequest('not json {{{', {}),
    )
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.code).toBe('INVALID_BODY')
  })
})

describe('POST /api/telemetry/capture — body size guard (H1)', () => {
  it('rejects with 413 when Content-Length exceeds 8KB', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    // Don't actually allocate 9KB — just lie about Content-Length.
    // The route must reject BEFORE calling request.json().
    const req = new NextRequest('http://localhost/api/telemetry/capture', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(9 * 1024),
      },
      body: JSON.stringify({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'd-1',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.code).toBe('PAYLOAD_TOO_LARGE')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts valid bodies with Content-Length under 8KB', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    // Default makeRequest sets a small body — well under 8KB.
    const res = await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'd-1',
      }),
    )
    expect(res.status).toBe(200)
  })
})

describe('POST /api/telemetry/capture — rate limiting', () => {
  it('returns 429 without forwarding when rate-limited', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 30_000,
    })
    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'd-1',
      }),
    )
    expect(res.status).toBe(429)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses first-hop IP from x-forwarded-for as the limiter key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    await POST(
      makeRequest(
        {
          event: 'gallery_viewed',
          properties: {},
          distinct_id: 'd-1',
        },
        { 'x-forwarded-for': '198.51.100.1, 10.0.0.1, 10.0.0.2' },
      ),
    )
    // The middle / last hops must NOT be in the rate-limit key — only [0].
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'telemetry:198.51.100.1',
    )
  })
})

describe('POST /api/telemetry/capture — telemetry disabled', () => {
  it('returns 200 with forwarded:false when no PostHog key configured', async () => {
    delete process.env.POSTHOG_API_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'd-1',
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      forwarded: false,
      reason: 'telemetry_disabled',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to NEXT_PUBLIC_POSTHOG_KEY when POSTHOG_API_KEY unset', async () => {
    delete process.env.POSTHOG_API_KEY
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_public_fallback'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'd-1',
      }),
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.api_key).toBe('phc_public_fallback')
  })
})

describe('POST /api/telemetry/capture — upstream failures', () => {
  it('returns 502 when PostHog responds non-2xx (does not echo body)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('PostHog internal error: tenant=abc123', { status: 500 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'd-1',
      }),
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.code).toBe('UPSTREAM_UNAVAILABLE')
    // No info leak from the upstream body.
    expect(JSON.stringify(body)).not.toContain('tenant=abc123')
    expect(JSON.stringify(body)).not.toContain('PostHog internal error')
  })

  it('returns 502 when PostHog forward times out (no throw)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const { POST } = await import('../route')
    const res = await POST(
      makeRequest({
        event: 'gallery_viewed',
        properties: {},
        distinct_id: 'd-1',
      }),
    )
    expect(res.status).toBe(502)
  })
})
