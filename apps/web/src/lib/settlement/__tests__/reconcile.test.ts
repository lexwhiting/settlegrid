/**
 * B1.4 — pending-settlement reconciler. The funds-safety core: confirm an
 * already-broadcast tx on-chain and flip the 'pending' row to terminal, with
 * the SAME mapping the live settle path uses. The reverted-but-nonce-consumed
 * case (a concurrent tx settled it) must NOT be recorded 'failed'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, mockConfirm, mockSettled, mockFailed } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  },
  mockConfirm: vi.fn(),
  mockSettled: vi.fn(),
  mockFailed: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  ledgerEntries: {
    operationId: 'operation_id',
    rail: 'rail',
    externalRef: 'external_ref',
    settlementStatus: 'settlement_status',
    createdAt: 'created_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...a: unknown[]) => ({ and: a })),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  inArray: vi.fn((a: unknown, b: unknown) => ({ inArray: [a, b] })),
  lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
  asc: vi.fn((a: unknown) => ({ asc: a })),
  isNotNull: vi.fn((a: unknown) => ({ isNotNull: a })),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../circle-nano/settle-engine', () => ({ confirmSettlementTx: mockConfirm }))
vi.mock('../ledger', () => ({
  markSettlementSettled: mockSettled,
  markSettlementFailed: mockFailed,
}))

import {
  parseSettlementOperationId,
  reconcileOneRow,
  reconcilePendingSettlements,
} from '../reconcile'

const FROM = `0x${'a'.repeat(40)}`
const NONCE = `0x${'b'.repeat(64)}`
const TX = `0x${'c'.repeat(64)}`
const CNANO_OPID = `circle-nano:eip155:8453:${FROM}:${NONCE}`
const X402_OPID = `x402:eip155:8453:${TX}`

beforeEach(() => {
  vi.clearAllMocks()
  mockSettled.mockResolvedValue(true)
  mockFailed.mockResolvedValue(true)
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.orderBy.mockReturnValue(mockDb)
  mockDb.limit.mockResolvedValue([])
})

describe('parseSettlementOperationId', () => {
  it('parses circle-nano op id into network + from/nonce (CAIP-2 colon handled)', () => {
    expect(parseSettlementOperationId(CNANO_OPID, 'circle-nano')).toEqual({
      network: 'eip155:8453',
      eip3009: { from: FROM, nonce: NONCE },
    })
  })

  it('parses x402 op id into network only (no nonce)', () => {
    expect(parseSettlementOperationId(X402_OPID, 'x402')).toEqual({ network: 'eip155:8453' })
  })

  it('returns null for a malformed / wrong-rail / unknown-rail op id', () => {
    expect(parseSettlementOperationId('garbage', 'circle-nano')).toBeNull()
    expect(parseSettlementOperationId(X402_OPID, 'circle-nano')).toBeNull()
    expect(parseSettlementOperationId(CNANO_OPID, 'x402')).toBeNull()
    expect(parseSettlementOperationId(CNANO_OPID, 'ap2')).toBeNull()
  })
})

describe('reconcileOneRow — flips on confirmed on-chain state', () => {
  it('settled receipt → markSettlementSettled, outcome settled', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    const out = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(out).toBe('settled')
    expect(mockSettled).toHaveBeenCalledWith(CNANO_OPID, 'circle-nano', TX)
    expect(mockFailed).not.toHaveBeenCalled()
  })

  it('reverted with nonce FREE → markSettlementFailed, outcome failed', async () => {
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: TX, nonceConsumed: false })
    const out = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(out).toBe('failed')
    expect(mockFailed).toHaveBeenCalledWith(CNANO_OPID, 'circle-nano', TX)
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it('FUNDS-SAFETY: reverted but nonce CONSUMED → leaves pending (NOT failed, NOT settled)', async () => {
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: TX, nonceConsumed: true })
    const out = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(out).toBe('pending-nonce-consumed')
    expect(mockFailed).not.toHaveBeenCalled()
    expect(mockSettled).not.toHaveBeenCalled()
  })

  it('unconfirmed receipt → leaves pending, no flip', async () => {
    mockConfirm.mockResolvedValue({ kind: 'unconfirmed', txHash: TX })
    const out = await reconcileOneRow({ operationId: X402_OPID, rail: 'x402', externalRef: TX })
    expect(out).toBe('pending-unconfirmed')
    expect(mockSettled).not.toHaveBeenCalled()
    expect(mockFailed).not.toHaveBeenCalled()
  })

  it('unsupported network → skipped, never flips a row it cannot confirm', async () => {
    mockConfirm.mockResolvedValue({ kind: 'unsupported-network' })
    const out = await reconcileOneRow({ operationId: X402_OPID, rail: 'x402', externalRef: TX })
    expect(out).toBe('skipped-unsupported')
    expect(mockSettled).not.toHaveBeenCalled()
    expect(mockFailed).not.toHaveBeenCalled()
  })

  it('passes the EIP-3009 nonce recheck context for circle-nano, none for x402', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(mockConfirm).toHaveBeenCalledWith('eip155:8453', TX, { from: FROM, nonce: NONCE })

    mockConfirm.mockClear()
    await reconcileOneRow({ operationId: X402_OPID, rail: 'x402', externalRef: TX })
    expect(mockConfirm).toHaveBeenCalledWith('eip155:8453', TX, undefined)
  })
})

describe('reconcileOneRow — skips rows with nothing to confirm', () => {
  it('no externalRef (broadcast never recorded) → skipped, no on-chain call', async () => {
    const out = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: null })
    expect(out).toBe('skipped-no-txhash')
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it('unparseable operation_id → skipped, no on-chain call', async () => {
    const out = await reconcileOneRow({ operationId: 'circle-nano:bogus', rail: 'circle-nano', externalRef: TX })
    expect(out).toBe('skipped-unparseable')
    expect(mockConfirm).not.toHaveBeenCalled()
  })
})

describe('reconcilePendingSettlements — bounded batch + summary', () => {
  it('reconciles each queried row and tallies the FULL summary (settled/failed/pending/skipped)', async () => {
    mockDb.limit.mockResolvedValue([
      { operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX },
      { operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX },
      { operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX },
      { operationId: X402_OPID, rail: 'x402', externalRef: TX },
    ])
    mockConfirm
      .mockResolvedValueOnce({ kind: 'settled', txHash: TX })
      .mockResolvedValueOnce({ kind: 'reverted', txHash: TX, nonceConsumed: false })
      .mockResolvedValueOnce({ kind: 'reverted', txHash: TX, nonceConsumed: true })
      .mockResolvedValueOnce({ kind: 'unsupported-network' })

    const summary = await reconcilePendingSettlements({ limit: 25 })
    expect(summary.scanned).toBe(4)
    expect(summary.settled).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.pending).toBe(1) // the reverted + nonce-consumed row
    expect(summary.skipped).toBe(1) // the unsupported-network row
    // Pin the aggregation arithmetic (a dropped term in the pending/skipped sums survives otherwise).
    expect(summary.outcomes['pending-nonce-consumed']).toBe(1)
    expect(summary.outcomes['skipped-unsupported']).toBe(1)
    expect(mockDb.limit).toHaveBeenCalledWith(25)
  })

  it('one row throwing does not abort the batch', async () => {
    mockDb.limit.mockResolvedValue([
      { operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX },
      { operationId: X402_OPID, rail: 'x402', externalRef: TX },
    ])
    mockConfirm
      .mockRejectedValueOnce(new Error('rpc boom'))
      .mockResolvedValueOnce({ kind: 'settled', txHash: TX })

    const summary = await reconcilePendingSettlements()
    expect(summary.scanned).toBe(2)
    expect(summary.settled).toBe(1) // the second row still processed
  })
})
