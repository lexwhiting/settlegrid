/**
 * P3.K4 A2 — circle-nano settlement ORCHESTRATOR tests.
 *
 * Funds-safety is the point: prove that a reverted / unconfirmed / not-submitted
 * authorization is NEVER recorded 'settled', that idempotency + recovery prevent
 * a double-charge, and that the write-ahead 'pending' row is written BEFORE the
 * on-chain submit. The pure on-chain engine is mocked here (its own viem-level
 * tests live in settle-engine.test.ts); the ledger + Redis are mocked so this is
 * a deterministic, network-free unit test of the orchestration branching.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSubmit,
  mockConfirm,
  mockFindRow,
  mockRecord,
  mockSettled,
  mockFailed,
  mockBroadcast,
  mockRedisSet,
  mockRedisDel,
} = vi.hoisted(() => ({
  mockSubmit: vi.fn(),
  mockConfirm: vi.fn(),
  mockFindRow: vi.fn(),
  mockRecord: vi.fn(),
  mockSettled: vi.fn(),
  mockFailed: vi.fn(),
  mockBroadcast: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
}))

vi.mock('../settle-engine', () => ({
  submitCircleNanoOnChain: mockSubmit,
  confirmCircleNanoTx: mockConfirm,
}))
vi.mock('../../ledger', () => ({
  recordSettlementEntry: mockRecord,
  findSettlementRow: mockFindRow,
  markSettlementSettled: mockSettled,
  markSettlementFailed: mockFailed,
  markSettlementBroadcast: mockBroadcast,
}))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ set: mockRedisSet, del: mockRedisDel }),
  tryRedis: async (fn: () => Promise<unknown>) => {
    try {
      return await fn()
    } catch {
      return null
    }
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { executeCircleNanoSettlement, circleNanoOperationId } from '../settle'
import type { CircleNanoProof } from '@settlegrid/mcp'

const PROOF: CircleNanoProof = {
  network: 'eip155:84532',
  authorization: {
    from: '0xAbCdEf0000000000000000000000000000000001',
    to: '0xReCiPiEnT000000000000000000000000000000002',
    value: '500000',
    validAfter: '0',
    validBefore: '9999999999',
    nonce: '0xNoNcE',
  },
  signature: '0x' + 'ab'.repeat(65),
}
const OP_ID = circleNanoOperationId(PROOF)
const LOCK_KEY = `circle-nano:settle:lock:${OP_ID}`
const PARAMS = { proof: PROOF, costCents: 50, accountId: 'dev-1', toolSlug: 'demo', method: 'm', latencyMs: 7 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFindRow.mockResolvedValue(null)
  mockRecord.mockResolvedValue(undefined)
  mockSettled.mockResolvedValue(true)
  mockFailed.mockResolvedValue(true)
  mockBroadcast.mockResolvedValue(true)
  mockRedisSet.mockResolvedValue('OK')
  mockRedisDel.mockResolvedValue(1)
})

describe('circleNanoOperationId', () => {
  it('is the stable network:from:nonce key with from + nonce lowercased', () => {
    expect(OP_ID).toBe(
      'circle-nano:eip155:84532:0xabcdef0000000000000000000000000000000001:0xnonce',
    )
  })
})

describe('executeCircleNanoSettlement — happy path', () => {
  it("submits, flips 'pending'→'settled' with the txHash, returns settled", async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xTX' })
    expect(mockSettled).toHaveBeenCalledWith(OP_ID, 'circle-nano', '0xTX')
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockRedisDel).toHaveBeenCalledWith(LOCK_KEY)
  })

  it('writes the write-ahead pending INTENT row BEFORE submitting on-chain', async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    await executeCircleNanoSettlement(PARAMS)
    expect(mockRecord).toHaveBeenCalledTimes(1)
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        invocationId: OP_ID,
        rail: 'circle-nano',
        protocol: 'circle-nano',
        amountCents: 50,
        currency: 'USDC',
        status: 'pending',
        externalRef: null,
        accountId: 'dev-1',
      }),
    )
    // Ordering: the pending row is durable before the irreversible on-chain submit.
    expect(mockRecord.mock.invocationCallOrder[0]).toBeLessThan(
      mockSubmit.mock.invocationCallOrder[0],
    )
  })
})

describe('executeCircleNanoSettlement — a reverted/unconfirmed tx is NEVER settled', () => {
  it("revert with the nonce FREE → 'failed' (no money moved), records the reverted txHash", async () => {
    mockSubmit.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: false })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_REVERTED', httpStatus: 402 })
    expect(mockFailed).toHaveBeenCalledWith(OP_ID, 'circle-nano', '0xREV')
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("revert with the nonce CONSUMED (concurrent settler) → 'pending' for reconcile, NOT failed", async () => {
    mockSubmit.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: true })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502 })
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'circle-nano', '0xREV')
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("timeout (broadcast-unconfirmed) → 'pending' with the broadcast txHash stored, NOT settled", async () => {
    mockSubmit.mockResolvedValue({ kind: 'broadcast-unconfirmed', txHash: '0xPEND', reason: 'timeout' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', txHash: '0xPEND' })
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'circle-nano', '0xPEND')
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("pre-check nonce-already-used → 'pending' for reconcile, no flip", async () => {
    mockSubmit.mockResolvedValue({ kind: 'nonce-already-used' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION' })
    expect(mockSettled).not.toHaveBeenCalled()
    expect(mockFailed).not.toHaveBeenCalled()
  })

  it('insufficient balance → 402 but leaves the row PENDING (retryable after top-up, not bricked)', async () => {
    mockSubmit.mockResolvedValue({ kind: 'insufficient-balance', haveBaseUnits: '10', needBaseUnits: '500000' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'CIRCLE_NANO_INSUFFICIENT_FUNDS', httpStatus: 402 })
    expect(mockFailed).not.toHaveBeenCalled() // NOT terminally failed — the same auth can still settle later
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("submit-error (gas wallet) → 'pending' 503, row left pending (NOT failed)", async () => {
    mockSubmit.mockResolvedValue({ kind: 'submit-error', code: 'GAS_WALLET_INSUFFICIENT', reason: 'out of gas funds' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_GAS_WALLET_INSUFFICIENT', httpStatus: 503 })
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockSettled).not.toHaveBeenCalled()
    expect(mockBroadcast).not.toHaveBeenCalled()
  })
})

describe('executeCircleNanoSettlement — idempotency & locking (no double-charge)', () => {
  it('already-settled row → returns the recorded txHash, NEVER re-submits', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'settled', externalRef: '0xPREV' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xPREV' })
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
    expect(mockRedisSet).not.toHaveBeenCalled()
  })

  it("previously-failed row → terminal 'failed', no re-submit", async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'failed', externalRef: null })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_PREVIOUSLY_FAILED' })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('lock not acquired (concurrent settle in flight) → 409 pending, no submit, does not delete the lock', async () => {
    mockRedisSet.mockResolvedValue(null)
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_IN_PROGRESS', httpStatus: 409 })
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
    expect(mockRedisDel).not.toHaveBeenCalled() // must NOT delete a lock held by another request
  })

  it('Redis down (tryRedis→null) → proceeds unlocked (on-chain nonce is the backstop)', async () => {
    mockRedisSet.mockRejectedValue(new Error('redis unavailable'))
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xTX' })
    expect(mockSubmit).toHaveBeenCalledTimes(1)
  })

  it('concurrent winner already settled (flip is a no-op) → returns the winner txHash', async () => {
    mockFindRow
      .mockResolvedValueOnce(null) // step 1 idempotency read
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'settled', externalRef: '0xWINNER' }) // post-failed-flip read
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xLOSER' })
    mockSettled.mockResolvedValue(false) // row was no longer 'pending'
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xWINNER' })
  })
})

describe('executeCircleNanoSettlement — timeout recovery (re-wait, do not re-submit)', () => {
  it('pending row with a stored broadcast tx that now confirms → settled WITHOUT re-submitting', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xBROADCAST' })
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xBROADCAST' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xBROADCAST' })
    expect(mockConfirm).toHaveBeenCalledWith(PROOF, '0xBROADCAST')
    expect(mockSettled).toHaveBeenCalledWith(OP_ID, 'circle-nano', '0xBROADCAST')
    expect(mockSubmit).not.toHaveBeenCalled() // no fresh submit
  })

  it('clean revert with the nonce FREE (stored tx definitively failed) → falls through to a fresh submit', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xDROPPED' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xDROPPED', nonceConsumed: false })
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xFRESH' })
    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockSubmit).toHaveBeenCalledTimes(1)
    expect(mockSettled).toHaveBeenLastCalledWith(OP_ID, 'circle-nano', '0xFRESH')
  })

  it('stored tx still in-flight (unconfirmed) → stays pending, does NOT re-broadcast', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xINFLIGHT' })
    mockConfirm.mockResolvedValue({ kind: 'broadcast-unconfirmed', txHash: '0xINFLIGHT', reason: 'timeout' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION' })
    expect(mockSubmit).not.toHaveBeenCalled() // no duplicate broadcast while the prior tx may still confirm
  })

  it('stored tx reverted but the nonce is CONSUMED (concurrent settler) → pending, does NOT re-broadcast', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xREV' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: true })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending' })
    expect(mockSubmit).not.toHaveBeenCalled()
  })
})
