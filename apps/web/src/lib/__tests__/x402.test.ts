import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted mock values ────────────────────────────────────────────────────

const { mockReadContract, mockVerifyExact, mockVerifyUpto, mockSettleExact } = vi.hoisted(() => {
  return {
    mockReadContract: vi.fn(),
    mockVerifyExact: vi.fn(),
    mockVerifyUpto: vi.fn(),
    mockSettleExact: vi.fn(),
  }
})

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
  })),
  http: vi.fn(),
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
  baseSepolia: { id: 84532 },
  mainnet: { id: 1 },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  sdkLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 }),
}))

vi.mock('@/lib/middleware/cors', () => ({
  withCors: (handler: (req: NextRequest) => Promise<Response>) => handler,
  OPTIONS: vi.fn(),
}))

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import {
  USDC_ADDRESSES,
  PERMIT2_ADDRESSES,
  type X402Scheme,
  type X402ExactPayload,
  type X402UptoPayload,
} from '@/lib/settlement/x402/types'
import { verifyExactPayment, verifyUptoPayment } from '@/lib/settlement/x402/verify'
import { X402Adapter } from '@/lib/settlement/adapters/x402'
import type { SettlementResult } from '@/lib/settlement/types'

// ─── x402 Types ─────────────────────────────────────────────────────────────

describe('x402 Types', () => {
  it('USDC_ADDRESSES has entry for Base mainnet', () => {
    expect(USDC_ADDRESSES['eip155:8453']).toBeDefined()
  })

  it('USDC_ADDRESSES has entry for Base Sepolia', () => {
    expect(USDC_ADDRESSES['eip155:84532']).toBeDefined()
  })

  it('USDC_ADDRESSES has entry for Ethereum mainnet', () => {
    expect(USDC_ADDRESSES['eip155:1']).toBeDefined()
  })

  it('PERMIT2_ADDRESSES has entries for all networks', () => {
    expect(PERMIT2_ADDRESSES['eip155:8453']).toBeDefined()
    expect(PERMIT2_ADDRESSES['eip155:84532']).toBeDefined()
    expect(PERMIT2_ADDRESSES['eip155:1']).toBeDefined()
  })

  it('all addresses are valid hex format (0x, 42 chars)', () => {
    const allAddresses = [
      ...Object.values(USDC_ADDRESSES),
      ...Object.values(PERMIT2_ADDRESSES),
    ]
    for (const addr of allAddresses) {
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
  })

  it('X402Scheme includes exact and upto', () => {
    const schemes: X402Scheme[] = ['exact', 'upto']
    expect(schemes).toContain('exact')
    expect(schemes).toContain('upto')
    expect(schemes).toHaveLength(2)
  })
})

// ─── verifyExactPayment ─────────────────────────────────────────────────────

describe('verifyExactPayment', () => {
  const now = Math.floor(Date.now() / 1000)

  function makeExactPayload(overrides?: Partial<X402ExactPayload['payload']['authorization']> & { network?: string }): X402ExactPayload {
    const { network, ...authOverrides } = overrides ?? {}
    return {
      x402Version: 2,
      scheme: 'exact',
      network: (network ?? 'eip155:8453') as X402ExactPayload['network'],
      payload: {
        signature: '0x' + 'ab'.repeat(65) as `0x${string}`,
        authorization: {
          from: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          value: '1000000',
          validAfter: String(now - 600),
          validBefore: String(now + 600),
          nonce: '0x' + '00'.repeat(32) as `0x${string}`,
          ...authOverrides,
        },
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns invalid for unsupported network', async () => {
    const payload = makeExactPayload({ network: 'eip155:999' })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Unsupported network')
  })

  it('returns invalid when authorization not yet valid (validAfter in future)', async () => {
    const payload = makeExactPayload({ validAfter: String(now + 9999) })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('not yet valid')
  })

  it('returns invalid when authorization expired (validBefore in past)', async () => {
    const payload = makeExactPayload({ validBefore: String(now - 9999) })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('expired')
  })

  it('returns invalid when nonce already used', async () => {
    // authorizationState returns true -> nonce used
    mockReadContract.mockResolvedValueOnce(true)
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('nonce already used')
  })

  it('returns invalid when insufficient balance', async () => {
    // authorizationState returns false -> nonce not used
    mockReadContract.mockResolvedValueOnce(false)
    // balanceOf returns less than required
    mockReadContract.mockResolvedValueOnce(BigInt(500000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Insufficient USDC balance')
  })

  it('returns valid when all checks pass', async () => {
    // authorizationState returns false -> nonce not used
    mockReadContract.mockResolvedValueOnce(false)
    // balanceOf returns sufficient balance
    mockReadContract.mockResolvedValueOnce(BigInt(10000000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(true)
  })

  it('includes payer address in response', async () => {
    mockReadContract.mockResolvedValueOnce(false)
    mockReadContract.mockResolvedValueOnce(BigInt(10000000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.payer).toBe('0x1234567890abcdef1234567890abcdef12345678')
  })

  it('includes network in response', async () => {
    mockReadContract.mockResolvedValueOnce(false)
    mockReadContract.mockResolvedValueOnce(BigInt(10000000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.network).toBe('eip155:8453')
  })

  it('handles readContract errors gracefully (returns invalid, not throw)', async () => {
    mockReadContract.mockRejectedValueOnce(new Error('RPC call failed'))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Verification error')
  })

  it('returns payer and network even on time-related failures', async () => {
    const payload = makeExactPayload({ validBefore: String(now - 100) })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.payer).toBe('0x1234567890abcdef1234567890abcdef12345678')
    expect(result.network).toBe('eip155:8453')
  })
})

// ─── verifyUptoPayment ──────────────────────────────────────────────────────

describe('verifyUptoPayment', () => {
  const now = Math.floor(Date.now() / 1000)

  function makeUptoPayload(overrides?: {
    network?: string
    deadline?: string
    permittedAmount?: string
    witnessAmount?: string
  }): X402UptoPayload {
    return {
      x402Version: 2,
      scheme: 'upto',
      network: (overrides?.network ?? 'eip155:8453') as X402UptoPayload['network'],
      payload: {
        signature: '0x' + 'cd'.repeat(65) as `0x${string}`,
        permit: {
          permitted: {
            token: USDC_ADDRESSES['eip155:8453'],
            amount: overrides?.permittedAmount ?? '5000000',
          },
          nonce: '1',
          deadline: overrides?.deadline ?? String(now + 600),
        },
        witness: {
          recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          amount: overrides?.witnessAmount ?? '1000000',
        },
        transferDetails: {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          requestedAmount: overrides?.witnessAmount ?? '1000000',
        },
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns invalid for unsupported network', async () => {
    const payload = makeUptoPayload({ network: 'eip155:999' })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Unsupported network')
  })

  it('returns invalid when deadline expired', async () => {
    const payload = makeUptoPayload({ deadline: String(now - 100) })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('deadline expired')
  })

  it('returns invalid when witness amount exceeds permitted', async () => {
    const payload = makeUptoPayload({
      permittedAmount: '1000000',
      witnessAmount: '5000000',
    })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('exceeds permitted')
  })

  it('returns valid when checks pass', async () => {
    const payload = makeUptoPayload()
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(true)
  })

  it('handles BigInt parsing correctly', async () => {
    const payload = makeUptoPayload({
      permittedAmount: '999999999999',
      witnessAmount: '100000000000',
    })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(true)
    expect(result.network).toBe('eip155:8453')
  })

  it('handles errors gracefully', async () => {
    const payload: X402UptoPayload = {
      x402Version: 2,
      scheme: 'upto',
      network: 'eip155:8453',
      payload: {
        signature: '0xabc' as `0x${string}`,
        permit: {
          permitted: {
            token: USDC_ADDRESSES['eip155:8453'],
            amount: 'not-a-number',
          },
          nonce: '1',
          deadline: String(now + 600),
        },
        witness: {
          recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          amount: '1000000',
        },
        transferDetails: {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          requestedAmount: '1000000',
        },
      },
    }
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Verification error')
  })
})

// ─── X402Adapter ────────────────────────────────────────────────────────────

describe('X402Adapter', () => {
  const adapter = new X402Adapter()

  describe('properties', () => {
    it('name is x402', () => {
      expect(adapter.name).toBe('x402')
    })

    it('displayName is x402 Protocol (Coinbase)', () => {
      expect(adapter.displayName).toBe('x402 Protocol (Coinbase)')
    })
  })

  describe('canHandle', () => {
    it('returns true for payment-signature header', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': 'base64payload' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-settlegrid-protocol: x402', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'x-settlegrid-protocol': 'x402' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns false for no x402 indicators', () => {
      const req = new Request('http://localhost/api/x402/verify')
      expect(adapter.canHandle(req)).toBe(false)
    })

    it('returns false when protocol header has different value', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'x-settlegrid-protocol': 'mcp' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    function makeBase64Payload(data: Record<string, unknown>): string {
      return Buffer.from(JSON.stringify(data)).toString('base64')
    }

    it('parses base64 PAYMENT-SIGNATURE header', async () => {
      const payloadData = {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: {
          authorization: {
            from: '0x1234567890abcdef1234567890abcdef12345678',
          },
        },
      }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('x402')
      expect(ctx.identity.value).toBe('0x1234567890abcdef1234567890abcdef12345678')
    })

    it('throws on missing header', async () => {
      const req = new Request('http://localhost/api/x402/verify')
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow(
        'Missing PAYMENT-SIGNATURE header'
      )
    })

    it('throws on invalid base64', async () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': '!!!not-valid-base64!!!' },
      })
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow(
        'Invalid base64'
      )
    })

    it('sets protocol to x402', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('x402')
    })

    it('sets payment type to eip3009 for exact scheme', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('eip3009')
    })

    it('sets payment type to permit2 for upto scheme', async () => {
      const payloadData = { scheme: 'upto', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('permit2')
    })

    it('uses x-request-id when present', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: {
          'payment-signature': makeBase64Payload(payloadData),
          'x-request-id': 'custom-id-789',
        },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.requestId).toBe('custom-id-789')
    })
  })

  describe('formatResponse', () => {
    it('returns JSON with success fields', async () => {
      const result: SettlementResult = {
        status: 'settled',
        operationId: 'op-x402-001',
        costCents: 10,
        txHash: '0xabc123',
        metadata: {
          protocol: 'x402',
          latencyMs: 150,
          settlementType: 'real-time',
        },
      }
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.txHash).toBe('0xabc123')
      expect(body.operationId).toBe('op-x402-001')
      expect(body.metadata.protocol).toBe('x402')
    })
  })

  describe('formatError', () => {
    it('returns 402 for payment errors', () => {
      const error = new Error('payment insufficient balance')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(402)
    })

    it('returns 500 for generic errors', () => {
      const error = new Error('Something unexpected broke')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(500)
    })

    it('includes error code in response body', async () => {
      const error = new Error('Something unexpected')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      const body = await res.json()
      expect(body.error.code).toBe('SERVER_ERROR')
      expect(body.error.message).toBe('Something unexpected')
    })
  })
})

// ─── API route: GET /api/x402/supported ──────────────────────────────────────

describe('GET /api/x402/supported', () => {
  // We need to lazy-import the route handler to pick up the mocks above
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/x402/supported/route')
    GET = mod.GET
  })

  function createRequest(): NextRequest {
    return new NextRequest('http://localhost:3005/api/x402/supported', {
      method: 'GET',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
  }

  it('returns facilitator info', async () => {
    const res = await GET(createRequest())
    const data = await res.json()
    expect(data.facilitator).toBe('SettleGrid')
    expect(data.version).toBe('1.0.0')
  })

  it('returns supported schemes', async () => {
    const res = await GET(createRequest())
    const data = await res.json()
    expect(data.schemes).toHaveLength(2)
    expect(data.schemes[0].scheme).toBe('exact')
    expect(data.schemes[1].scheme).toBe('upto')
  })

  it('returns network list with USDC addresses', async () => {
    const res = await GET(createRequest())
    const data = await res.json()
    expect(data.networks.length).toBeGreaterThanOrEqual(3)
    for (const net of data.networks) {
      expect(net.assetSymbol).toBe('USDC')
      expect(net.assetDecimals).toBe(6)
      expect(net.asset).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
  })
})

// ─── API routes: POST /api/x402/verify and /api/x402/settle ─────────────────

describe('POST /api/x402/verify', () => {
  // Mock the actual verify functions at the module level for route tests
  vi.mock('@/lib/settlement/x402', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/settlement/x402')>()
    return {
      ...actual,
      verifyExactPayment: mockVerifyExact,
      verifyUptoPayment: mockVerifyUpto,
      settleExactPayment: mockSettleExact,
    }
  })

  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/x402/verify/route')
    POST = mod.POST as unknown as (req: NextRequest) => Promise<Response>
  })

  function createVerifyRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3005/api/x402/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify(body),
    })
  }

  it('returns isValid for valid payload', async () => {
    mockVerifyExact.mockResolvedValueOnce({
      isValid: true,
      payer: '0x1234567890abcdef1234567890abcdef12345678',
      network: 'eip155:8453',
    })

    const req = createVerifyRequest({
      paymentPayload: {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: { signature: '0xabc', authorization: {} },
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.isValid).toBe(true)
  })

  it('returns 422 for invalid scheme', async () => {
    const req = createVerifyRequest({
      paymentPayload: {
        scheme: 'unknown_scheme',
        network: 'eip155:8453',
        payload: {},
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('dispatches to verifyUptoPayment for upto scheme', async () => {
    mockVerifyUpto.mockResolvedValueOnce({
      isValid: true,
      network: 'eip155:8453',
    })

    const req = createVerifyRequest({
      paymentPayload: {
        scheme: 'upto',
        network: 'eip155:8453',
        payload: { permit: {}, witness: {} },
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.isValid).toBe(true)
    expect(mockVerifyUpto).toHaveBeenCalled()
  })
})

describe('POST /api/x402/settle', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/x402/settle/route')
    POST = mod.POST as unknown as (req: NextRequest) => Promise<Response>
  })

  function createSettleRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3005/api/x402/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify(body),
    })
  }

  it('returns 400 for upto scheme', async () => {
    const req = createSettleRequest({
      paymentPayload: {
        scheme: 'upto',
        network: 'eip155:8453',
        payload: {},
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.code).toBe('UNSUPPORTED_SCHEME')
  })

  it('returns 402 when verification fails', async () => {
    mockVerifyExact.mockResolvedValueOnce({
      isValid: false,
      invalidReason: 'Authorization expired',
    })

    const req = createSettleRequest({
      paymentPayload: {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: { signature: '0xabc', authorization: {} },
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(402)
    expect(data.code).toBe('PAYMENT_VERIFICATION_FAILED')
    expect(data.error).toContain('Authorization expired')
  })

  it('returns success with txHash when settlement succeeds', async () => {
    mockVerifyExact.mockResolvedValueOnce({ isValid: true })
    mockSettleExact.mockResolvedValueOnce({
      success: true,
      txHash: '0xdeadbeef1234567890',
      network: 'eip155:8453',
    })

    const req = createSettleRequest({
      paymentPayload: {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: { signature: '0xabc', authorization: {} },
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.txHash).toBe('0xdeadbeef1234567890')
  })
})

describe('x402 route maxDuration exports', () => {
  it('verify route has maxDuration = 30', async () => {
    const mod = await import('@/app/api/x402/verify/route')
    expect(mod.maxDuration).toBe(30)
  })

  it('settle route has maxDuration = 60', async () => {
    const mod = await import('@/app/api/x402/settle/route')
    expect(mod.maxDuration).toBe(60)
  })

  it('supported route has maxDuration = 30', async () => {
    const mod = await import('@/app/api/x402/supported/route')
    expect(mod.maxDuration).toBe(30)
  })
})
