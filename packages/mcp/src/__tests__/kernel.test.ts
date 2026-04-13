/**
 * Tests for createDispatchKernel (P1.K2).
 *
 * Coverage strategy: mock the global fetch so both the middleware's
 * /api/sdk/validate-key + /api/sdk/meter calls AND the kernel's
 * /api/${protocol}/verify + /api/${protocol}/settle calls can be
 * intercepted and asserted. Each test records the full fetch request
 * stream and then asserts the expected calls were made, the
 * Authorization header carried the expected credential, and the
 * handler was invoked exactly the expected number of times.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { settlegrid, createDispatchKernel } from '../index'
import type { DispatchKernel } from '../index'
import type { PaymentContext } from '../adapters/types'

interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

function recordCall(url: string, init: RequestInit): FetchCall {
  const headers = init.headers as Record<string, string> | undefined
  let body: unknown = null
  if (typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body)
    } catch {
      body = init.body
    }
  }
  return {
    url,
    method: init.method ?? 'GET',
    headers: headers ?? {},
    body,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── sg-balance / MCP helpers ────────────────────────────────────────────
// The `mcp` adapter consumes `x-api-key` and has no facilitator round-trip.
// Tests compose these helpers to build the fetchMock for the middleware's
// /api/sdk/validate-key and /api/sdk/meter endpoints.

function validateKeyResponse(valid: boolean, balanceCents = 10_000): Response {
  if (!valid) {
    return jsonResponse({ error: 'Invalid API key', code: 'INVALID_KEY' }, 401)
  }
  return jsonResponse({
    valid: true,
    consumerId: 'con-test',
    toolId: 'tool-test',
    keyId: 'key-test',
    balanceCents,
  })
}

function meterResponse(remainingBalance = 9_995, cost = 5): Response {
  return jsonResponse({
    success: true,
    remainingBalanceCents: remainingBalance,
    costCents: cost,
    invocationId: 'inv-test',
  })
}

// ─── x402 helper ─────────────────────────────────────────────────────────
// The x402 adapter parses `payment-signature` as a base64-encoded JSON
// payload. This helper builds a valid payload so the adapter's
// extractPaymentContext succeeds.

function x402PaymentSignature(scheme: 'exact' | 'upto' = 'exact'): string {
  const payload = {
    scheme,
    network: 'eip155:8453',
    payload: {
      authorization: {
        from: '0x1234567890abcdef1234567890abcdef12345678',
      },
    },
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

function facilitatorSettleResponse(
  protocol: string,
  overrides: Record<string, unknown> = {},
): Response {
  return jsonResponse({
    status: 'settled',
    operationId: `op-${protocol}-test`,
    costCents: 10,
    metadata: {
      protocol,
      latencyMs: 42,
      settlementType: 'real-time',
    },
    ...overrides,
  })
}

// ─── Test suite ──────────────────────────────────────────────────────────

describe('createDispatchKernel', () => {
  let fetchCalls: FetchCall[]
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchCalls = []
    fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      fetchCalls.push(recordCall(url, init))
      return new Response('{"error":"unmocked url"}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ─── Input validation ─────────────────────────────────────────────────

  describe('input validation', () => {
    it('throws when called with null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createDispatchKernel(null as any)).toThrow(
        /SettleGrid instance/i,
      )
    })

    it('throws when called with undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createDispatchKernel(undefined as any)).toThrow(
        /SettleGrid instance/i,
      )
    })

    it('throws when called with a plain object lacking __kernel__', () => {
      const fake = {
        wrap: () => () => Promise.resolve({}),
        validateKey: async () => ({ valid: true, consumerId: '', balanceCents: 0 }),
        meter: async () => ({ success: true, remainingBalanceCents: 0, costCents: 0 }),
        clearCache: () => {},
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createDispatchKernel(fake as any)).toThrow(
        /kernel internals/i,
      )
    })

    it('accepts the result of settlegrid.init() without throwing', () => {
      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
      })
      expect(() => createDispatchKernel(sg)).not.toThrow()
    })
  })

  // ─── sg-balance / MCP protocol ────────────────────────────────────────

  describe('sg-balance (MCP protocol)', () => {
    function buildKernel(): DispatchKernel {
      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
      })
      return createDispatchKernel(sg)
    }

    function mcpRequest(headers: Record<string, string> = {}): Request {
      return new Request('http://localhost/api/tool/run', {
        method: 'POST',
        headers: {
          'x-api-key': 'sg_live_test_abc',
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ method: 'search', toolSlug: 'test-tool' }),
      })
    }

    it('happy path: validates key, runs handler, meters, returns 200', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/sdk/validate-key')) return validateKeyResponse(true, 10_000)
        if (url.endsWith('/api/sdk/meter')) return meterResponse(9_995, 5)
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel()
      const handler = vi.fn().mockResolvedValue({ result: 'handler-output' })
      const response = await kernel.handle(mcpRequest(), handler)

      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalledTimes(1)

      // MCP adapter stamps these headers on the response
      expect(response.headers.get('X-SettleGrid-Cost-Cents')).toBe('5')
      expect(response.headers.get('X-SettleGrid-Operation-Id')).toBe('inv-test')
      expect(response.headers.get('X-SettleGrid-Remaining-Balance')).toBe('9995')

      // Verify both middleware endpoints were called
      expect(fetchCalls.find((c) => c.url.endsWith('/api/sdk/validate-key'))).toBeDefined()
      expect(fetchCalls.find((c) => c.url.endsWith('/api/sdk/meter'))).toBeDefined()

      // No facilitator calls for sg-balance
      expect(fetchCalls.find((c) => c.url.includes('/x402/'))).toBeUndefined()
      expect(fetchCalls.find((c) => c.url.includes('/mpp/'))).toBeUndefined()
    })

    it('handler receives the normalized PaymentContext', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/sdk/validate-key')) return validateKeyResponse(true)
        if (url.endsWith('/api/sdk/meter')) return meterResponse()
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel()
      let capturedCtx: PaymentContext | undefined
      const handler = vi.fn(async (ctx: PaymentContext) => {
        capturedCtx = ctx
        return {}
      })
      await kernel.handle(mcpRequest(), handler)

      expect(capturedCtx).toBeDefined()
      expect(capturedCtx?.protocol).toBe('mcp')
      expect(capturedCtx?.identity.type).toBe('api-key')
      expect(capturedCtx?.identity.value).toBe('sg_live_test_abc')
      expect(capturedCtx?.operation.method).toBe('search')
    })

    it('handler NOT called when validate-key returns invalid', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/sdk/validate-key')) return validateKeyResponse(false)
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel()
      const handler = vi.fn()
      const response = await kernel.handle(mcpRequest(), handler)

      expect(handler).not.toHaveBeenCalled()
      // MCP adapter.formatError returns 500 for errors that are NOT
      // insufficient-credits (message doesn't contain 'insufficient'/'balance')
      expect(response.status).toBe(500)

      // validate-key was called, meter was NOT
      expect(fetchCalls.find((c) => c.url.endsWith('/api/sdk/validate-key'))).toBeDefined()
      expect(fetchCalls.find((c) => c.url.endsWith('/api/sdk/meter'))).toBeUndefined()
    })

    it('handler NOT called and 402 returned when balance is insufficient', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/sdk/validate-key')) return validateKeyResponse(true, 1)
        return new Response('{}', { status: 404 })
      })

      // Cost 100, balance 1 → insufficient
      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 100 },
      })
      const kernel = createDispatchKernel(sg)
      const handler = vi.fn()
      const response = await kernel.handle(mcpRequest(), handler)

      expect(handler).not.toHaveBeenCalled()
      expect(fetchCalls.find((c) => c.url.endsWith('/api/sdk/meter'))).toBeUndefined()
      // The P1.K2 hostile fix to the MCP adapter's formatError routes
      // InsufficientCreditsError to 402 via both the error.code ===
      // 'INSUFFICIENT_CREDITS' check and the case-insensitive message
      // match. Before the fix, the case-sensitive `includes('insufficient')`
      // check missed the capital-'I' message and fell through to 500.
      expect(response.status).toBe(402)
    })
  })

  // ─── x402 protocol ────────────────────────────────────────────────────

  describe('x402 protocol', () => {
    function buildKernel(
      options: { toolSecret?: string } = {},
    ): DispatchKernel {
      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
        ...(options.toolSecret !== undefined
          ? { toolSecret: options.toolSecret }
          : {}),
      })
      return createDispatchKernel(sg)
    }

    function x402Request(extraHeaders: Record<string, string> = {}): Request {
      return new Request('http://localhost/api/tool/run', {
        method: 'POST',
        headers: {
          'payment-signature': x402PaymentSignature(),
          ...extraHeaders,
        },
      })
    }

    it('happy path: verify + runHandler + settle + 200 response', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/x402/verify')) return jsonResponse({ valid: true })
        if (url.endsWith('/api/x402/settle')) {
          return facilitatorSettleResponse('x402', {
            txHash: '0xdeadbeef',
            costCents: 10,
          })
        }
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel({ toolSecret: 'tool_secret_xyz' })
      const handler = vi.fn().mockResolvedValue({ tokensUsed: 500 })
      const response = await kernel.handle(x402Request(), handler)

      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalledTimes(1)

      // x402 adapter stamps tx hash header
      expect(response.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xdeadbeef')

      // Both facilitator endpoints called in order
      const verifyCall = fetchCalls.find((c) => c.url.endsWith('/api/x402/verify'))
      const settleCall = fetchCalls.find((c) => c.url.endsWith('/api/x402/settle'))
      expect(verifyCall).toBeDefined()
      expect(settleCall).toBeDefined()
      expect(verifyCall?.method).toBe('POST')
      expect(settleCall?.method).toBe('POST')
    })

    it('uses toolSecret for Authorization header when set', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/x402/verify')) return jsonResponse({ valid: true })
        if (url.endsWith('/api/x402/settle')) return facilitatorSettleResponse('x402')
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel({ toolSecret: 'tool_secret_xyz' })
      await kernel.handle(x402Request(), vi.fn().mockResolvedValue({}))

      const verifyCall = fetchCalls.find((c) => c.url.endsWith('/api/x402/verify'))
      const settleCall = fetchCalls.find((c) => c.url.endsWith('/api/x402/settle'))
      expect(verifyCall?.headers['Authorization']).toBe('Bearer tool_secret_xyz')
      expect(settleCall?.headers['Authorization']).toBe('Bearer tool_secret_xyz')
    })

    it('falls back to x-api-key for Authorization when toolSecret unset', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/x402/verify')) return jsonResponse({ valid: true })
        if (url.endsWith('/api/x402/settle')) return facilitatorSettleResponse('x402')
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel() // no toolSecret
      const req = x402Request({ 'x-api-key': 'sg_live_consumer_fallback' })
      await kernel.handle(req, vi.fn().mockResolvedValue({}))

      const verifyCall = fetchCalls.find((c) => c.url.endsWith('/api/x402/verify'))
      expect(verifyCall?.headers['Authorization']).toBe('Bearer sg_live_consumer_fallback')
    })

    it('handler NOT called when facilitator verify returns { valid: false }', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/x402/verify')) {
          return jsonResponse({ valid: false, error: 'payment expired' })
        }
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel({ toolSecret: 'tool_secret_xyz' })
      const handler = vi.fn()
      const response = await kernel.handle(x402Request(), handler)

      expect(handler).not.toHaveBeenCalled()
      // x402 adapter.formatError returns 402 for payment errors
      // (the SettleGridUnavailableError message contains 'expired' which
      // triggers the isPaymentError branch of the adapter's formatError)
      expect(response.status).toBe(402)
      expect(fetchCalls.find((c) => c.url.endsWith('/api/x402/settle'))).toBeUndefined()
    })

    it('handler NOT called when facilitator verify returns 5xx HTTP status', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/x402/verify')) {
          return new Response('{}', { status: 503 })
        }
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel({ toolSecret: 'tool_secret_xyz' })
      const handler = vi.fn()
      const response = await kernel.handle(x402Request(), handler)

      expect(handler).not.toHaveBeenCalled()
      // x402 formatError falls through to 500 for non-payment errors
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(fetchCalls.find((c) => c.url.endsWith('/api/x402/settle'))).toBeUndefined()
    })

    it('handler output is forwarded to settle as handlerResult', async () => {
      let settleBody: unknown = null
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/x402/verify')) return jsonResponse({ valid: true })
        if (url.endsWith('/api/x402/settle')) {
          settleBody = JSON.parse(init.body as string)
          return facilitatorSettleResponse('x402')
        }
        return new Response('{}', { status: 404 })
      })

      const kernel = buildKernel({ toolSecret: 'tool_secret_xyz' })
      await kernel.handle(
        x402Request(),
        async () => ({ tokensUsed: 500, outputBytes: 1024 }),
      )

      expect(settleBody).toMatchObject({
        toolSlug: 'test-tool',
        handlerResult: { tokensUsed: 500, outputBytes: 1024 },
      })
    })
  })

  // ─── MPP protocol ─────────────────────────────────────────────────────

  describe('mpp protocol', () => {
    it('happy path: verify + runHandler + settle + 200 response', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/mpp/verify')) return jsonResponse({ valid: true })
        if (url.endsWith('/api/mpp/settle')) return facilitatorSettleResponse('mpp')
        return new Response('{}', { status: 404 })
      })

      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
        toolSecret: 'tool_secret_mpp',
      })
      const kernel = createDispatchKernel(sg)

      const req = new Request('http://localhost/api/tool/run', {
        method: 'POST',
        headers: { 'x-mpp-credential': 'mpp_session_xyz' },
      })
      const handler = vi.fn().mockResolvedValue({ ok: true })
      const response = await kernel.handle(req, handler)

      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(fetchCalls.find((c) => c.url.endsWith('/api/mpp/verify'))).toBeDefined()
      expect(fetchCalls.find((c) => c.url.endsWith('/api/mpp/settle'))).toBeDefined()
    })

    it('uses toolSecret for Authorization header', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/mpp/verify')) return jsonResponse({ valid: true })
        if (url.endsWith('/api/mpp/settle')) return facilitatorSettleResponse('mpp')
        return new Response('{}', { status: 404 })
      })

      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
        toolSecret: 'tool_secret_mpp',
      })
      const kernel = createDispatchKernel(sg)

      const req = new Request('http://localhost/api/tool/run', {
        headers: { 'x-mpp-credential': 'mpp_session_xyz' },
      })
      await kernel.handle(req, vi.fn().mockResolvedValue({}))

      const verifyCall = fetchCalls.find((c) => c.url.endsWith('/api/mpp/verify'))
      expect(verifyCall?.headers['Authorization']).toBe('Bearer tool_secret_mpp')
    })
  })

  // ─── 402 fallback ─────────────────────────────────────────────────────

  describe('402 fallback when no adapter matches', () => {
    it('returns 402 with Accept-Payments header when no protocol detected', async () => {
      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
      })
      const kernel = createDispatchKernel(sg)

      // Plain request with no auth headers → no adapter matches
      const req = new Request('http://localhost/api/tool/run', {
        method: 'POST',
      })
      const handler = vi.fn()
      const response = await kernel.handle(req, handler)

      expect(response.status).toBe(402)
      expect(response.headers.get('Accept-Payments')).toBe('sg-balance, x402, mpp')
      expect(handler).not.toHaveBeenCalled()
      expect(fetchCalls).toHaveLength(0)
    })

    it('402 body includes supportedProtocols and toolSlug', async () => {
      const sg = settlegrid.init({
        toolSlug: 'my-custom-slug',
        pricing: { defaultCostCents: 5 },
      })
      const kernel = createDispatchKernel(sg)

      const req = new Request('http://localhost/api/tool/run')
      const response = await kernel.handle(req, vi.fn())

      const body = await response.json()
      expect(body.code).toBe('PAYMENT_REQUIRED')
      expect(body.supportedProtocols).toEqual(['sg-balance', 'x402', 'mpp'])
      expect(body.toolSlug).toBe('my-custom-slug')
    })

    it('falls through to 402 when the matched adapter is not wired into Phase 1', async () => {
      // AP2 IS detected by the registry (has adapter) but is NOT wired
      // into the Phase 1 kernel. Should fall through to the 402 fallback.
      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
      })
      const kernel = createDispatchKernel(sg)

      const req = new Request('http://localhost/api/tool/run', {
        headers: { 'x-settlegrid-protocol': 'ap2' },
      })
      const handler = vi.fn()
      const response = await kernel.handle(req, handler)

      expect(response.status).toBe(402)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ─── Public API surface ───────────────────────────────────────────────

  // ─── Hostile-review regression coverage ──────────────────────────────

  describe('hostile-review regression coverage', () => {
    // H1: handleSgBalance must use meterResponse.costCents, not the
    // locally-computed pre-auth value. Ensures the kernel reports what
    // the server actually charged, not what the kernel expected to be
    // charged. A silent divergence here would be a billing-correctness
    // bug if the server applied any adjustment (discount, surge, etc.).
    it('H1: SettlementResult reflects meterResponse.costCents, not pre-auth costCents', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/sdk/validate-key')) return validateKeyResponse(true)
        if (url.endsWith('/api/sdk/meter')) {
          // Server returns costCents=3 even though pricing config says 5.
          // This simulates a server-side discount / promotion / surge.
          return jsonResponse({
            success: true,
            remainingBalanceCents: 9997,
            costCents: 3,
            invocationId: 'inv-discount',
          })
        }
        return new Response('{}', { status: 404 })
      })

      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 }, // pre-auth expects 5
      })
      const kernel = createDispatchKernel(sg)

      const request = new Request('http://localhost/api/tool/run', {
        method: 'POST',
        headers: { 'x-api-key': 'sg_live_test_abc' },
      })
      const response = await kernel.handle(request, vi.fn().mockResolvedValue({}))

      // Response header reflects the server-returned cost (3), not the
      // pre-auth value (5). If this test fails, handleSgBalance is
      // using the wrong costCents source.
      expect(response.headers.get('X-SettleGrid-Cost-Cents')).toBe('3')
    })

    // H2: facilitatorVerify must validate the raw body shape before
    // casting. If /verify returns `null` as its JSON body (a valid JSON
    // value but not an object), the original code crashed with
    // TypeError reading `parsed.valid`; the fix adds an explicit
    // null/array/object check.
    it('H2: facilitator verify returning null body does not crash the kernel', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/x402/verify')) {
          return new Response('null', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('{}', { status: 404 })
      })

      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
        toolSecret: 'ts',
      })
      const kernel = createDispatchKernel(sg)

      const request = new Request('http://localhost/api/x402/run', {
        headers: { 'payment-signature': x402PaymentSignature() },
      })
      const handler = vi.fn()
      const response = await kernel.handle(request, handler)

      expect(handler).not.toHaveBeenCalled()
      // The kernel returns an error response (via adapter.formatError)
      // rather than crashing with an unhandled TypeError.
      expect(response.status).toBeGreaterThanOrEqual(400)
      // settle must NOT be called because verify failed
      expect(fetchCalls.find((c) => c.url.endsWith('/api/x402/settle'))).toBeUndefined()
    })

    // H3: handle() must never throw. The inner try/catch routes common
    // errors through adapter.formatError, but call sites OUTSIDE the
    // inner try (protocolRegistry.detect, adapter.formatError itself,
    // buildMultiProtocol402) could throw and produce unhandled
    // rejections. The outer try/catch + buildKernelFault500 fallback
    // is the defense-in-depth layer. This test forces detect() to
    // throw synchronously and asserts the outer catch produces a 500
    // response with the KERNEL_FAULT code instead of propagating.
    it('H3: outer catch returns 500 when protocolRegistry.detect throws', async () => {
      const { protocolRegistry } = await import('../adapters')
      const detectSpy = vi
        .spyOn(protocolRegistry, 'detect')
        .mockImplementation(() => {
          throw new Error('simulated detect() bug')
        })
      try {
        const sg = settlegrid.init({
          toolSlug: 'test-tool',
          pricing: { defaultCostCents: 5 },
        })
        const kernel = createDispatchKernel(sg)
        const handler = vi.fn()
        const response = await kernel.handle(
          new Request('http://localhost/api/tool/run'),
          handler,
        )

        expect(response.status).toBe(500)
        const body = await response.json()
        expect(body.code).toBe('KERNEL_FAULT')
        expect(body.message).toBe('simulated detect() bug')
        expect(handler).not.toHaveBeenCalled()
      } finally {
        detectSpy.mockRestore()
      }
    })

    it('H3: outer catch returns 500 when adapter.formatError itself throws', async () => {
      // Force the inner try/catch to enter its catch block (via
      // InvalidKey), then force adapter.formatError to throw. The
      // outer catch then produces the KERNEL_FAULT 500 fallback.
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/sdk/validate-key')) return validateKeyResponse(false)
        return new Response('{}', { status: 404 })
      })

      const { protocolRegistry } = await import('../adapters')
      const mcpAdapter = protocolRegistry.get('mcp')
      expect(mcpAdapter).toBeDefined()
      const formatErrorSpy = vi
        .spyOn(mcpAdapter!, 'formatError')
        .mockImplementation(() => {
          throw new Error('simulated formatError bug')
        })
      try {
        const sg = settlegrid.init({
          toolSlug: 'test-tool',
          pricing: { defaultCostCents: 5 },
        })
        const kernel = createDispatchKernel(sg)
        const response = await kernel.handle(
          new Request('http://localhost/api/tool/run', {
            headers: { 'x-api-key': 'sg_live_test_abc' },
          }),
          vi.fn(),
        )

        expect(response.status).toBe(500)
        const body = await response.json()
        expect(body.code).toBe('KERNEL_FAULT')
        expect(body.message).toBe('simulated formatError bug')
      } finally {
        formatErrorSpy.mockRestore()
      }
    })

    // M1: facilitatorSettle must validate every required SettlementResult
    // field strictly. Parameterized across each failure mode so a
    // regression that relaxes one check surfaces immediately.
    const malformedSettleCases: Array<{ label: string; body: unknown }> = [
      { label: 'null body', body: null },
      { label: 'array body', body: [] },
      { label: 'primitive body', body: 42 },
      {
        label: 'missing status',
        body: {
          operationId: 'op-1',
          costCents: 10,
          metadata: { protocol: 'x402', latencyMs: 1, settlementType: 'real-time' },
        },
      },
      {
        label: 'unknown status',
        body: {
          status: 'yolo',
          operationId: 'op-1',
          costCents: 10,
          metadata: { protocol: 'x402', latencyMs: 1, settlementType: 'real-time' },
        },
      },
      {
        label: 'empty operationId',
        body: {
          status: 'settled',
          operationId: '',
          costCents: 10,
          metadata: { protocol: 'x402', latencyMs: 1, settlementType: 'real-time' },
        },
      },
      {
        label: 'NaN costCents',
        body: {
          status: 'settled',
          operationId: 'op-1',
          costCents: Number.NaN,
          metadata: { protocol: 'x402', latencyMs: 1, settlementType: 'real-time' },
        },
      },
      {
        label: 'negative costCents',
        body: {
          status: 'settled',
          operationId: 'op-1',
          costCents: -5,
          metadata: { protocol: 'x402', latencyMs: 1, settlementType: 'real-time' },
        },
      },
      {
        label: 'Infinity costCents',
        body: {
          status: 'settled',
          operationId: 'op-1',
          costCents: Number.POSITIVE_INFINITY,
          metadata: { protocol: 'x402', latencyMs: 1, settlementType: 'real-time' },
        },
      },
      {
        label: 'null metadata',
        body: {
          status: 'settled',
          operationId: 'op-1',
          costCents: 10,
          metadata: null,
        },
      },
      {
        label: 'array metadata',
        body: {
          status: 'settled',
          operationId: 'op-1',
          costCents: 10,
          metadata: [],
        },
      },
    ]
    for (const c of malformedSettleCases) {
      it(`M1: facilitator settle with ${c.label} is rejected with a clear error`, async () => {
        fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
          fetchCalls.push(recordCall(url, init))
          if (url.endsWith('/api/x402/verify')) return jsonResponse({ valid: true })
          if (url.endsWith('/api/x402/settle')) {
            return new Response(JSON.stringify(c.body), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }
          return new Response('{}', { status: 404 })
        })

        const sg = settlegrid.init({
          toolSlug: 'test-tool',
          pricing: { defaultCostCents: 5 },
          toolSecret: 'ts',
        })
        const kernel = createDispatchKernel(sg)
        const request = new Request('http://localhost/api/x402/run', {
          headers: { 'payment-signature': x402PaymentSignature() },
        })
        const response = await kernel.handle(request, vi.fn().mockResolvedValue({}))

        // Kernel returns an error response rather than crashing
        expect(response.status).toBeGreaterThanOrEqual(400)
      })
    }

    // M2: resolveFacilitatorAuth must only accept Bearer-scheme
    // Authorization headers. Non-Bearer schemes (Basic, Digest, etc.)
    // would otherwise be wrapped as "Bearer Basic xyz" which is
    // nonsense that the facilitator would reject with a confusing 401.
    it('M2: non-Bearer Authorization header does not trigger facilitator call', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        return new Response('{}', { status: 404 })
      })

      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
        // No toolSecret
      })
      const kernel = createDispatchKernel(sg)

      const request = new Request('http://localhost/api/x402/run', {
        headers: {
          'payment-signature': x402PaymentSignature(),
          authorization: 'Basic dXNlcjpwYXNz', // non-Bearer
        },
      })
      const response = await kernel.handle(request, vi.fn())

      // The kernel throws internally ("facilitator auth unavailable")
      // and routes the error through adapter.formatError. Critical:
      // the facilitator verify endpoint is NOT called because
      // resolveFacilitatorAuth throws before fetch runs.
      expect(fetchCalls.find((c) => c.url.endsWith('/api/x402/verify'))).toBeUndefined()
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    // M2 companion: Authorization: Bearer <token> DOES work as the
    // tertiary fallback when both toolSecret and x-api-key are absent.
    it('M2: Bearer Authorization header is accepted as the tertiary fallback', async () => {
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        fetchCalls.push(recordCall(url, init))
        if (url.endsWith('/api/x402/verify')) return jsonResponse({ valid: true })
        if (url.endsWith('/api/x402/settle')) return facilitatorSettleResponse('x402')
        return new Response('{}', { status: 404 })
      })

      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
      })
      const kernel = createDispatchKernel(sg)

      const request = new Request('http://localhost/api/x402/run', {
        headers: {
          'payment-signature': x402PaymentSignature(),
          authorization: 'Bearer my_consumer_token',
        },
      })
      await kernel.handle(request, vi.fn().mockResolvedValue({}))

      const verifyCall = fetchCalls.find((c) => c.url.endsWith('/api/x402/verify'))
      // The Bearer Authorization header is passed through verbatim,
      // not wrapped with an extra "Bearer " prefix.
      expect(verifyCall?.headers['Authorization']).toBe('Bearer my_consumer_token')
    })
  })

  describe('public API surface', () => {
    it('createDispatchKernel is re-exported from the package index', async () => {
      const mod = await import('../index')
      expect(typeof mod.createDispatchKernel).toBe('function')
    })

    it('createDispatchKernel is importable directly from the ./kernel subpath', async () => {
      // Verifies the P1.K2 DoD item "subpath export works (test by
      // importing from a different file)". The package.json exports map
      // routes `@settlegrid/mcp/kernel` to the same bundle as the main
      // entry; at the source level that target is `packages/mcp/src/kernel.ts`,
      // which is what this test imports from. If a future refactor
      // removes the `createDispatchKernel` export from kernel.ts (for
      // example by deleting the file in favor of a consolidated
      // barrel), this test fails loudly instead of silently breaking
      // consumers who use the subpath import.
      const subpathMod = await import('../kernel')
      expect(typeof subpathMod.createDispatchKernel).toBe('function')
      // The function reached via the subpath is the SAME function that
      // comes out of the package index — single bundle, single runtime
      // value (no double instantiation of the adapter registry).
      const indexMod = await import('../index')
      expect(subpathMod.createDispatchKernel).toBe(indexMod.createDispatchKernel)
    })

    it('DispatchKernel type is usable as a type annotation', () => {
      // The mere fact that this file type-checks with `DispatchKernel`
      // imported from '../index' verifies the type is re-exported.
      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
      })
      const kernel: DispatchKernel = createDispatchKernel(sg)
      expect(typeof kernel.handle).toBe('function')
    })

    it('sg.__kernel__ is NOT enumerable (hidden from Object.keys and JSON)', () => {
      const sg = settlegrid.init({
        toolSlug: 'test-tool',
        pricing: { defaultCostCents: 5 },
      })
      // Public surface: wrap / validateKey / meter / clearCache only
      expect(Object.keys(sg).sort()).toEqual([
        'clearCache',
        'meter',
        'validateKey',
        'wrap',
      ])
      // JSON-serialized instance must not include __kernel__
      const serialized = JSON.stringify(sg)
      expect(serialized).not.toContain('__kernel__')
    })
  })
})
