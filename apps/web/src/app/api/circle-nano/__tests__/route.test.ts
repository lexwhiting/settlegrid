/**
 * P5 — integration tests for the Circle Nano facilitator routes
 * (/api/circle-nano/verify, /api/circle-nano/settle).
 *
 * These routes are the kernel→facilitator destination for circle-nano in the
 * self-hosted SDK model. Tests mock the DB (tool lookup), env enablement, rate
 * limiter, and the credential validator so the focus is the ROUTE contract:
 * envelope parsing, server-authoritative tool/cost lookup, and the raw
 * `{ valid }` / SettlementResult shapes the kernel expects. The offline
 * EIP-3009 crypto itself is covered in
 * apps/web/src/lib/settlement/circle-nano/__tests__/verify.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockCheckRateLimit,
  mockIsCircleNanoKernelEnabled,
  mockIsX402TestnetAllowed,
  mockValidate,
  mockExecute,
  mockCredit,
} = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  },
  mockCheckRateLimit: vi.fn(),
  mockIsCircleNanoKernelEnabled: vi.fn(),
  mockIsX402TestnetAllowed: vi.fn(),
  mockValidate: vi.fn(),
  mockExecute: vi.fn(),
  mockCredit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    status: 'status',
    pricingConfig: 'pricing_config',
    developerId: 'developer_id',
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/env', () => ({
  isCircleNanoKernelEnabled: mockIsCircleNanoKernelEnabled,
  X402_MAINNET_NETWORK: 'eip155:8453',
  isX402TestnetSettlementAllowed: mockIsX402TestnetAllowed,
}))
vi.mock('@/lib/circle-nano-proxy', () => ({
  validateCircleNanoCredentialString: mockValidate,
}))
vi.mock('@/lib/settlement/circle-nano/settle', () => ({
  executeCircleNanoSettlement: mockExecute,
  // pure helper — the route keys the credit by the stable operation_id; mirror it.
  circleNanoOperationId: (proof: { network: string; authorization: { from: string; nonce: string } }) =>
    `circle-nano:${proof.network}:${proof.authorization.from.toLowerCase()}:${proof.authorization.nonce.toLowerCase()}`,
}))
vi.mock('@/lib/settlement/reconcile', () => ({
  creditSettlement: mockCredit,
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
}))

import { POST as verifyPOST } from '@/app/api/circle-nano/verify/route'
import { POST as settlePOST } from '@/app/api/circle-nano/settle/route'

const ACTIVE_TOOL = {
  id: 'tool-uuid-1',
  name: 'Demo Tool',
  slug: 'demo',
  status: 'active',
  pricingConfig: { defaultCostCents: 50 },
  developerId: 'dev-uuid-1',
}

function setTool(row: unknown | null) {
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.limit.mockResolvedValue(row === null ? [] : [row])
}

function makeReq(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VERIFY_ENVELOPE = {
  toolSlug: 'demo',
  method: 'demo.invocation',
  paymentContext: {
    protocol: 'circle-nano',
    payment: { type: 'nanopayment', proof: 'eip3009-proof-blob' },
  },
}

const SETTLE_ENVELOPE = {
  ...VERIFY_ENVELOPE,
  handlerResult: { ok: true },
  latencyMs: 42,
}

// A genuinely base64-decodable proof so the route's parseCircleNanoProof (REAL,
// not mocked) yields a parsed proof and reaches executeCircleNanoSettlement.
const PARSEABLE_PROOF = Buffer.from(
  JSON.stringify({
    network: 'eip155:8453',
    authorization: {
      from: '0xAbCdEf0000000000000000000000000000000001',
      to: '0xReCiPiEnT000000000000000000000000000000002',
      value: '500000',
      validAfter: '0',
      validBefore: '9999999999',
      nonce: '0x' + 'cd'.repeat(32),
    },
    signature: '0x' + 'ab'.repeat(65),
  }),
).toString('base64')

const SETTLE_ONCHAIN = {
  ...VERIFY_ENVELOPE,
  handlerResult: { ok: true },
  latencyMs: 42,
  paymentContext: {
    protocol: 'circle-nano',
    payment: { type: 'nanopayment', proof: PARSEABLE_PROOF },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({
    success: true,
    limit: 1000,
    remaining: 999,
    reset: 0,
  })
  mockIsCircleNanoKernelEnabled.mockReturnValue(true)
  mockIsX402TestnetAllowed.mockReturnValue(false)
  mockValidate.mockResolvedValue({ valid: true, payerAddress: '0xabc', amountUsdc: '500000' })
  mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xONCHAINTX' })
  mockCredit.mockResolvedValue(undefined)
  setTool(ACTIVE_TOOL)
})

describe('POST /api/circle-nano/verify', () => {
  it('returns raw { valid: true } for a valid authorization', async () => {
    mockValidate.mockResolvedValue({ valid: true, payerAddress: '0xabc', amountUsdc: '50000' })
    const res = await verifyPOST(makeReq('/api/circle-nano/verify', VERIFY_ENVELOPE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(true)
  })

  it('resolves cost server-side and passes the proof + tool config to the validator', async () => {
    mockValidate.mockResolvedValue({ valid: true })
    await verifyPOST(makeReq('/api/circle-nano/verify', VERIFY_ENVELOPE))
    expect(mockValidate).toHaveBeenCalledWith(
      'eip3009-proof-blob',
      expect.objectContaining({ slug: 'demo', costCents: 50 }),
    )
  })

  it('returns { valid: false } + the validator error code on rejection (HTTP 200)', async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      error: { code: 'CIRCLE_NANO_WRONG_RECIPIENT', message: 'wrong payee' },
    })
    const res = await verifyPOST(makeReq('/api/circle-nano/verify', VERIFY_ENVELOPE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.code).toBe('CIRCLE_NANO_WRONG_RECIPIENT')
  })

  it('short-circuits with CIRCLE_NANO_NOT_CONFIGURED when the rail is disabled', async () => {
    mockIsCircleNanoKernelEnabled.mockReturnValue(false)
    const res = await verifyPOST(makeReq('/api/circle-nano/verify', VERIFY_ENVELOPE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.code).toBe('CIRCLE_NANO_NOT_CONFIGURED')
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('rejects an unknown / inactive tool without validating', async () => {
    setTool(null)
    const res = await verifyPOST(makeReq('/api/circle-nano/verify', VERIFY_ENVELOPE))
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.code).toBe('CIRCLE_NANO_API_ERROR')
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1, remaining: 0, reset: 0 })
    const res = await verifyPOST(makeReq('/api/circle-nano/verify', VERIFY_ENVELOPE))
    expect(res.status).toBe(429)
  })
})

describe('POST /api/circle-nano/settle', () => {
  it('on-chain settled → 200 with real-time settlementType + the txHash', async () => {
    mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xONCHAINTX' })
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ONCHAIN))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('settled')
    expect(json.metadata.protocol).toBe('circle-nano')
    expect(json.metadata.settlementType).toBe('real-time')
    expect(json.txHash).toBe('0xONCHAINTX')
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it('delegates to executeCircleNanoSettlement with the resolved cost, account, tool, and parsed proof', async () => {
    await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ONCHAIN))
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        costCents: 50,
        accountId: 'dev-uuid-1',
        toolId: 'tool-uuid-1',
        toolSlug: 'demo',
        method: 'demo.invocation',
        proof: expect.objectContaining({ network: 'eip155:8453' }),
      }),
    )
  })

  it('on a FRESH on-chain settle → credits the developer + tool exactly once, keyed by the stable operation_id (Part C)', async () => {
    mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xONCHAINTX' })
    await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ONCHAIN))
    expect(mockCredit).toHaveBeenCalledTimes(1)
    expect(mockCredit).toHaveBeenCalledWith(
      expect.objectContaining({
        developerId: 'dev-uuid-1',
        toolId: 'tool-uuid-1',
        amountCents: 50,
        operationId: expect.stringContaining('circle-nano:eip155:8453:'),
      }),
    )
  })

  it('a replay / concurrent-loser (alreadySettled) → settles 200 but does NOT re-credit (exactly-once)', async () => {
    mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xONCHAINTX', alreadySettled: true })
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ONCHAIN))
    expect(res.status).toBe(200)
    expect(mockCredit).not.toHaveBeenCalled()
  })

  it('F2: a Base SEPOLIA payload on a mainnet deploy → 402 NETWORK_UNSUPPORTED, never settles or credits', async () => {
    const sepoliaProof = Buffer.from(
      JSON.stringify({
        network: 'eip155:84532',
        authorization: {
          from: '0xAbCdEf0000000000000000000000000000000001',
          to: '0xReCiPiEnT000000000000000000000000000000002',
          value: '500000',
          validAfter: '0',
          validBefore: '9999999999',
          nonce: '0x' + 'cd'.repeat(32),
        },
        signature: '0x' + 'ab'.repeat(65),
      }),
    ).toString('base64')
    const res = await settlePOST(
      makeReq('/api/circle-nano/settle', {
        ...SETTLE_ONCHAIN,
        paymentContext: { protocol: 'circle-nano', payment: { type: 'nanopayment', proof: sepoliaProof } },
      }),
    )
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.code).toBe('CIRCLE_NANO_NETWORK_UNSUPPORTED')
    expect(mockExecute).not.toHaveBeenCalled()
    expect(mockCredit).not.toHaveBeenCalled()
  })

  it('reverted on-chain → 402 settlement error, NOT a settled result', async () => {
    mockExecute.mockResolvedValue({ status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_REVERTED', httpStatus: 402, reason: 'reverted' })
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ONCHAIN))
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.code).toBe('CIRCLE_NANO_SETTLEMENT_REVERTED')
  })

  it('unconfirmed/pending on-chain → 502 error, never settled', async () => {
    mockExecute.mockResolvedValue({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502, reason: 'unconfirmed' })
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ONCHAIN))
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.code).toBe('CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION')
  })

  it('free/unattributable (unparseable proof) → settled with NO txHash, no on-chain submit', async () => {
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('settled')
    expect(json.metadata.settlementType).toBe('real-time')
    expect(json.txHash).toBeUndefined()
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('returns 402 when re-verification fails at settle time', async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      error: { code: 'CIRCLE_NANO_EXPIRED', message: 'expired' },
    })
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.code).toBe('CIRCLE_NANO_EXPIRED')
  })

  it('returns 503 when the rail is disabled', async () => {
    mockIsCircleNanoKernelEnabled.mockReturnValue(false)
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(503)
  })

  it('returns 404 for an unknown / inactive tool', async () => {
    setTool(null)
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(404)
  })

  // ─── P3.K4 (A2) — on-chain settlement is gated on cost + attribution ───
  it('does NOT settle on-chain when costCents resolves to 0 (free tool)', async () => {
    setTool({ ...ACTIVE_TOOL, pricingConfig: null })
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ONCHAIN))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('settled')
    expect(json.txHash).toBeUndefined()
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('does NOT settle on-chain when settle-time re-verification fails', async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      error: { code: 'CIRCLE_NANO_EXPIRED', message: 'expired' },
    })
    await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ONCHAIN))
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('does NOT settle on-chain when the proof is unparseable (defensive skip)', async () => {
    // verification passes (mocked) but the proof can't be parsed into a
    // network:from:nonce key — skip the on-chain submit rather than throw.
    const res = await settlePOST(
      makeReq('/api/circle-nano/settle', {
        ...SETTLE_ENVELOPE,
        paymentContext: {
          protocol: 'circle-nano',
          payment: { type: 'nanopayment', proof: 'not-a-valid-proof-blob' },
        },
      }),
    )
    expect(res.status).toBe(200)
    expect(mockExecute).not.toHaveBeenCalled()
  })
})
