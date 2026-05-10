/**
 * P5.K1 — kernel telemetry sink (POST /api/telemetry/kernel) tests.
 *
 * Coverage (matches hostile-review fixes F2/F3/F4/F5/F7):
 *   - 429 on rate-limit miss (per-IP)
 *   - 200 + reason='sink_disabled' when KERNEL_TELEMETRY_AUTH_TOKEN unset
 *     (NOT 4xx — SDK callers must stop without retry-looping)
 *   - 401 when Bearer header missing or token is wrong (sha256 +
 *     timingSafeEqual collapses length-disclosure)
 *   - 413 Content-Length pre-check (rejects flooders before buffering)
 *   - 413 post-buffer cap (chunked / unset Content-Length path)
 *   - 400 malformed JSON / unknown event name / missing adapter
 *   - 400 SafeIntProp violations (F3): float, negative, > MAX_SAFE_INTEGER
 *     on `amount_cents` / `take_cents` / `latency_ms` / `fee_bps`
 *   - 200 happy path: DB insert with denormalized adapter/rail/devId
 *   - Empty-string `rail` / `dev_id` → NULL normalization (F4)
 *   - PostHog server-side forward best-effort (a forward failure must
 *     not fail the DB write the dashboard depends on)
 *
 * The DB boundary is mocked (`db.insert(...).values(...)` is awaitable
 * via `mockReturnThis() → mockResolvedValue`). We exercise the route
 * logic — auth, body cap, Zod schema, denormalization, forward — not
 * the underlying Drizzle plumbing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit, mockCreateRateLimiter, mockLogger } =
  vi.hoisted(() => ({
    mockDb: {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    },
    mockCheckRateLimit: vi.fn(),
    mockCreateRateLimiter: vi.fn().mockReturnValue({}),
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
vi.mock('@/lib/rate-limit', () => ({
  createRateLimiter: mockCreateRateLimiter,
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

import { POST } from '@/app/api/telemetry/kernel/route'

const TOKEN = 'test-kernel-token-32bytes-long-enough'

interface BodyOverrides {
  name?: string
  props?: Record<string, unknown>
  ts?: string
}

function makeBody(overrides: BodyOverrides = {}): string {
  return JSON.stringify({
    name: overrides.name ?? 'kernel.request_received',
    props: overrides.props ?? { adapter: 'sg-balance' },
    ...(overrides.ts !== undefined ? { ts: overrides.ts } : {}),
  })
}

interface RequestOptions {
  body?: string | null
  authHeader?: string | null
  contentLength?: string | null
}

function makeRequest(opts: RequestOptions = {}): NextRequest {
  const headers: Record<string, string> = {
    'x-forwarded-for': '127.0.0.1',
    'content-type': 'application/json',
  }
  if (opts.authHeader === undefined) {
    headers.authorization = `Bearer ${TOKEN}`
  } else if (opts.authHeader !== null) {
    headers.authorization = opts.authHeader
  }
  if (opts.contentLength !== undefined && opts.contentLength !== null) {
    headers['content-length'] = opts.contentLength
  }
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method: 'POST',
    headers,
  }
  if (opts.body === undefined) init.body = makeBody()
  else if (opts.body !== null) init.body = opts.body
  return new NextRequest('http://localhost:3005/api/telemetry/kernel', init)
}

let envSnapshot: {
  KERNEL_TELEMETRY_AUTH_TOKEN?: string
  POSTHOG_API_KEY?: string
  NEXT_PUBLIC_POSTHOG_KEY?: string
  NEXT_PUBLIC_POSTHOG_HOST?: string
} = {}

beforeEach(() => {
  envSnapshot = {
    KERNEL_TELEMETRY_AUTH_TOKEN: process.env.KERNEL_TELEMETRY_AUTH_TOKEN,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  }
  delete process.env.KERNEL_TELEMETRY_AUTH_TOKEN
  delete process.env.POSTHOG_API_KEY
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST
  mockCheckRateLimit.mockResolvedValue({
    success: true,
    limit: 600,
    remaining: 599,
    reset: 0,
  })
  mockDb.insert.mockReturnThis()
  mockDb.values.mockResolvedValue(undefined)
})

afterEach(() => {
  for (const [k, v] of Object.entries(envSnapshot)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('POST /api/telemetry/kernel — rate limit', () => {
  it('returns 429 when rate limit is exceeded (per-IP)', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 600,
      remaining: 0,
      reset: 0,
    })
    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMITED')
    // Rate-limit short-circuits before any DB or auth work.
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('uses x-forwarded-for first hop as the rate-limit key', async () => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
    const headers: Record<string, string> = {
      'x-forwarded-for': '203.0.113.7, 10.0.0.1, 172.16.0.5',
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
    }
    const req = new NextRequest('http://localhost:3005/api/telemetry/kernel', {
      method: 'POST',
      headers,
      body: makeBody(),
    })
    await POST(req)
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'kernel-telemetry:203.0.113.7',
    )
  })
})

describe('POST /api/telemetry/kernel — auth', () => {
  it("returns 200 + reason='sink_disabled' when token env unset (no SDK retry-loop)", async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      ok: true,
      forwarded: false,
      reason: 'sink_disabled',
    })
    // Pre-launch behavior: DB write is skipped entirely so a missing
    // env var doesn't fill the table with no-op rows.
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is missing', async () => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
    const res = await POST(makeRequest({ authHeader: null }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when Authorization is non-Bearer', async () => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
    const res = await POST(makeRequest({ authHeader: 'Basic dXNlcjpwYXNz' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when Bearer token is wrong (timingSafe compare on sha256)', async () => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
    const res = await POST(makeRequest({ authHeader: 'Bearer wrong-token' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
    // No DB write should occur on auth failure.
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('does NOT echo the bearer token in 401 body (info-leak guard)', async () => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
    const sneaky = 'super-secret-token-that-should-never-appear'
    const res = await POST(makeRequest({ authHeader: `Bearer ${sneaky}` }))
    const body = await res.text()
    expect(body).not.toContain(sneaky)
  })
})

describe('POST /api/telemetry/kernel — body cap', () => {
  it('returns 413 when Content-Length declares > 4 KB (pre-buffer)', async () => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
    const res = await POST(
      makeRequest({ contentLength: String(4 * 1024 + 1) }),
    )
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('returns 413 when buffered body length > 4 KB (chunked / unset Content-Length)', async () => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
    const huge = 'x'.repeat(4 * 1024 + 100)
    const oversized = JSON.stringify({
      name: 'kernel.request_received',
      props: { adapter: 'sg-balance', huge },
    })
    const res = await POST(makeRequest({ body: oversized }))
    expect(res.status).toBe(413)
  })

  it('accepts body just under 4 KB (boundary inclusive)', async () => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
    const filler = 'x'.repeat(3500)
    const ok = JSON.stringify({
      name: 'kernel.request_received',
      props: { adapter: 'sg-balance', note: filler },
    })
    const res = await POST(makeRequest({ body: ok }))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/telemetry/kernel — body validation', () => {
  beforeEach(() => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
  })

  it('returns 400 on malformed JSON', async () => {
    const res = await POST(makeRequest({ body: 'not-json{' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_BODY')
  })

  it('returns 400 on unknown event name (event-name spoofing → 400)', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.NOT_A_REAL_EVENT',
          props: { adapter: 'sg-balance' },
        }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when props.adapter is missing', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.request_received',
          props: {},
        }),
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_BODY')
  })

  it('returns 400 when props.adapter is a non-string', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.request_received',
          props: { adapter: 12345 },
        }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects float on amount_cents (SafeIntProp F3)', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.invocation_settled',
          props: { adapter: 'sg-balance', amount_cents: 1.5 },
        }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects negative on take_cents (SafeIntProp F3)', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.invocation_settled',
          props: { adapter: 'sg-balance', take_cents: -10 },
        }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects > MAX_SAFE_INTEGER on latency_ms (SafeIntProp F3)', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.adapter_latency_ms',
          props: {
            adapter: 'sg-balance',
            latency_ms: Number.MAX_SAFE_INTEGER + 1,
          },
        }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects non-finite on fee_bps (SafeIntProp F3)', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.routing_decision',
          props: { adapter: 'sg-balance', fee_bps: Infinity },
        }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('accepts safe non-negative integers on all numeric fields', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.invocation_settled',
          props: {
            adapter: 'sg-balance',
            amount_cents: 1000,
            take_cents: 50,
            latency_ms: 234,
            fee_bps: 500,
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
  })

  it('does NOT echo body content in 400 error response (PII guard)', async () => {
    const sensitive = 'user@example.com:secret-pii-payload'
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'NOT_AN_EVENT',
          props: { adapter: 'sg-balance', notes: sensitive },
        }),
      }),
    )
    const text = await res.text()
    expect(text).not.toContain(sensitive)
  })
})

describe('POST /api/telemetry/kernel — happy path + denormalization', () => {
  beforeEach(() => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
  })

  it('persists row with denormalized adapter/rail/devId on a settled event', async () => {
    const props = {
      adapter: 'sg-balance',
      rail: 'stripe-acss',
      dev_id: '550e8400-e29b-41d4-a716-446655440000',
      amount_cents: 1234,
      take_cents: 12,
    }
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.invocation_settled',
          props,
        }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    expect(mockDb.values).toHaveBeenCalledWith({
      eventName: 'kernel.invocation_settled',
      adapter: 'sg-balance',
      rail: 'stripe-acss',
      devId: '550e8400-e29b-41d4-a716-446655440000',
      props,
    })
  })

  it("normalizes empty-string rail to NULL (F4 — keeps rails dashboard's IS NOT NULL filter clean)", async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.invocation_settled',
          props: {
            adapter: 'sg-balance',
            rail: '',
            amount_cents: 100,
          },
        }),
      }),
    )
    expect(res.status).toBe(200)
    const call = mockDb.values.mock.calls[0]?.[0] as { rail: unknown } | undefined
    expect(call?.rail).toBeNull()
  })

  it('normalizes empty-string dev_id to NULL (F4)', async () => {
    const res = await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.request_received',
          props: { adapter: 'sg-balance', dev_id: '' },
        }),
      }),
    )
    expect(res.status).toBe(200)
    const call = mockDb.values.mock.calls[0]?.[0] as { devId: unknown } | undefined
    expect(call?.devId).toBeNull()
  })

  it('returns 500 when DB insert throws (caller-visible error)', async () => {
    mockDb.values.mockRejectedValueOnce(new Error('connection refused'))
    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'kernel_telemetry.db_insert_failed',
      expect.objectContaining({ error: 'connection refused' }),
    )
  })
})

describe('POST /api/telemetry/kernel — PostHog forward (server-side)', () => {
  beforeEach(() => {
    process.env.KERNEL_TELEMETRY_AUTH_TOKEN = TOKEN
  })

  it('does NOT forward when no PostHog key is set', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.forwarded).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards to PostHog when POSTHOG_API_KEY is set, body.forwarded=true on ok', async () => {
    process.env.POSTHOG_API_KEY = 'phc_server_key'
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.forwarded).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    expect(String(call![0])).toContain('/i/v0/e/')
    const payload = JSON.parse(String(call![1].body))
    expect(payload.api_key).toBe('phc_server_key')
    expect(payload.event).toBe('kernel.request_received')
    // No dev_id was sent → fallback distinct_id.
    expect(payload.distinct_id).toBe('anonymous-kernel')
  })

  it('uses dev_id (not anonymous) as distinct_id when present', async () => {
    process.env.POSTHOG_API_KEY = 'phc_server_key'
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await POST(
      makeRequest({
        body: JSON.stringify({
          name: 'kernel.request_received',
          props: {
            adapter: 'sg-balance',
            dev_id: '550e8400-e29b-41d4-a716-446655440000',
          },
        }),
      }),
    )
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const payload = JSON.parse(String(call![1].body))
    expect(payload.distinct_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('returns 200 with forwarded=false when PostHog fetch throws (best-effort)', async () => {
    process.env.POSTHOG_API_KEY = 'phc_server_key'
    const fetchMock = vi.fn(async () => {
      throw new Error('connect ETIMEDOUT')
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    // DB row was still written; PostHog outage doesn't fail the path
    // the dashboard reads from.
    expect(body.ok).toBe(true)
    expect(body.forwarded).toBe(false)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'kernel_telemetry.posthog_forward_failed',
      expect.objectContaining({ error: 'connect ETIMEDOUT' }),
    )
  })

  it('returns forwarded=false when PostHog responds non-2xx', async () => {
    process.env.POSTHOG_API_KEY = 'phc_server_key'
    const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await POST(makeRequest())
    const body = await res.json()
    expect(body.forwarded).toBe(false)
  })

  it('falls back to NEXT_PUBLIC_POSTHOG_KEY when POSTHOG_API_KEY is unset', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_public_fallback'
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await POST(makeRequest())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const payload = JSON.parse(String(call![1].body))
    expect(payload.api_key).toBe('phc_public_fallback')
  })

  it('uses NEXT_PUBLIC_POSTHOG_HOST override (trailing slash stripped)', async () => {
    process.env.POSTHOG_API_KEY = 'phc_server_key'
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.posthog.com/'
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response('{}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await POST(makeRequest())
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    expect(String(call![0])).toBe('https://eu.posthog.com/i/v0/e/')
  })
})
