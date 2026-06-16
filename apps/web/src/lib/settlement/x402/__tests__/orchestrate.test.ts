/**
 * x402 (exact) settlement ORCHESTRATOR tests ("A2 for x402").
 *
 * Funds-safety is the point — the SAME invariants as circle-nano A2: a reverted /
 * unconfirmed / not-submitted authorization is NEVER recorded 'settled';
 * idempotency + recovery prevent a double-charge; the write-ahead 'pending' row
 * is written BEFORE the on-chain submit. PLUS the x402-specific guarantees: the
 * offline verifier is called with exactAmount=true (the x402 'exact' value==cost
 * rule), and a verify failure maps to an x402-flavored error. The shared engine +
 * verifier are mocked here (their own tests live alongside them); ledger + Redis
 * mocked → deterministic, network-free.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSubmit,
  mockConfirm,
  mockVerify,
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
  mockVerify: vi.fn(),
  mockFindRow: vi.fn(),
  mockRecord: vi.fn(),
  mockSettled: vi.fn(),
  mockFailed: vi.fn(),
  mockBroadcast: vi.fn(),
  mockRefresh: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
}))

vi.mock('../../circle-nano/settle-engine', () => ({
  submitCircleNanoOnChain: mockSubmit,
  confirmCircleNanoTx: mockConfirm,
}))
vi.mock('../../circle-nano/verify', () => ({
  verifyEip3009Authorization: mockVerify,
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

import { executeX402Settlement, x402OperationId } from '../orchestrate'
import type { X402ExactPayload } from '../types'
// Mocked above — imported for the (T)-seal funds-critical alert assertion.
import { logger } from '@/lib/logger'

const RECIPIENT = '0xReCiPiEnT000000000000000000000000000000002'
const PAYLOAD: X402ExactPayload = {
  x402Version: 2,
  scheme: 'exact',
  network: 'eip155:84532',
  payload: {
    signature: ('0x' + 'ab'.repeat(65)) as `0x${string}`,
    authorization: {
      from: '0xAbCdEf0000000000000000000000000000000001',
      to: RECIPIENT as `0x${string}`,
      value: '500000',
      validAfter: '0',
      validBefore: '9999999999',
      nonce: '0xNoNcE' as `0x${string}`,
    },
  },
}
const PROOF_VIEW = {
  network: PAYLOAD.network,
  authorization: PAYLOAD.payload.authorization,
  signature: PAYLOAD.payload.signature,
}
const OP_ID = x402OperationId(PROOF_VIEW)
const LOCK_KEY = `x402:settle:lock:${OP_ID}`
const PARAMS = {
  payload: PAYLOAD,
  costCents: 50,
  accountId: 'dev-1',
  toolId: 'tool-1',
  toolSlug: 'demo',
  method: 'proxy:POST',
  recipient: RECIPIENT,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockVerify.mockResolvedValue({ valid: true, payerAddress: PAYLOAD.payload.authorization.from, amountBaseUnits: '500000' })
  mockFindRow.mockResolvedValue(null)
  mockRecord.mockResolvedValue(undefined)
  mockSettled.mockResolvedValue(true)
  mockFailed.mockResolvedValue(true)
  mockBroadcast.mockResolvedValue(true)
  mockRefresh.mockResolvedValue(true)
  mockRedisSet.mockResolvedValue('OK')
  mockRedisDel.mockResolvedValue(1)
})

describe('x402OperationId', () => {
  it('is x402:<network>:<from>:<nonce> with from + nonce lowercased (circle-nano parity)', () => {
    expect(OP_ID).toBe('x402:eip155:84532:0xabcdef0000000000000000000000000000000001:0xnonce')
  })
})

describe('executeX402Settlement — offline verify (the x402 exact rule + payee bind)', () => {
  it('calls the shared verifier with exactAmount=true, the recipient, and required=cost*10_000', async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    await executeX402Settlement(PARAMS)
    expect(mockVerify).toHaveBeenCalledWith(
      PROOF_VIEW,
      { recipient: RECIPIENT, requiredBaseUnits: 500000n, exactAmount: true },
    )
  })

  it('a verify failure → mapped x402 failure, NO submit, NO write-ahead row', async () => {
    mockVerify.mockResolvedValue({ valid: false, errorCode: 'CIRCLE_NANO_WRONG_RECIPIENT', invalidReason: 'pays someone else' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_WRONG_RECIPIENT', httpStatus: 402 })
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
    expect(mockRedisSet).not.toHaveBeenCalled()
  })

  it('an amount-mismatch verify failure → X402_AMOUNT_MISMATCH', async () => {
    mockVerify.mockResolvedValue({ valid: false, errorCode: 'CIRCLE_NANO_AMOUNT_MISMATCH', invalidReason: 'must equal' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_AMOUNT_MISMATCH' })
  })

  it('an unsupported-network verify failure → X402_NETWORK_UNSUPPORTED 400', async () => {
    mockVerify.mockResolvedValue({ valid: false, errorCode: 'CIRCLE_NANO_NETWORK_UNSUPPORTED', invalidReason: 'not Base' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_NETWORK_UNSUPPORTED', httpStatus: 400 })
  })

  it('a validBefore-too-far verify failure → X402_VALIDBEFORE_TOO_FAR 402 (V-N1, NO submit, NO write-ahead row)', async () => {
    mockVerify.mockResolvedValue({ valid: false, errorCode: 'CIRCLE_NANO_VALIDBEFORE_TOO_FAR', invalidReason: 'too far in the future' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_VALIDBEFORE_TOO_FAR', httpStatus: 402 })
    // An over-cap auth rejects at verify — it never reaches the pending-row writer.
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })
})

describe('executeX402Settlement — happy path', () => {
  it("submits, flips 'pending'→'settled' with the txHash, returns settled", async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    const outcome = await executeX402Settlement(PARAMS)
    // (V-N2b) fresh-submit credits this proof's value floored to cents (== costCents
    // under exactAmount: 500000 base units → 50¢) — non-regression.
    expect(outcome).toEqual({ status: 'settled', txHash: '0xTX', creditCents: 50 })
    // (V-N2) fresh submit: the settled flip carries this proof's value (500000).
    expect(mockSettled).toHaveBeenCalledWith(OP_ID, 'x402', '0xTX', '500000')
    // (V-N2b) fresh-submit resolves creditCents from the proof value — NO row
    // re-read (only the step-2 idempotency read fires).
    expect(mockFindRow).toHaveBeenCalledTimes(1)
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockRedisDel).toHaveBeenCalledWith(LOCK_KEY)
  })

  it('writes the write-ahead pending INTENT row BEFORE submitting on-chain', async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    await executeX402Settlement(PARAMS)
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        invocationId: OP_ID,
        rail: 'x402',
        protocol: 'x402',
        amountCents: 50,
        currency: 'USDC',
        status: 'pending',
        externalRef: null,
        accountId: 'dev-1',
        // F4: the owning tool id is recorded so the reconciler can credit tool revenue.
        metadata: expect.objectContaining({ toolId: 'tool-1' }),
      }),
    )
    expect(mockRecord.mock.invocationCallOrder[0]).toBeLessThan(mockSubmit.mock.invocationCallOrder[0])
  })
})

describe('executeX402Settlement — a reverted/unconfirmed tx is NEVER settled', () => {
  it("revert with the nonce FREE → 'failed' (no money moved)", async () => {
    mockSubmit.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: false })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_SETTLEMENT_REVERTED', httpStatus: 402 })
    expect(mockFailed).toHaveBeenCalledWith(OP_ID, 'x402', '0xREV')
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("revert with the nonce CONSUMED (concurrent settler) → 'pending', NOT failed", async () => {
    mockSubmit.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: true })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'X402_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502 })
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'x402', '0xREV', null) // (V) P8-e 4th arg
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("timeout (broadcast-unconfirmed) → 'pending' with the broadcast txHash, NOT settled", async () => {
    mockSubmit.mockResolvedValue({ kind: 'broadcast-unconfirmed', txHash: '0xPEND', reason: 'timeout' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', txHash: '0xPEND' })
    // (V-N2 ③ DC-20) fresh-submit broadcast-unconfirmed BACKSTOPS the settled value
    // (5th arg) so a swallowed onBroadcast write can't leave a NULL-value row that the
    // reconciler later credits at the stale amountCents.
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'x402', '0xPEND', null, '500000')
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it('insufficient balance → 402 but leaves the row PENDING (retryable, not bricked)', async () => {
    mockSubmit.mockResolvedValue({ kind: 'insufficient-balance', haveBaseUnits: '10', needBaseUnits: '500000' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_INSUFFICIENT_BALANCE', httpStatus: 402 })
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("submit-error (gas wallet) → 'pending' 503, row left pending (NOT failed)", async () => {
    mockSubmit.mockResolvedValue({ kind: 'submit-error', code: 'GAS_WALLET_INSUFFICIENT', reason: 'out of gas' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'X402_GAS_WALLET_INSUFFICIENT', httpStatus: 503 })
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockBroadcast).not.toHaveBeenCalled()
  })
})

describe('executeX402Settlement — idempotency & locking (no double-charge)', () => {
  it('already-settled row → returns the recorded txHash + alreadySettled, NEVER re-submits (F1: proxy must not re-credit)', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'settled', externalRef: '0xPREV' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xPREV', alreadySettled: true })
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('lost the pending→settled flip (concurrent winner) → settled + alreadySettled, NOT a fresh credit (F1)', async () => {
    // We submit + confirm, but a concurrent invocation already flipped the row:
    // markSettlementSettled returns false. That winner owns the credit, so we must
    // surface alreadySettled so the proxy forwards WITHOUT re-crediting.
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xMINE' })
    mockSettled.mockResolvedValue(false) // lost the guarded WHERE pending flip
    // 1st findRow (idempotency check) → null (proceed to submit);
    // 2nd findRow (inside the !flipped branch) → the winner's recorded row.
    mockFindRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'settled', externalRef: '0xWINNER' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xWINNER', alreadySettled: true })
    expect(mockSubmit).toHaveBeenCalledTimes(1)
    // a SETTLED winner is the benign race — no funds-critical alert.
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith(
      'settlement.settled_evidence_on_terminal_failed_row',
      expect.anything(),
    )
  })

  it("(T seal) SUCCESS receipt but the row is terminally FAILED (the P2 mirror window: a reconciler revert-flip landed during our resubmit gap) → funds-critical alert; outcome still alreadySettled (no auto-credit — manual runbook path)", async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xH2' }) // OUR tx moved the USDC
    mockSettled.mockResolvedValue(false) // WHERE-pending no-match (row already failed)
    mockFindRow
      .mockResolvedValueOnce(null) // idempotency read
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'failed', externalRef: '0xH1' }) // re-read: terminal FAILED
    const outcome = await executeX402Settlement(PARAMS)
    // (V) P8-f LICENSED FLIP (was '0xH1' — the row's reverted stored ref): the mirror
    // branch now returns the WINNING hash we hold the receipt for (runbook §3's
    // authoritative hash). Captured red-pre-fix in .audit/v-build/.
    expect(outcome).toEqual({ status: 'settled', txHash: '0xH2', alreadySettled: true })
    // The settled-only sweep is blind to failed rows; this branch holds the
    // success receipt and is the loss class's only detector (② seal HIGH).
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.settled_evidence_on_terminal_failed_row',
      expect.objectContaining({ operationId: OP_ID, rowStatus: 'failed', winningTxHash: '0xH2', storedRef: '0xH1' }),
    )
  })

  it('(T seal) broadcast write no-ops onto a terminally FAILED row → sibling alert AT BROADCAST TIME (kill-mid-wait / receipt-timeout sub-schedule coverage)', async () => {
    mockFindRow
      .mockResolvedValueOnce(null) // idempotency read
      .mockResolvedValue({ id: '1', settlementStatus: 'failed', externalRef: '0xH1' }) // onBroadcast no-op re-read (default — no once-queue leak pre-fix)
    mockBroadcast.mockResolvedValue(false) // WHERE-pending no-match (mirror flip landed pre-broadcast)
    mockSubmit.mockImplementation(async (_proof: unknown, opts: { onBroadcast: (h: string) => Promise<void> }) => {
      await opts.onBroadcast('0xH2')
      return { kind: 'broadcast-unconfirmed', txHash: '0xH2', reason: 'timeout' } // receipt never observed
    })
    await executeX402Settlement(PARAMS)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.broadcast_evidence_on_terminal_failed_row',
      expect.objectContaining({ operationId: OP_ID, rowStatus: 'failed', broadcastTxHash: '0xH2', storedRef: '0xH1' }),
    )
  })

  it("previously-failed row → terminal 'failed', no re-submit", async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'failed', externalRef: null })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_SETTLEMENT_PREVIOUSLY_FAILED' })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('lock not acquired → 409 pending, no submit, does NOT delete the lock', async () => {
    mockRedisSet.mockResolvedValue(null)
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'X402_SETTLEMENT_IN_PROGRESS', httpStatus: 409 })
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(mockRecord).not.toHaveBeenCalled()
    expect(mockRedisDel).not.toHaveBeenCalled()
  })
})

describe('executeX402Settlement — timeout recovery (re-wait, do not re-submit)', () => {
  it('pending row with a stored broadcast tx that now confirms → settled WITHOUT re-submitting; credits the RECORDED value, not costCents (V-N2b RAISE)', async () => {
    // RAISE repro: price was raised to costCents 50 AFTER a prior broadcast at 30¢.
    // The recovery confirms the PRIOR tx (moved 30¢) → credit 30, NOT 50 (the old
    // over-credit / platform-loss vector).
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xBROADCAST', amountCents: 50, settledValueBaseUnits: '300000' })
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xBROADCAST' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xBROADCAST', creditCents: 30 })
    expect(mockConfirm).toHaveBeenCalledWith(PROOF_VIEW, '0xBROADCAST')
    expect(mockSubmit).not.toHaveBeenCalled()
    // (V-N2b) recovery flips with an UNDEFINED 4th arg (the prior tx's recorded
    // value is NOT re-pointed to this proof's possibly-re-signed value).
    expect(mockSettled).toHaveBeenCalledWith(OP_ID, 'x402', '0xBROADCAST', undefined)
  })

  it('clean revert with the nonce FREE (stored tx definitively failed) → fresh submit', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xDROPPED' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xDROPPED', nonceConsumed: false })
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeX402Settlement(PARAMS)
    // (V-N2b) the fresh resubmit credits this proof's value (50¢), not a re-read.
    expect(outcome).toEqual({ status: 'settled', txHash: '0xFRESH', creditCents: 50 })
    expect(mockSubmit).toHaveBeenCalledTimes(1)
  })
})

// ─── (V-N2b) in-request recovery-confirm credit value — credit-or-defer (§7) ───
describe('(V-N2b) executeX402Settlement — recovery-confirm credits the RECORDED settled value, or DEFERS', () => {
  it('LOWER repro: price lowered to 50¢ after a 70¢ broadcast → credits the recorded 70, NOT costCents 50 (the under-credit / dev-short-pay vector)', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xPRIOR', amountCents: 50, settledValueBaseUnits: '700000' })
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xPRIOR' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xPRIOR', creditCents: 70 })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('§7.7 recovery whose value was NEVER recorded (swallowed onBroadcast) → DEFER (creditCents null) + legacy_fallback warn; prior value not re-pointed', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xPRIOR', amountCents: 50 }) // no settledValueBaseUnits
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xPRIOR' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xPRIOR', creditCents: null })
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'settlement.settled_value_legacy_fallback',
      expect.objectContaining({ operationId: OP_ID, rail: 'x402', amountCents: 50 }),
    )
    expect(mockSettled).toHaveBeenCalledWith(OP_ID, 'x402', '0xPRIOR', undefined)
  })

  it('recovery whose recorded value is corrupt → DEFER (creditCents null) + unconvertible error', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xPRIOR', amountCents: 50, settledValueBaseUnits: 'corrupt' })
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xPRIOR' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xPRIOR', creditCents: null })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.settled_value_unconvertible',
      expect.objectContaining({ settledValueBaseUnits: 'corrupt' }),
    )
  })

  it('§13.I / #11: a recovery confirm of a reverted-nonce-CONSUMED row stays PENDING — NEVER flips settled in-request, so NO credit', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xPRIOR' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xPRIOR', nonceConsumed: true })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'X402_SETTLEMENT_PENDING_CONFIRMATION' })
    expect(mockSettled).not.toHaveBeenCalled() // no flip → no in-request credit (the reconciler tail owns it)
  })
})

// ─── (V) pending-row lifecycle faces (P5-i, P8-a/e/f, 3e, R2-B5b) — circle-nano twins ───
describe('(V) executeX402Settlement — pending-row lifecycle', () => {
  beforeEach(() => {
    // vi.clearAllMocks does NOT clear mockResolvedValueOnce queues — hard-reset
    // the queue-bearing mocks so the Once-queue recipes below are leak-proof.
    mockFindRow.mockReset()
    mockFindRow.mockResolvedValue(null)
    mockRefresh.mockReset()
    mockRefresh.mockResolvedValue(true)
    mockFailed.mockReset()
    mockFailed.mockResolvedValue(true)
  })

  it('R-V7: the write-ahead row stores the CANONICAL validBefore and the refresh is called with the same value', async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    await executeX402Settlement(PARAMS)
    const recorded = mockRecord.mock.calls[0][0]
    expect(recorded.metadata.validBefore).toBe(BigInt(PAYLOAD.payload.authorization.validBefore).toString(10))
    expect(mockRefresh).toHaveBeenCalledWith(OP_ID, 'x402', BigInt(PAYLOAD.payload.authorization.validBefore).toString(10))
  })

  it('R-V7-hex: a hex validBefore (BigInt-verifier-acceptable) is stored/passed as the DECIMAL string', async () => {
    const hexPayload = {
      ...PAYLOAD,
      payload: { ...PAYLOAD.payload, authorization: { ...PAYLOAD.payload.authorization, validBefore: '0x2540BE3FF' } },
    }
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    await executeX402Settlement({ ...PARAMS, payload: hexPayload })
    const recorded = mockRecord.mock.calls[0][0]
    expect(recorded.metadata.validBefore).toBe('9999999999')
    const hexOp = x402OperationId({ network: hexPayload.network, authorization: hexPayload.payload.authorization, signature: hexPayload.payload.signature })
    expect(mockRefresh).toHaveBeenCalledWith(hexOp, 'x402', '9999999999')
  })

  it('R-V8: the recovery resubmit re-checks terminality IMMEDIATELY pre-submit and aborts on a failed row (P8-a)', async () => {
    mockFindRow
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'pending', externalRef: '0xDROPPED' })
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'failed', externalRef: '0xDROPPED' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xDROPPED', nonceConsumed: false })
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_SETTLEMENT_PREVIOUSLY_FAILED', httpStatus: 402 })
  })

  it('R-V8-settled: the P8-a re-read finding SETTLED aborts with alreadySettled', async () => {
    mockFindRow
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'pending', externalRef: '0xDROPPED' })
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'settled', externalRef: '0xWINNER' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xDROPPED', nonceConsumed: false })
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toEqual({ status: 'settled', txHash: '0xWINNER', alreadySettled: true })
  })

  it('R-V8b: a FALSE refresh (row terminal in the read-to-refresh sliver) aborts BEFORE any broadcast (R2-B5b)', async () => {
    mockFindRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'failed', externalRef: null })
    mockRefresh.mockResolvedValueOnce(false)
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_SETTLEMENT_PREVIOUSLY_FAILED' })
  })

  it('R-V8b-settled: refresh-false + re-read SETTLED → settled alreadySettled, no submit', async () => {
    mockFindRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'settled', externalRef: '0xWINNER' })
    mockRefresh.mockResolvedValueOnce(false)
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toEqual({ status: 'settled', txHash: '0xWINNER', alreadySettled: true })
  })

  it('R-V8b-null: refresh-false + re-read NULL row → failed-shaped outcome, no submit (totality)', async () => {
    mockFindRow.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    mockRefresh.mockResolvedValueOnce(false)
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ status: 'failed' })
  })

  it("R-V9b: a CAS-rejected failed-flip on a STILL-PENDING row returns PENDING (the ③-(U) F2 fold), not the 402 'failed' lie", async () => {
    mockFindRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'pending', externalRef: '0xNEW' })
    mockSubmit.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: false })
    mockFailed.mockResolvedValue(false)
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', code: 'X402_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502 })
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'x402.settle_reverted_stale_ref',
      expect.objectContaining({ operationId: OP_ID }),
    )
  })

  it('R-V9b-terminal: a CAS-rejected failed-flip on an already-FAILED row keeps the truthful 402', async () => {
    mockFindRow
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '1', settlementStatus: 'failed', externalRef: '0xREV' })
    mockSubmit.mockResolvedValue({ kind: 'reverted', txHash: '0xREV', nonceConsumed: false })
    mockFailed.mockResolvedValue(false)
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'failed', code: 'X402_SETTLEMENT_REVERTED', httpStatus: 402 })
  })

  it('R-V10: onBroadcast threads the step-1 ref as expectedPrior (the recovery T1→T2 re-point stays legal; P8-e wiring)', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xT1' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xT1', nonceConsumed: false })
    mockSubmit.mockImplementation(async (_proof: unknown, opts: { onBroadcast: (h: string) => Promise<void> }) => {
      await opts.onBroadcast('0xT2')
      return { kind: 'settled', txHash: '0xT2' }
    })
    await executeX402Settlement(PARAMS)
    // (V-N2) onBroadcast records the settled value (500000) in the same UPDATE.
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'x402', '0xT2', '0xT1', '500000')
  })

  it('R-V11: a recovery confirm returning broadcast-unconfirmed/revert-nonce-unverifiable (P8(g) face) stays pending with NO fresh submit — passes pre+post', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xT1' })
    mockConfirm.mockResolvedValue({ kind: 'broadcast-unconfirmed', txHash: '0xT1', reason: 'revert-nonce-unverifiable' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(mockSubmit).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ status: 'pending', code: 'X402_SETTLEMENT_PENDING_CONFIRMATION' })
  })
})
