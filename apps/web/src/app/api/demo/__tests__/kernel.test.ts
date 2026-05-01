/**
 * P4.K1 — tests for the kernel-demo proxy route.
 *
 * The proxy is the boundary between the visitor's browser and the
 * unmodified `@settlegrid/mcp` kernel. These tests pin:
 *
 *   - Rate limiting (429 on cap, 200 with rate headers below)
 *   - Request reconstruction (URL, method, headers, body shape)
 *   - Header sanitization (denylist, size caps)
 *   - Visitor-supplied Authorization is stripped (hostile-review (b))
 *   - Successful kernel invocation produces the right response shape
 *   - The proxy never imports production payment modules (hostile (a))
 *
 * The kernel module is mocked with a controllable handle() so tests
 * can assert behavior without exercising the real kernel pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { mockHandle, mockRateLimit, mockInspectRouting } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockRateLimit: vi.fn(),
  mockInspectRouting: vi.fn(),
}))

vi.mock('@/lib/demo-kernel-config', async () => {
  const actual = await vi.importActual<typeof import('@/lib/demo-kernel-config')>(
    '@/lib/demo-kernel-config',
  )
  return {
    ...actual,
    buildDemoKernel: () => ({ handle: mockHandle }),
    inspectRouting: mockInspectRouting,
  }
})

vi.mock('@/lib/demo-rate-limit', () => ({
  checkDemoRateLimit: mockRateLimit,
}))

import { POST } from '@/app/api/demo/kernel/route'

beforeEach(() => {
  mockHandle.mockReset()
  mockRateLimit.mockReset()
  mockInspectRouting.mockReset()

  mockRateLimit.mockResolvedValue({
    success: true,
    limit: 30,
    remaining: 29,
    reset: 1700000000,
    identifier: '203.0.113.4',
  })
  mockInspectRouting.mockReturnValue({
    detected: { protocol: 'mcp', displayName: 'MCP' },
    dispatchPath: 'sg-balance',
    steps: [
      { label: 'Protocol detection', state: 'success' },
      { label: 'Validate API key', state: 'pending' },
    ],
  })
  mockHandle.mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
})

function makeReq(payload: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3005/api/demo/kernel', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  })
}

describe('rate limiting', () => {
  it('returns 429 when checkDemoRateLimit reports success=false', async () => {
    mockRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      reset: Date.now() + 60_000,
      identifier: '203.0.113.4',
    })
    const res = await POST(makeReq({}))
    expect(res.status).toBe(429)
    expect(res.headers.get('x-ratelimit-limit')).toBe('30')
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0')
    const body = await res.json()
    expect(body.error).toBe('rate_limited')
  })

  it('forwards rate-limit headers on success', async () => {
    const res = await POST(makeReq({ url: 'https://example.com', body: {} }))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-ratelimit-limit')).toBe('30')
    expect(res.headers.get('x-ratelimit-remaining')).toBe('29')
  })
})

describe('request validation', () => {
  it('returns 413 when the request body exceeds 16 KiB', async () => {
    const huge = 'A'.repeat(17 * 1024)
    const res = await POST(makeReq(huge))
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toBe('request_too_large')
  })

  it('returns 400 on malformed JSON', async () => {
    const res = await POST(makeReq('{ not valid json'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('malformed_json')
  })

  it('returns 400 when the body is a JSON array (must be an object)', async () => {
    const res = await POST(makeReq([1, 2, 3]))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('malformed_spec')
  })

  it('returns 400 when url is provided but not a valid URL', async () => {
    const res = await POST(makeReq({ url: 'not a url' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_spec')
    expect(body.message).toContain('Invalid url')
  })
})

describe('request reconstruction', () => {
  it('passes the visitor-supplied URL through to the kernel', async () => {
    await POST(
      makeReq({
        url: 'https://example.com/foo',
        body: { method: 'demo' },
      }),
    )
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    expect(kernelReq?.url).toBe('https://example.com/foo')
  })

  it('defaults to POST when no method is supplied', async () => {
    await POST(makeReq({ url: 'https://example.com/foo' }))
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    expect(kernelReq?.method).toBe('POST')
  })

  it('uses the visitor method when supplied', async () => {
    await POST(makeReq({ url: 'https://example.com/foo', method: 'PUT' }))
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    expect(kernelReq?.method).toBe('PUT')
  })

  it('forwards visitor-supplied headers', async () => {
    await POST(
      makeReq({
        url: 'https://example.com/foo',
        headers: { 'x-api-key': 'sk_visitor' },
      }),
    )
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    expect(kernelReq?.headers.get('x-api-key')).toBe('sk_visitor')
  })

  it('STRIPS the Authorization header (server-side credentials only)', async () => {
    await POST(
      makeReq({
        url: 'https://example.com/foo',
        headers: { authorization: 'Bearer attacker-token' },
      }),
    )
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    // Visitor-set Authorization MUST NOT survive sanitization.
    expect(kernelReq?.headers.get('authorization')).toBeNull()
  })

  it('STRIPS Cookie, Host, Connection, and similar machinery headers', async () => {
    await POST(
      makeReq({
        url: 'https://example.com/foo',
        headers: {
          cookie: 'session=abc',
          host: 'evil.example.com',
          connection: 'keep-alive',
          'transfer-encoding': 'chunked',
        },
      }),
    )
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    expect(kernelReq?.headers.get('cookie')).toBeNull()
    // host is set by the URL constructor; check that no spoofed value
    // propagated. Some Request impls drop host entirely.
    expect(kernelReq?.headers.get('host')).not.toBe('evil.example.com')
    expect(kernelReq?.headers.get('connection')).toBeNull()
    expect(kernelReq?.headers.get('transfer-encoding')).toBeNull()
  })

  it('caps headers at 32 entries', async () => {
    const manyHeaders: Record<string, string> = {}
    for (let i = 0; i < 50; i++) {
      manyHeaders[`x-h-${i}`] = 'v'
    }
    await POST(
      makeReq({
        url: 'https://example.com/foo',
        headers: manyHeaders,
      }),
    )
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    let count = 0
    kernelReq?.headers.forEach(() => count++)
    // Some headers are auto-set by the Request constructor (e.g.
    // content-type for a body). Visitor-supplied count should be
    // capped at 32; total may be slightly higher.
    expect(count).toBeLessThanOrEqual(33)
  })

  it('caps individual header values at 4096 chars (silently drops oversized)', async () => {
    const tooLong = 'A'.repeat(5000)
    await POST(
      makeReq({
        url: 'https://example.com/foo',
        headers: { 'x-good': 'small', 'x-bad': tooLong },
      }),
    )
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    expect(kernelReq?.headers.get('x-good')).toBe('small')
    expect(kernelReq?.headers.get('x-bad')).toBeNull()
  })

  it('serializes a JSON body when not a string', async () => {
    await POST(
      makeReq({
        url: 'https://example.com/foo',
        body: { method: 'demo.x' },
      }),
    )
    const kernelReq = mockHandle.mock.calls[0]?.[0] as Request | undefined
    expect(kernelReq?.headers.get('content-type')).toContain('application/json')
    const body = await kernelReq?.text()
    expect(body).toBe('{"method":"demo.x"}')
  })
})

describe('successful response shape', () => {
  it('includes routingDecision, response, and rateLimit', async () => {
    const res = await POST(makeReq({ body: {} }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.routingDecision).toBeDefined()
    expect(json.routingDecision.detected.protocol).toBe('mcp')
    expect(json.response).toBeDefined()
    expect(json.response.status).toBe(200)
    expect(json.response.body).toEqual({ ok: true })
    expect(json.rateLimit.limit).toBe(30)
  })

  it('captures non-JSON kernel responses as text in bodyText', async () => {
    mockHandle.mockResolvedValueOnce(
      new Response('plain text body', { status: 200 }),
    )
    const res = await POST(makeReq({ body: {} }))
    const json = await res.json()
    expect(json.response.bodyText).toBe('plain text body')
    expect(json.response.body).toBe('plain text body')
  })

  it('decodes a 402 manifest response', async () => {
    mockHandle.mockResolvedValueOnce(
      new Response(JSON.stringify({ accepts: [] }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const res = await POST(makeReq({ body: {} }))
    const json = await res.json()
    expect(json.response.status).toBe(402)
    expect(json.response.body).toEqual({ accepts: [] })
  })
})

describe('kernel-throws fallback', () => {
  it('returns 500 if kernel.handle() throws (defense-in-depth)', async () => {
    mockHandle.mockRejectedValueOnce(new Error('kernel exploded'))
    const res = await POST(makeReq({ body: {} }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('kernel_unhandled_exception')
  })
})

describe('hostile-review: proxy file imports nothing from payment infrastructure', () => {
  const proxySrc = readFileSync(
    resolve(__dirname, '../kernel/route.ts'),
    'utf8',
  )
  const FORBIDDEN = [
    "from '@/lib/db'",
    "from '@/lib/db/",
    "from '@/lib/stripe'",
    "from '@/lib/settlement",
    "from '@/lib/fraud'",
    "from '@/lib/audit'",
    "from 'stripe'",
    "from '@stripe",
  ]
  it.each(FORBIDDEN)('does not import %s', (forbidden) => {
    expect(proxySrc.includes(forbidden)).toBe(false)
  })

  it('imports createDispatchKernel from @settlegrid/mcp via demo-kernel-config (same kernel build as production)', () => {
    expect(proxySrc).toContain("from '@/lib/demo-kernel-config'")
    // demo-kernel-config.ts is the only file allowed to import from
    // @settlegrid/mcp; the proxy reads the kernel via the helper.
    expect(proxySrc).toContain('buildDemoKernel')
  })
})
