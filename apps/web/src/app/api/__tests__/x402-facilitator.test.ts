/**
 * P4.MKT2 — public x402 facilitator route tests.
 *
 * Coverage:
 *   - GET /v1/supported: rate-limit 429, payload shape, network allowlist
 *     filtered to Base + Base Sepolia (no Ethereum mainnet leak),
 *     extensions list does NOT contain 'payment-identifier' (HC1
 *     regression), `upto` description spells out verify/settle asymmetry
 *     (HC11 regression).
 *   - POST /v1/verify: rate-limit, network allowlist enforcement at the
 *     boundary, Zod body validation, delegation to verifyExact /
 *     verifyUpto, scheme dispatch.
 *   - POST /v1/settle: rate-limit, network allowlist, Zod body, upto
 *     rejection (400 UNSUPPORTED_SCHEME), verify-failure (402),
 *     settle-failure (500), happy path, paymentIdentifier forward-compat
 *     accepted-but-not-plumbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCheckRateLimit,
  mockVerifyExactPayment,
  mockVerifyUptoPayment,
  mockSettleExactPayment,
} = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockVerifyExactPayment: vi.fn(),
  mockVerifyUptoPayment: vi.fn(),
  mockSettleExactPayment: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/middleware/cors', () => ({
  withCors: <T extends (...args: unknown[]) => unknown>(handler: T) => handler,
  OPTIONS: vi.fn(),
}))
vi.mock('@/lib/settlement/x402', () => ({
  verifyExactPayment: mockVerifyExactPayment,
  verifyUptoPayment: mockVerifyUptoPayment,
  settleExactPayment: mockSettleExactPayment,
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Imports happen AFTER vi.mock so the mocked modules are bound.
// The cors mock above replaces `withCors(handler)` with `handler` so
// the exported GET / POST functions are the bare route handlers in
// tests, no extra casting needed.
import { GET as SUPPORTED_GET } from '../x402/facilitator/v1/supported/route'
import { POST as VERIFY_POST } from '../x402/facilitator/v1/verify/route'
import { POST as SETTLE_POST } from '../x402/facilitator/v1/settle/route'
import { PUBLIC_FACILITATOR_NETWORKS } from '../x402/facilitator/v1/_shared'

beforeEach(() => {
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: 0 })
  mockVerifyExactPayment.mockResolvedValue({
    isValid: true,
    payer: '0xabc',
    network: 'eip155:8453',
  })
  mockVerifyUptoPayment.mockResolvedValue({
    isValid: true,
    payer: '0xdef',
    network: 'eip155:8453',
  })
  mockSettleExactPayment.mockResolvedValue({
    success: true,
    txHash: '0xfeedface',
    network: 'eip155:8453',
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

function makeGet(): NextRequest {
  return new NextRequest(
    'http://localhost:3005/api/x402/facilitator/v1/supported',
    {
      method: 'GET',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    },
  )
}

function makePost(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005/api/x402/facilitator/v1/${path}`, {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.1', 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const VALID_VERIFY_BODY = {
  paymentPayload: {
    scheme: 'exact' as const,
    network: 'eip155:8453',
    payload: { /* opaque to the route */ },
  },
}

const VALID_SETTLE_BODY = {
  paymentPayload: {
    scheme: 'exact' as const,
    network: 'eip155:8453',
    payload: {},
  },
}

// ─── /v1/supported ─────────────────────────────────────────────────────────

describe('GET /v1/supported', () => {
  it('returns 200 with the facilitator envelope shape', async () => {
    const res = await SUPPORTED_GET(makeGet())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.facilitator).toBe('SettleGrid')
    expect(body.version).toBe('1.0.0')
    expect(Array.isArray(body.schemes)).toBe(true)
    expect(Array.isArray(body.networks)).toBe(true)
    expect(Array.isArray(body.extensions)).toBe(true)
  })

  it('exposes ONLY Base mainnet + Base Sepolia on day one (HC: no ETH-mainnet leak)', async () => {
    const res = await SUPPORTED_GET(makeGet())
    const body = await res.json()
    const networkIds = body.networks.map((n: { network: string }) => n.network)
    expect(networkIds).toEqual(['eip155:8453', 'eip155:84532'])
    expect(networkIds).not.toContain('eip155:1') // no Ethereum mainnet
  })

  it('reports USDC asset metadata correctly for both networks', async () => {
    const res = await SUPPORTED_GET(makeGet())
    const body = await res.json()
    for (const net of body.networks) {
      expect(net.assetSymbol).toBe('USDC')
      expect(net.assetDecimals).toBe(6)
      expect(net.asset).toMatch(/^0x[a-fA-F0-9]{40}$/)
    }
  })

  it('extensions list does NOT include payment-identifier (HC1 regression)', async () => {
    const res = await SUPPORTED_GET(makeGet())
    const body = await res.json()
    expect(body.extensions).toContain('offer-and-receipt')
    expect(body.extensions).not.toContain('payment-identifier')
  })

  it("upto scheme description spells out the verify/settle asymmetry (HC11 regression)", async () => {
    const res = await SUPPORTED_GET(makeGet())
    const body = await res.json()
    const upto = body.schemes.find((s: { scheme: string }) => s.scheme === 'upto')
    expect(upto).toBeDefined()
    // The description must make clear that settle currently 400s.
    expect(upto.description.toLowerCase()).toMatch(/verify/)
    expect(upto.description.toLowerCase()).toMatch(/settle/)
  })

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const res = await SUPPORTED_GET(makeGet())
    expect(res.status).toBe(429)
  })

  it('exports PUBLIC_FACILITATOR_NETWORKS as the verify+settle source of truth', () => {
    expect(PUBLIC_FACILITATOR_NETWORKS).toEqual(['eip155:8453', 'eip155:84532'])
  })
})

// ─── /v1/verify ────────────────────────────────────────────────────────────

describe('POST /v1/verify', () => {
  it('returns 200 + delegates exact-scheme to verifyExactPayment', async () => {
    const res = await VERIFY_POST(makePost('verify', VALID_VERIFY_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isValid).toBe(true)
    expect(mockVerifyExactPayment).toHaveBeenCalledTimes(1)
    expect(mockVerifyUptoPayment).not.toHaveBeenCalled()
  })

  it('returns 200 + delegates upto-scheme to verifyUptoPayment', async () => {
    const res = await VERIFY_POST(
      makePost('verify', {
        paymentPayload: { ...VALID_VERIFY_BODY.paymentPayload, scheme: 'upto' },
      }),
    )
    expect(res.status).toBe(200)
    expect(mockVerifyUptoPayment).toHaveBeenCalledTimes(1)
    expect(mockVerifyExactPayment).not.toHaveBeenCalled()
  })

  it('returns 400 UNSUPPORTED_NETWORK for non-allowlisted network (e.g., ETH mainnet)', async () => {
    const res = await VERIFY_POST(
      makePost('verify', {
        paymentPayload: {
          ...VALID_VERIFY_BODY.paymentPayload,
          network: 'eip155:1', // ETH mainnet — not in PUBLIC_FACILITATOR_NETWORKS
        },
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('UNSUPPORTED_NETWORK')
    expect(mockVerifyExactPayment).not.toHaveBeenCalled()
  })

  it('returns 422 when paymentPayload is missing (Zod boundary)', async () => {
    const res = await VERIFY_POST(makePost('verify', { foo: 'bar' }))
    expect(res.status).toBe(422)
  })

  it('returns 422 when scheme is not exact|upto', async () => {
    const res = await VERIFY_POST(
      makePost('verify', {
        paymentPayload: {
          scheme: 'magical',
          network: 'eip155:8453',
          payload: {},
        },
      }),
    )
    expect(res.status).toBe(422)
  })

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const res = await VERIFY_POST(makePost('verify', VALID_VERIFY_BODY))
    expect(res.status).toBe(429)
    expect(mockVerifyExactPayment).not.toHaveBeenCalled()
  })

  it('passes through the underlying isValid:false result without 4xx', async () => {
    // Failed verification is a 200 + envelope, not a 4xx — matches
    // the x402 v2 spec's "verify result lives in the body" pattern.
    mockVerifyExactPayment.mockResolvedValueOnce({
      isValid: false,
      invalidReason: 'nonce_used',
      errorCode: 'NONCE_ALREADY_USED',
    })
    const res = await VERIFY_POST(makePost('verify', VALID_VERIFY_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isValid).toBe(false)
    expect(body.invalidReason).toBe('nonce_used')
  })
})

// ─── /v1/settle ────────────────────────────────────────────────────────────

describe('POST /v1/settle', () => {
  it('returns 200 + txHash on the happy path (verify ok → settle ok)', async () => {
    const res = await SETTLE_POST(makePost('settle', VALID_SETTLE_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.txHash).toBe('0xfeedface')
    expect(body.network).toBe('eip155:8453')
    expect(mockVerifyExactPayment).toHaveBeenCalledTimes(1)
    expect(mockSettleExactPayment).toHaveBeenCalledTimes(1)
  })

  it('accepts paymentIdentifier in the body (forward-compat) without erroring', async () => {
    const res = await SETTLE_POST(
      makePost('settle', {
        ...VALID_SETTLE_BODY,
        paymentIdentifier: 'client-supplied-key-abc',
      }),
    )
    expect(res.status).toBe(200)
    // Field is accepted, currently NOT plumbed to settleExactPayment —
    // settleExactPayment only takes payload. Verified by checking the
    // mock was called with a single argument.
    expect(mockSettleExactPayment).toHaveBeenCalledTimes(1)
    const callArgs = mockSettleExactPayment.mock.calls[0]
    expect(callArgs).toHaveLength(1)
  })

  it('returns 400 UNSUPPORTED_NETWORK for non-allowlisted network', async () => {
    const res = await SETTLE_POST(
      makePost('settle', {
        paymentPayload: { ...VALID_SETTLE_BODY.paymentPayload, network: 'eip155:1' },
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('UNSUPPORTED_NETWORK')
    expect(mockVerifyExactPayment).not.toHaveBeenCalled()
    expect(mockSettleExactPayment).not.toHaveBeenCalled()
  })

  it('returns 400 UNSUPPORTED_SCHEME for upto (settle path not yet shipped)', async () => {
    const res = await SETTLE_POST(
      makePost('settle', {
        paymentPayload: { ...VALID_SETTLE_BODY.paymentPayload, scheme: 'upto' },
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('UNSUPPORTED_SCHEME')
    expect(mockSettleExactPayment).not.toHaveBeenCalled()
  })

  it('returns 402 PAYMENT_VERIFICATION_FAILED when verify says isValid:false', async () => {
    mockVerifyExactPayment.mockResolvedValueOnce({
      isValid: false,
      invalidReason: 'expired',
      errorCode: 'AUTHORIZATION_EXPIRED',
    })
    const res = await SETTLE_POST(makePost('settle', VALID_SETTLE_BODY))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('PAYMENT_VERIFICATION_FAILED')
    expect(mockSettleExactPayment).not.toHaveBeenCalled()
  })

  it('returns 500 SETTLEMENT_FAILED when settle returns success:false', async () => {
    mockSettleExactPayment.mockResolvedValueOnce({
      success: false,
      errorReason: 'rpc_error',
      errorCode: 'RPC_FAILURE',
    })
    const res = await SETTLE_POST(makePost('settle', VALID_SETTLE_BODY))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('SETTLEMENT_FAILED')
  })

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: 0,
    })
    const res = await SETTLE_POST(makePost('settle', VALID_SETTLE_BODY))
    expect(res.status).toBe(429)
    expect(mockVerifyExactPayment).not.toHaveBeenCalled()
    expect(mockSettleExactPayment).not.toHaveBeenCalled()
  })

  it('returns 422 on missing paymentPayload (Zod boundary)', async () => {
    const res = await SETTLE_POST(makePost('settle', {}))
    expect(res.status).toBe(422)
  })

  it('returns 500 internal error when settleExactPayment throws unexpectedly', async () => {
    mockSettleExactPayment.mockRejectedValueOnce(new Error('boom'))
    const res = await SETTLE_POST(makePost('settle', VALID_SETTLE_BODY))
    expect(res.status).toBe(500)
  })

  it('uses the default reason string when verify returns isValid:false without invalidReason', async () => {
    // Defensive ?? fallback in route.ts — covers the case where the
    // underlying verifyExactPayment returns a result missing invalidReason.
    mockVerifyExactPayment.mockResolvedValueOnce({ isValid: false })
    const res = await SETTLE_POST(makePost('settle', VALID_SETTLE_BODY))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.error).toBe('Payment verification failed')
  })

  it('uses the default reason string when settle returns success:false without errorReason', async () => {
    mockSettleExactPayment.mockResolvedValueOnce({ success: false })
    const res = await SETTLE_POST(makePost('settle', VALID_SETTLE_BODY))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Settlement failed')
  })

  it('falls back to "unknown" IP when x-forwarded-for header is absent', async () => {
    // Defensive ?? 'unknown' fallback for the rate-limit key — covers
    // the case where Vercel hasn't injected the XFF header.
    const req = new NextRequest(
      'http://localhost:3005/api/x402/facilitator/v1/settle',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_SETTLE_BODY),
      },
    )
    const res = await SETTLE_POST(req)
    // Should still reach the rate-limit + happy path; no XFF doesn't 500.
    expect(res.status).toBe(200)
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'x402-facilitator-settle:unknown-ip',
    )
  })
})
