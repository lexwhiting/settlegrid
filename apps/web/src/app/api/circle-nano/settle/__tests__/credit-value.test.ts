/**
 * (V-N2b) — kernel /api/circle-nano/settle CREDIT-VALUE pin.
 *
 * The kernel facilitator route credits the developer balance for the USDC a
 * circle-nano authorization just settled on-chain. V-N2b makes that credit pay
 * the ACTUALLY-collected value the orchestrator resolved (`outcome.creditCents`)
 * — fresh-submit == costCents; recovery-confirm == the PRIOR broadcast's recorded
 * value, which a re-sign at a changed price can make ≠ costCents — or DEFER when
 * the recorded value is absent / unconvertible (`creditCents == null`).
 *
 * This suite is deliberately NON-VACUOUS: the recovery test sets
 * creditCents (30) ≠ costCents (50) and asserts the credit fires for 30, NOT 50
 * (a route still reading `costCents` would credit 50 and fail here). The defer
 * test asserts NO credit at all. The crypto/orchestration lives in
 * lib/settlement/circle-nano/__tests__/settle.test.ts; here we mock the
 * orchestrator + creditSettlement and pin the ROUTE's credit wiring.
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
  mockDb: { select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn() },
  mockCheckRateLimit: vi.fn(),
  mockIsCircleNanoKernelEnabled: vi.fn(),
  mockIsX402TestnetAllowed: vi.fn(),
  mockValidate: vi.fn(),
  mockExecute: vi.fn(),
  mockCredit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: { id: 'id', name: 'name', slug: 'slug', status: 'status', pricingConfig: 'pricing_config', developerId: 'developer_id' },
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
vi.mock('@/lib/circle-nano-proxy', () => ({ validateCircleNanoCredentialString: mockValidate }))
vi.mock('@/lib/settlement/circle-nano/settle', () => ({
  executeCircleNanoSettlement: mockExecute,
  circleNanoOperationId: (proof: { network: string; authorization: { from: string; nonce: string } }) =>
    `circle-nano:${proof.network}:${proof.authorization.from.toLowerCase()}:${proof.authorization.nonce.toLowerCase()}`,
}))
vi.mock('@/lib/settlement/reconcile', () => ({ creditSettlement: mockCredit }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a: unknown, b: unknown) => ({ a, b })) }))

import { POST as settlePOST } from '@/app/api/circle-nano/settle/route'

const ACTIVE_TOOL = {
  id: 'tool-uuid-1',
  name: 'Demo Tool',
  slug: 'demo',
  status: 'active',
  pricingConfig: { defaultCostCents: 50 }, // costCents == 50
  developerId: 'dev-uuid-1',
}

function setTool(row: unknown | null) {
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.limit.mockResolvedValue(row === null ? [] : [row])
}

// A genuinely base64-decodable EIP-3009 proof so the REAL parseCircleNanoProof
// yields a parsed proof and the route reaches executeCircleNanoSettlement.
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
  toolSlug: 'demo',
  method: 'demo.invocation',
  handlerResult: { ok: true },
  latencyMs: 42,
  paymentContext: {
    protocol: 'circle-nano',
    payment: { type: 'nanopayment', proof: PARSEABLE_PROOF },
  },
}

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3005/api/circle-nano/settle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  mockIsCircleNanoKernelEnabled.mockReturnValue(true)
  mockIsX402TestnetAllowed.mockReturnValue(false)
  mockValidate.mockResolvedValue({ valid: true, payerAddress: '0xabc', amountUsdc: '500000' })
  mockCredit.mockResolvedValue(undefined)
  setTool(ACTIVE_TOOL)
})

describe('(V-N2b) POST /api/circle-nano/settle — credits the orchestrator-resolved value, or DEFERS', () => {
  it('fresh-submit (creditCents == costCents 50) → credits 50', async () => {
    mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xTX', creditCents: 50 })
    const res = await settlePOST(makeReq(SETTLE_ONCHAIN))
    expect(res.status).toBe(200)
    expect(mockCredit).toHaveBeenCalledTimes(1)
    expect(mockCredit).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 50, rail: 'circle-nano' }))
  })

  it('recovery-confirm (creditCents 30 ≠ costCents 50) → credits the RECORDED 30, NOT costCents (the over-credit vector closed)', async () => {
    mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xTX', creditCents: 30 })
    const res = await settlePOST(makeReq(SETTLE_ONCHAIN))
    expect(res.status).toBe(200)
    expect(mockCredit).toHaveBeenCalledTimes(1)
    const creditArg = mockCredit.mock.calls[0][0] as { amountCents: number }
    expect(creditArg.amountCents).toBe(30) // NON-VACUOUS: the recorded value, not 50
    expect(creditArg.amountCents).not.toBe(50)
  })

  it('recovery-confirm RAISE (creditCents 70 ≠ costCents 50) → credits the RECORDED 70 (the under-credit/short-pay vector closed)', async () => {
    mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xTX', creditCents: 70 })
    await settlePOST(makeReq(SETTLE_ONCHAIN))
    expect((mockCredit.mock.calls[0][0] as { amountCents: number }).amountCents).toBe(70)
  })

  it('§7.6 DEFER (creditCents null) → settles 200 but does NOT credit (the row stays unmarked → the sweep + reconciler backstop)', async () => {
    mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xTX', creditCents: null })
    const res = await settlePOST(makeReq(SETTLE_ONCHAIN))
    expect(res.status).toBe(200)
    expect(mockCredit).not.toHaveBeenCalled()
  })

  it('alreadySettled (concurrent-loser / idempotent hit) → never re-credits, even with a creditCents present', async () => {
    mockExecute.mockResolvedValue({ status: 'settled', txHash: '0xTX', alreadySettled: true, creditCents: 50 })
    await settlePOST(makeReq(SETTLE_ONCHAIN))
    expect(mockCredit).not.toHaveBeenCalled()
  })
})
