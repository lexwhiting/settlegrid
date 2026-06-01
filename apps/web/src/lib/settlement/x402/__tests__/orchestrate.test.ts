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
})

describe('executeX402Settlement — happy path', () => {
  it("submits, flips 'pending'→'settled' with the txHash, returns settled", async () => {
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xTX' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xTX' })
    expect(mockSettled).toHaveBeenCalledWith(OP_ID, 'x402', '0xTX')
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
    expect(mockBroadcast).toHaveBeenCalledWith(OP_ID, 'x402', '0xREV')
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it("timeout (broadcast-unconfirmed) → 'pending' with the broadcast txHash, NOT settled", async () => {
    mockSubmit.mockResolvedValue({ kind: 'broadcast-unconfirmed', txHash: '0xPEND', reason: 'timeout' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toMatchObject({ status: 'pending', txHash: '0xPEND' })
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
  it('pending row with a stored broadcast tx that now confirms → settled WITHOUT re-submitting', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xBROADCAST' })
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xBROADCAST' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xBROADCAST' })
    expect(mockConfirm).toHaveBeenCalledWith(PROOF_VIEW, '0xBROADCAST')
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('clean revert with the nonce FREE (stored tx definitively failed) → fresh submit', async () => {
    mockFindRow.mockResolvedValue({ id: '1', settlementStatus: 'pending', externalRef: '0xDROPPED' })
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xDROPPED', nonceConsumed: false })
    mockSubmit.mockResolvedValue({ kind: 'settled', txHash: '0xFRESH' })
    const outcome = await executeX402Settlement(PARAMS)
    expect(outcome).toEqual({ status: 'settled', txHash: '0xFRESH' })
    expect(mockSubmit).toHaveBeenCalledTimes(1)
  })
})
