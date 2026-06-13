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
  mockRefresh,
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
  mockRefresh: vi.fn(),
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
  // (V) — the raise-only validBefore refresh (R1-B4/R2-B5b).
  refreshPendingValidBefore: mockRefresh,
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
// Mocked above — imported for the (T)-seal funds-critical alert assertion.
import { logger } from '@/lib/logger'

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
const PARAMS = { proof: PROOF, costCents: 50, accountId: 'dev-1', toolId: 'tool-1', toolSlug: 'demo', method: 'm', latencyMs: 7 }

beforeEach(() => {
  vi.clearAllMocks()
  mockFindRow.mockResolvedValue(null)
  mockRecord.mockResolvedValue(undefined)
  mockSettled.mockResolvedValue(true)
  mockFailed.mockResolvedValue(true)
  mockBroadcast.mockResolvedValue(true)
  mockRefresh.mockResolvedValue(true)
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
        // Part B: the owning tool rides in metadata (JSONB) for the reconciler tail.
        metadata: expect.objectContaining({ toolId: 'tool-1' }),
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
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'circle-nano', '0xREV', null) // (V) P8-e 4th arg
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("timeout (broadcast-unconfirmed) → 'pending' with the broadcast txHash stored, NOT settled", async () => {
    mockSubmit.mockResolvedValue({ kind: 'broadcast-unconfirmed', txHash: '0xPEND', reason: 'timeout' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', txHash: '0xPEND' })
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'circle-nano', '0xPEND', null) // (V) P8-e 4th arg
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
    expect(outcome).toEqual({ status: 'settled', txHash: '0xPREV', alreadySettled: true })
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
    expect(outcome).toEqual({ status: 'settled', txHash: '0xWINNER', alreadySettled: true })
    // a SETTLED winner is the benign race — no funds-critical alert.
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith(
      'settlement.settled_evidence_on_terminal_failed_row',
      expect.anything(),
    )
  })

  it("(T seal) SUCCESS receipt but the row is terminally FAILED (the P2 mirror window: a reconciler revert-flip landed during our resubmit gap) → funds-critical alert; outcome still alreadySettled (no auto-credit — manual runbook path)", async () => {
    mockFindRow
      .mockResolvedValueOnce(null) // step 1 idempotency read
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'failed', externalRef: '0xH1' }) // re-read: terminal FAILED
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xH2' }) // OUR tx moved the USDC
    mockSettled.mockResolvedValue(false) // WHERE-pending no-match (row already failed)
    const outcome = await executeCircleNanoSettlement(PARAMS)
    // (V) P8-f LICENSED FLIP (was '0xH1' — the row's reverted stored ref): the mirror
    // branch now returns the WINNING hash we hold the receipt for (runbook §3's
    // authoritative hash). Captured red-pre-fix in .audit/v-build/.
    expect(outcome).toEqual({ status: 'settled', txHash: '0xH2', alreadySettled: true })
    // The ONLY actor that knows funds moved onto a failed row is THIS branch —
    // the settled-only sweep is blind to failed rows. The alert is the
    // detectability contract for this loss class (② seal HIGH).
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.settled_evidence_on_terminal_failed_row',
      expect.objectContaining({ operationId: OP_ID, rowStatus: 'failed', winningTxHash: '0xH2', storedRef: '0xH1' }),
    )
  })

  it('(T seal) broadcast write no-ops onto a terminally FAILED row → sibling alert AT BROADCAST TIME (covers the kill-mid-wait / receipt-timeout sub-schedules: the winning-candidate hash is on the record before any receipt)', async () => {
    mockFindRow
      .mockResolvedValueOnce(null) // step 1 idempotency read
      .mockResolvedValue({ id: '1', settlementStatus: 'failed', externalRef: '0xH1' }) // onBroadcast no-op re-read (default — no once-queue leak pre-fix)
    mockBroadcast.mockResolvedValue(false) // WHERE-pending no-match (mirror flip landed pre-broadcast)
    mockSubmit.mockImplementation(async (_proof: unknown, opts: { onBroadcast: (h: string) => Promise<void> }) => {
      await opts.onBroadcast('0xH2')
      return { kind: 'broadcast-unconfirmed', txHash: '0xH2', reason: 'timeout' } // receipt never observed
    })
    await executeCircleNanoSettlement(PARAMS)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.broadcast_evidence_on_terminal_failed_row',
      expect.objectContaining({ operationId: OP_ID, rowStatus: 'failed', broadcastTxHash: '0xH2', storedRef: '0xH1' }),
    )
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

// ─── (V) pending-row lifecycle faces (P5-i, P8-a/e/f, 3e, R2-B5b) ───────────────────────
describe('(V) executeCircleNanoSettlement — pending-row lifecycle', () => {
  beforeEach(() => {
    // vi.clearAllMocks does NOT clear mockResolvedValueOnce queues — leaked Once
    // entries from prior tests would silently re-route the Once-queue recipes
    // below (the R-V8b discipline). Hard-reset the queue-bearing mocks here.
    mockFindRow.mockReset()
    mockFindRow.mockResolvedValue(null)
    mockRefresh.mockReset()
    mockRefresh.mockResolvedValue(true)
    mockFailed.mockReset()
    mockFailed.mockResolvedValue(true)
  })

  it('R-V7: the write-ahead row stores the CANONICAL validBefore and the refresh is called with the same value', async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    await executeCircleNanoSettlement(PARAMS)
    const recorded = mockRecord.mock.calls[0][0]
    expect(recorded.metadata.validBefore).toBe(BigInt(PROOF.authorization.validBefore).toString(10))
    expect(mockRefresh).toHaveBeenCalledWith(OP_ID, 'circle-nano', BigInt(PROOF.authorization.validBefore).toString(10))
  })

  it('R-V7-hex: a hex validBefore (BigInt-verifier-acceptable) is stored/passed as the DECIMAL string', async () => {
    const hexProof = { ...PROOF, authorization: { ...PROOF.authorization, validBefore: '0x2540BE3FF' } }
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    await executeCircleNanoSettlement({ ...PARAMS, proof: hexProof })
    const recorded = mockRecord.mock.calls[0][0]
    expect(recorded.metadata.validBefore).toBe('9999999999') // BigInt('0x2540BE3FF').toString(10)
    const hexOp = circleNanoOperationId(hexProof)
    expect(mockRefresh).toHaveBeenCalledWith(hexOp, 'circle-nano', '9999999999')
  })

  it('R-V8: the recovery resubmit re-checks terminality IMMEDIATELY pre-submit and aborts on a failed row (P8-a — shrinks the mirror window)', async () => {
    mockFindRow
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'pending', externalRef: '0xDROPPED' }) // step-1 read
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'failed', externalRef: '0xDROPPED' }) // P8-a re-read: terminal
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xDROPPED', nonceConsumed: false }) // definitively failed
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_PREVIOUSLY_FAILED', httpStatus: 402 })
  })

  it('R-V8-settled: the P8-a re-read finding SETTLED aborts with alreadySettled (flip winner already credited)', async () => {
    mockFindRow
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'pending', externalRef: '0xDROPPED' })
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'settled', externalRef: '0xWINNER' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xDROPPED', nonceConsumed: false })
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toEqual({ status: 'settled', txHash: '0xWINNER', alreadySettled: true })
  })

  it('R-V8b: a FALSE refresh (row terminal in the read-to-refresh sliver — incl. the expiry flip) aborts BEFORE any broadcast (R2-B5b)', async () => {
    mockFindRow
      .mockResolvedValueOnce(null) // step-1 idempotency read: no row yet
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'failed', externalRef: null }) // the abort re-read
    mockRefresh.mockResolvedValueOnce(false)
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_PREVIOUSLY_FAILED' })
  })

  it('R-V8b-settled: refresh-false + re-read SETTLED → settled alreadySettled, no submit', async () => {
    mockFindRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'settled', externalRef: '0xWINNER' })
    mockRefresh.mockResolvedValueOnce(false)
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toEqual({ status: 'settled', txHash: '0xWINNER', alreadySettled: true })
  })

  it('R-V8b-null: refresh-false + re-read NULL row → failed-shaped outcome, no submit (totality)', async () => {
    mockFindRow.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    mockRefresh.mockResolvedValueOnce(false)
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ status: 'failed' })
  })

  it("R-V9b: a CAS-rejected failed-flip on a STILL-PENDING row returns PENDING (the live twin of the reconciler's pending-stale-ref — the ③-(U) F2 fold), not the 402 'failed' lie", async () => {
    mockFindRow
      .mockResolvedValueOnce(null) // step-1
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'pending', externalRef: '0xNEW' }) // 3e re-read
    mockSubmit.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: false })
    mockFailed.mockResolvedValue(false) // the (T) CAS rejected (stale ref)
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502 })
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'circle_nano.settle_reverted_stale_ref',
      expect.objectContaining({ operationId: OP_ID }),
    )
  })

  it('R-V9b-terminal: a CAS-rejected failed-flip on an already-FAILED row keeps the truthful 402', async () => {
    mockFindRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'failed', externalRef: '0xREV' })
    mockSubmit.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: false })
    mockFailed.mockResolvedValue(false)
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_REVERTED', httpStatus: 402 })
  })

  it('R-V10: onBroadcast threads the step-1 ref as expectedPrior (the recovery T1→T2 re-point stays legal; P8-e wiring)', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xT1' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xT1', nonceConsumed: false }) // definitively failed → fresh submit
    mockSubmit.mockImplementation(async (_proof: unknown, opts: { onBroadcast: (h: string) => Promise<void> }) => {
      await opts.onBroadcast('0xT2')
      return { kind: 'settled', txHash: '0xT2' }
    })
    await executeCircleNanoSettlement(PARAMS)
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'circle-nano', '0xT2', '0xT1')
  })

  it('R-V11: a recovery confirm returning broadcast-unconfirmed/revert-nonce-unverifiable (P8(g) face) stays pending with NO fresh submit — passes pre+post', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xT1' })
    mockConfirm.mockResolvedValue({ kind: 'broadcast-unconfirmed', txHash: '0xT1', reason: 'revert-nonce-unverifiable' })
    const outcome = await executeCircleNanoSettlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION' })
  })
})
