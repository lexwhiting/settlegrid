/**
 * P3.K4 A2 — circle-nano on-chain ENGINE tests (pure viem mechanics).
 *
 * viem's client factories are mocked so we drive every on-chain branch
 * deterministically (no network): the pre-submit nonce + balance guards, a
 * confirmed-success receipt, a revert (with the nonce-recheck), a receipt-wait
 * timeout vs RPC error, writeContract failures, and the unsupported-network /
 * missing-gas-wallet fail-closed paths. The real WaitForTransactionReceiptTimeoutError
 * class is preserved (importOriginal spread) so `instanceof` works.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReadContract, mockWaitForReceipt, mockWriteContract, mockGetReceipt } = vi.hoisted(() => ({
  mockReadContract: vi.fn(),
  mockWaitForReceipt: vi.fn(),
  mockWriteContract: vi.fn(),
  mockGetReceipt: vi.fn(),
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: () => ({
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForReceipt,
      getTransactionReceipt: mockGetReceipt,
    }),
    createWalletClient: () => ({ writeContract: mockWriteContract }),
  }
})
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: () => ({ address: '0xGA50000000000000000000000000000000000001' }),
}))

import { WaitForTransactionReceiptTimeoutError } from 'viem'
import { submitCircleNanoOnChain, confirmSettlementTx } from '../settle-engine'
import type { CircleNanoProof } from '@settlegrid/mcp'

const PROOF: CircleNanoProof = {
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
}

/** Configure the on-chain reads. authorizationState returns `nonceUsed` on the
 *  pre-check and `nonceRecheck` on the post-revert recheck. */
function setupChain({ nonceUsed = false, nonceRecheck = false, balance = 10n ** 12n } = {}) {
  let authCalls = 0
  mockReadContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (functionName === 'authorizationState') {
      authCalls += 1
      return authCalls === 1 ? nonceUsed : nonceRecheck
    }
    if (functionName === 'balanceOf') return balance
    throw new Error(`unexpected readContract: ${functionName}`)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SETTLEGRID_GAS_WALLET_KEY = '0x' + '01'.repeat(32)
  setupChain()
  mockWriteContract.mockResolvedValue('0xTX')
  mockWaitForReceipt.mockResolvedValue({ status: 'success' })
})

describe('confirmSettlementTx — immediate reconciliation receipt check (B1.4)', () => {
  const TXH = ('0x' + 'ab'.repeat(32)) as `0x${string}`
  const FROM = '0xAbCdEf0000000000000000000000000000000001' as `0x${string}`
  const NONCE = ('0x' + 'cd'.repeat(32)) as `0x${string}`

  it('success receipt → settled', async () => {
    mockGetReceipt.mockResolvedValue({ status: 'success' })
    expect(await confirmSettlementTx('eip155:84532', TXH)).toEqual({ kind: 'settled', txHash: TXH })
    // immediate check, not a 30s wait
    expect(mockWaitForReceipt).not.toHaveBeenCalled()
  })

  it('reverted + nonce FREE (circle-nano) → reverted{nonceConsumed:false}', async () => {
    mockGetReceipt.mockResolvedValue({ status: 'reverted' })
    mockReadContract.mockResolvedValue(false) // authorizationState
    expect(await confirmSettlementTx('eip155:84532', TXH, { from: FROM, nonce: NONCE })).toEqual({
      kind: 'reverted',
      txHash: TXH,
      nonceConsumed: false,
    })
  })

  it('reverted + nonce CONSUMED (concurrent settle) → reverted{nonceConsumed:true}', async () => {
    mockGetReceipt.mockResolvedValue({ status: 'reverted' })
    mockReadContract.mockResolvedValue(true)
    expect(await confirmSettlementTx('eip155:84532', TXH, { from: FROM, nonce: NONCE })).toEqual({
      kind: 'reverted',
      txHash: TXH,
      nonceConsumed: true,
    })
  })

  it('reverted WITHOUT eip3009 (x402) → nonceConsumed:false, never reads the nonce', async () => {
    mockGetReceipt.mockResolvedValue({ status: 'reverted' })
    mockReadContract.mockClear()
    const r = await confirmSettlementTx('eip155:8453', TXH)
    expect(r).toEqual({ kind: 'reverted', txHash: TXH, nonceConsumed: false })
    expect(mockReadContract).not.toHaveBeenCalled()
  })

  it('receipt not found / RPC error → unconfirmed (leave pending, retry next run)', async () => {
    mockGetReceipt.mockRejectedValue(new Error('TransactionReceiptNotFoundError'))
    expect(await confirmSettlementTx('eip155:84532', TXH)).toEqual({ kind: 'unconfirmed', txHash: TXH })
  })

  it('reverted but the nonce-recheck RPC throws → unconfirmed (incomplete evidence is never terminalized — LB-2)', async () => {
    // (U) — the funds trap: a failed nonce-state read after a reverted receipt is INCOMPLETE
    // evidence. The pre-(U) default (reverted{nonceConsumed:false}) let the reconciler CAS-flip
    // 'failed' while a concurrent winner may have moved the USDC. Safe direction: stay pending.
    mockGetReceipt.mockResolvedValue({ status: 'reverted' })
    mockReadContract.mockRejectedValue(new Error('rpc down'))
    expect(await confirmSettlementTx('eip155:84532', TXH, { from: FROM, nonce: NONCE })).toEqual({
      kind: 'unconfirmed',
      txHash: TXH,
      reason: 'revert-nonce-unverifiable',
    })
  })

  it('unsupported network (e.g. eip155:1) → unsupported-network, never touches the chain', async () => {
    mockGetReceipt.mockClear()
    const r = await confirmSettlementTx('eip155:1', TXH)
    expect(r).toEqual({ kind: 'unsupported-network' })
    expect(mockGetReceipt).not.toHaveBeenCalled()
  })
})

describe('submitCircleNanoOnChain — pre-submit guards (no gas burned)', () => {
  it('nonce already used on-chain → nonce-already-used, never submits', async () => {
    setupChain({ nonceUsed: true })
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toEqual({ kind: 'nonce-already-used' })
    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('payer balance below authorized value → insufficient-balance, never submits', async () => {
    setupChain({ balance: 100n })
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toEqual({ kind: 'insufficient-balance', haveBaseUnits: '100', needBaseUnits: '500000' })
    expect(mockWriteContract).not.toHaveBeenCalled()
  })

  it('authorizationState RPC read failure → submit-error (no submit)', async () => {
    mockReadContract.mockRejectedValueOnce(new Error('rpc boom'))
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toMatchObject({ kind: 'submit-error', code: 'SETTLEMENT_RPC_ERROR' })
    expect(mockWriteContract).not.toHaveBeenCalled()
  })
})

describe('submitCircleNanoOnChain — submit + confirmed receipt', () => {
  it('receipt success → settled with the txHash', async () => {
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toEqual({ kind: 'settled', txHash: '0xTX' })
    expect(mockWriteContract).toHaveBeenCalledTimes(1)
  })

  it('calls onBroadcast with the hash BEFORE the receipt wait (write-ahead, no lost tx)', async () => {
    const order: string[] = []
    const onBroadcast = vi.fn(async (h: string) => {
      order.push('broadcast:' + h)
    })
    mockWaitForReceipt.mockImplementation(async () => {
      order.push('receipt')
      return { status: 'success' }
    })
    const r = await submitCircleNanoOnChain(PROOF, { onBroadcast })
    expect(r).toEqual({ kind: 'settled', txHash: '0xTX' })
    expect(onBroadcast).toHaveBeenCalledWith('0xTX')
    expect(order).toEqual(['broadcast:0xTX', 'receipt']) // persisted strictly before the wait
  })

  it('a throwing onBroadcast does not abort the receipt wait (best-effort persistence)', async () => {
    const onBroadcast = vi.fn(async () => {
      throw new Error('db down')
    })
    const r = await submitCircleNanoOnChain(PROOF, { onBroadcast })
    expect(r).toEqual({ kind: 'settled', txHash: '0xTX' })
  })

  it('receipt reverted + nonce still free → reverted(nonceConsumed:false)', async () => {
    setupChain({ nonceUsed: false, nonceRecheck: false })
    mockWaitForReceipt.mockResolvedValue({ status: 'reverted' })
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toEqual({ kind: 'reverted', txHash: '0xTX', nonceConsumed: false })
  })

  it('receipt reverted + nonce now consumed (concurrent settler) → reverted(nonceConsumed:true)', async () => {
    setupChain({ nonceUsed: false, nonceRecheck: true })
    mockWaitForReceipt.mockResolvedValue({ status: 'reverted' })
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toEqual({ kind: 'reverted', txHash: '0xTX', nonceConsumed: true })
  })

  it('receipt-wait timeout → broadcast-unconfirmed(timeout) — tx NOT lost', async () => {
    mockWaitForReceipt.mockRejectedValue(new WaitForTransactionReceiptTimeoutError({ hash: '0xTX' }))
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toEqual({ kind: 'broadcast-unconfirmed', txHash: '0xTX', reason: 'timeout' })
  })

  it('receipt-wait RPC error → broadcast-unconfirmed(rpc-error)', async () => {
    mockWaitForReceipt.mockRejectedValue(new Error('rpc dropped'))
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toEqual({ kind: 'broadcast-unconfirmed', txHash: '0xTX', reason: 'rpc-error' })
  })
})

describe('submitCircleNanoOnChain — submit failures (no tx broadcast)', () => {
  it('writeContract "insufficient funds" → submit-error GAS_WALLET_INSUFFICIENT', async () => {
    mockWriteContract.mockRejectedValue(new Error('insufficient funds for gas * price + value'))
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toMatchObject({ kind: 'submit-error', code: 'GAS_WALLET_INSUFFICIENT' })
  })

  it('writeContract generic error → submit-error SETTLEMENT_RPC_ERROR', async () => {
    mockWriteContract.mockRejectedValue(new Error('nonce too low'))
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toMatchObject({ kind: 'submit-error', code: 'SETTLEMENT_RPC_ERROR' })
  })
})

describe('submitCircleNanoOnChain — fail closed', () => {
  it('unsupported network → submit-error UNSUPPORTED_NETWORK', async () => {
    const r = await submitCircleNanoOnChain({ ...PROOF, network: 'eip155:1' })
    expect(r).toMatchObject({ kind: 'submit-error', code: 'UNSUPPORTED_NETWORK' })
    expect(mockReadContract).not.toHaveBeenCalled()
  })

  it('gas wallet not configured → submit-error GAS_WALLET_NOT_CONFIGURED', async () => {
    delete process.env.SETTLEGRID_GAS_WALLET_KEY
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toMatchObject({ kind: 'submit-error', code: 'GAS_WALLET_NOT_CONFIGURED' })
    expect(mockReadContract).not.toHaveBeenCalled()
  })

  it('malformed authorization value → submit-error, never reads chain or submits (engine self-protects)', async () => {
    const r = await submitCircleNanoOnChain({
      ...PROOF,
      authorization: { ...PROOF.authorization, value: 'not-a-number' },
    })
    expect(r).toMatchObject({ kind: 'submit-error' })
    expect(mockReadContract).not.toHaveBeenCalled()
    expect(mockWriteContract).not.toHaveBeenCalled()
  })
})
