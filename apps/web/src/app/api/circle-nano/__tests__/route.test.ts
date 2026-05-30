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
  mockValidate,
  mockRecordSettlement,
} = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  },
  mockCheckRateLimit: vi.fn(),
  mockIsCircleNanoKernelEnabled: vi.fn(),
  mockValidate: vi.fn(),
  mockRecordSettlement: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: {
    name: 'name',
    slug: 'slug',
    status: 'status',
    pricingConfig: 'pricing_config',
    developerId: 'developer_id',
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/env', () => ({
  isCircleNanoKernelEnabled: mockIsCircleNanoKernelEnabled,
}))
vi.mock('@/lib/circle-nano-proxy', () => ({
  validateCircleNanoCredentialString: mockValidate,
}))
vi.mock('@/lib/settlement/ledger', () => ({
  recordSettlementEntryAsync: mockRecordSettlement,
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
}))

import { POST as verifyPOST } from '@/app/api/circle-nano/verify/route'
import { POST as settlePOST } from '@/app/api/circle-nano/settle/route'

const ACTIVE_TOOL = {
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

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({
    success: true,
    limit: 1000,
    remaining: 999,
    reset: 0,
  })
  mockIsCircleNanoKernelEnabled.mockReturnValue(true)
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
  it('returns a raw SettlementResult with batched settlementType + no txHash', async () => {
    mockValidate.mockResolvedValue({ valid: true, payerAddress: '0xabc', amountUsdc: '50000' })
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('settled')
    expect(typeof json.operationId).toBe('string')
    expect(json.operationId.length).toBeGreaterThan(0)
    expect(typeof json.costCents).toBe('number')
    expect(json.metadata.protocol).toBe('circle-nano')
    expect(json.metadata.settlementType).toBe('batched')
    expect(json.txHash).toBeUndefined()
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

  // ─── P3.K4 (A1) unified-ledger write ──────────────────────────────────
  it("records a 'pending' ledger entry keyed by a stable network:from:nonce id", async () => {
    const proof = Buffer.from(
      JSON.stringify({
        network: 'eip155:8453',
        authorization: {
          from: '0xAbCdEf0000000000000000000000000000000001',
          to: '0xRecipient',
          value: '500000',
          validAfter: '0',
          validBefore: '9999999999',
          nonce: '0xNoNcE',
        },
        signature: '0x' + 'ab'.repeat(65),
      }),
    ).toString('base64')
    mockValidate.mockResolvedValue({
      valid: true,
      payerAddress: '0xAbCdEf0000000000000000000000000000000001',
      amountUsdc: '500000',
    })

    const res = await settlePOST(
      makeReq('/api/circle-nano/settle', {
        ...SETTLE_ENVELOPE,
        paymentContext: {
          protocol: 'circle-nano',
          payment: { type: 'nanopayment', proof },
        },
      }),
    )

    expect(res.status).toBe(200)
    expect(mockRecordSettlement).toHaveBeenCalledTimes(1)
    expect(mockRecordSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        // from + nonce lowercased; NOT the random SettlementResult.operationId
        invocationId:
          'circle-nano:eip155:8453:0xabcdef0000000000000000000000000000000001:0xnonce',
        rail: 'circle-nano',
        protocol: 'circle-nano',
        amountCents: 50,
        currency: 'USDC',
        takeBps: 0,
        status: 'pending',
        externalRef: null,
        accountId: 'dev-uuid-1',
      }),
    )
  })

  it('does NOT write the ledger when costCents resolves to 0', async () => {
    setTool({ ...ACTIVE_TOOL, pricingConfig: null })
    mockValidate.mockResolvedValue({ valid: true, payerAddress: '0xabc', amountUsdc: '0' })
    const res = await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(200)
    expect(mockRecordSettlement).not.toHaveBeenCalled()
  })

  it('does NOT write the ledger when settle-time re-verification fails', async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      error: { code: 'CIRCLE_NANO_EXPIRED', message: 'expired' },
    })
    await settlePOST(makeReq('/api/circle-nano/settle', SETTLE_ENVELOPE))
    expect(mockRecordSettlement).not.toHaveBeenCalled()
  })

  it('does NOT write the ledger when the proof is unparseable (defensive skip)', async () => {
    // verification passes (mocked) but the proof can't be parsed into a
    // network:from:nonce key — skip the write rather than throw on the hot path.
    mockValidate.mockResolvedValue({ valid: true, payerAddress: '0xabc', amountUsdc: '500000' })
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
    expect(mockRecordSettlement).not.toHaveBeenCalled()
  })
})
