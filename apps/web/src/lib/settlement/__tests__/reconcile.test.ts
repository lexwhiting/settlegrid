/**
 * B1.4 — pending-settlement reconciler. The funds-safety core: confirm an
 * already-broadcast tx on-chain and flip the 'pending' row to terminal, with
 * the SAME mapping the live settle path uses. The reverted-but-nonce-consumed
 * case (a concurrent tx settled it) must NOT be recorded 'failed'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockDb,
  mockConfirm,
  mockSettled,
  mockFailed,
  mockTx,
  mockReturning,
  mockSql,
  mockDevelopers,
  mockTools,
} = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    transaction: vi.fn(),
  },
  mockConfirm: vi.fn(),
  mockSettled: vi.fn(),
  mockFailed: vi.fn(),
  // F4 credit txn: tx.update(table).set({...}).where(...) — update/set chain. The
  // developers UPDATE chains .returning({id}) (B4 zero-row detection) off where()'s
  // return value; the tools UPDATE awaits where() directly — see beforeEach.
  mockTx: { update: vi.fn(), set: vi.fn(), where: vi.fn() },
  mockReturning: vi.fn(),
  mockSql: vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ __sql: strings, vals })),
  mockDevelopers: { id: 'developers.id', balanceCents: 'developers.balanceCents' },
  mockTools: { id: 'tools.id', totalRevenueCents: 'tools.totalRevenueCents' },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  ledgerEntries: {
    operationId: 'operation_id',
    rail: 'rail',
    externalRef: 'external_ref',
    settlementStatus: 'settlement_status',
    createdAt: 'created_at',
    amountCents: 'amount_cents',
    accountId: 'account_id',
    metadata: 'metadata',
  },
  developers: mockDevelopers,
  tools: mockTools,
}))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...a: unknown[]) => ({ and: a })),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  inArray: vi.fn((a: unknown, b: unknown) => ({ inArray: [a, b] })),
  lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
  asc: vi.fn((a: unknown) => ({ asc: a })),
  isNotNull: vi.fn((a: unknown) => ({ isNotNull: a })),
  sql: mockSql,
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
// Mocked above — imported for assertions (the B4 semantic-guard pin + log checks).
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

const FROM = `0x${'a'.repeat(40)}`
const NONCE = `0x${'b'.repeat(64)}`
const TX = `0x${'c'.repeat(64)}`
const CNANO_OPID = `circle-nano:eip155:8453:${FROM}:${NONCE}`
// x402 now keys on the EIP-3009 (from,nonce) — parity with circle-nano (the proxy
// settles on-chain in-process, so it surfaces them). Was x402:<network>:<txHash>.
const X402_OPID = `x402:eip155:8453:${FROM}:${NONCE}`

beforeEach(() => {
  vi.clearAllMocks()
  mockSettled.mockResolvedValue(true)
  mockFailed.mockResolvedValue(true)
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.orderBy.mockReturnValue(mockDb)
  mockDb.limit.mockResolvedValue([])
  // F4 credit txn plumbing. where() returns an awaitable that ALSO exposes
  // .returning() — the developers UPDATE chains .returning({id}) (B4) while the
  // tools UPDATE awaits where()'s return value directly.
  mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx))
  mockTx.update.mockReturnValue(mockTx)
  mockTx.set.mockReturnValue(mockTx)
  mockReturning.mockResolvedValue([{ id: 'dev-7' }])
  mockTx.where.mockImplementation(() =>
    Object.assign(Promise.resolve(undefined), { returning: mockReturning }),
  )
})

describe('parseSettlementOperationId', () => {
  it('parses circle-nano op id into network + from/nonce (CAIP-2 colon handled)', () => {
    expect(parseSettlementOperationId(CNANO_OPID, 'circle-nano')).toEqual({
      network: 'eip155:8453',
      eip3009: { from: FROM, nonce: NONCE },
    })
  })

  it('parses x402 op id into network + from/nonce (now keyed on (from,nonce), circle-nano parity)', () => {
    expect(parseSettlementOperationId(X402_OPID, 'x402')).toEqual({
      network: 'eip155:8453',
      eip3009: { from: FROM, nonce: NONCE },
    })
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

  it('passes the EIP-3009 nonce recheck context for BOTH circle-nano and x402 (x402 now keys on (from,nonce))', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(mockConfirm).toHaveBeenCalledWith('eip155:8453', TX, { from: FROM, nonce: NONCE })

    mockConfirm.mockClear()
    await reconcileOneRow({ operationId: X402_OPID, rail: 'x402', externalRef: TX })
    expect(mockConfirm).toHaveBeenCalledWith('eip155:8453', TX, { from: FROM, nonce: NONCE })
  })
})

describe('reconcileOneRow — credit-on-flip (x402 + circle-nano, exactly once)', () => {
  const X402_ROW = {
    operationId: X402_OPID,
    rail: 'x402',
    externalRef: TX,
    amountCents: 50,
    accountId: 'dev-7',
    metadata: { toolId: 'tool-9' },
  }

  it('x402 settled + flipped → credits dev balance THEN tool revenue in ONE txn, by amountCents', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    const out = await reconcileOneRow(X402_ROW)
    expect(out).toBe('settled')
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(mockTx.update).toHaveBeenNthCalledWith(1, mockDevelopers)
    expect(mockTx.update).toHaveBeenNthCalledWith(2, mockTools)
    expect(mockTx.update).toHaveBeenCalledTimes(2)
    // the increment amount (50) flows into BOTH sql interpolations.
    const sqlAmounts = mockSql.mock.calls.flatMap((c) => c.slice(1))
    expect(sqlAmounts.filter((v) => v === 50)).toHaveLength(2)
  })

  it('x402 settled but flip LOST (flipped===false) → NO credit (another actor owns the credit)', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(false)
    const out = await reconcileOneRow(X402_ROW)
    expect(out).toBe('settled')
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('circle-nano settled + flipped → credits dev balance THEN tool revenue in ONE txn (Part C2 rail-agnostic widen)', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    const out = await reconcileOneRow({
      operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX,
      amountCents: 50, accountId: 'dev-7', metadata: { toolId: 'tool-9' },
    })
    expect(out).toBe('settled')
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(mockTx.update).toHaveBeenNthCalledWith(1, mockDevelopers)
    expect(mockTx.update).toHaveBeenNthCalledWith(2, mockTools)
    expect(mockTx.update).toHaveBeenCalledTimes(2)
    // the increment amount (50) flows into BOTH sql interpolations.
    const sqlAmounts = mockSql.mock.calls.flatMap((c) => c.slice(1))
    expect(sqlAmounts.filter((v) => v === 50)).toHaveLength(2)
  })

  it('circle-nano settled but flip LOST (flipped===false) → NO credit (exactly-once holds across the widen)', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(false)
    const out = await reconcileOneRow({
      operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX,
      amountCents: 50, accountId: 'dev-7', metadata: { toolId: 'tool-9' },
    })
    expect(out).toBe('settled')
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('x402 settled + flipped but MISSING accountId → NO db credit (dev balance not silently lost — flagged)', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    const out = await reconcileOneRow({ operationId: X402_OPID, rail: 'x402', externalRef: TX })
    expect(out).toBe('settled')
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('x402 settled + flipped but NO toolId → still credits the dev balance (payout source), skips the tool stat', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    const out = await reconcileOneRow({
      operationId: X402_OPID, rail: 'x402', externalRef: TX,
      amountCents: 50, accountId: 'dev-7', metadata: {},
    })
    expect(out).toBe('settled')
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(mockTx.update).toHaveBeenCalledTimes(1)
    expect(mockTx.update).toHaveBeenCalledWith(mockDevelopers)
  })

  it('settled + flipped but the developer UPDATE matches NO row → rolls back, logs settlement.credit_failed (never a false "credited")', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    // B4: zero rows matched — a dangling developer id (deleted developer, or a
    // mis-attributed account_id). The credit did NOT happen and must be flagged.
    mockReturning.mockResolvedValueOnce([])
    const out = await reconcileOneRow(X402_ROW)
    expect(out).toBe('settled') // the on-chain flip DID happen; only the credit is flagged
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.credit_failed',
      expect.objectContaining({ operationId: X402_OPID, developerId: 'dev-7', amountCents: 50 }),
      expect.any(Error),
    )
    expect(vi.mocked(logger.info)).not.toHaveBeenCalledWith('settlement.credited', expect.anything())
    expect(mockTx.update).toHaveBeenCalledTimes(1) // tools update never reached (rolled back)
  })

  // B4 SEMANTIC GUARD (2026-06-04): settlement-row account_id IS the owning
  // developer's id — the PERMANENT semantic (founder decision, option B; the A1
  // "backfill when provisioning lands" instruction is RETIRED). The reconciler
  // credits real money by matching developers.id = row.accountId; a "backfill"
  // of account_id to accounts.id would zero-match that UPDATE and un-credit
  // genuinely-collected USDC (loud since B4 — settlement.credit_failed — but
  // still un-credited). This pin makes any re-point of the credit linkage
  // break CI, not prod.
  // See docs/tech-debt/b4-account-attribution-resolution-2026-06-04.md.
  it("B4 SEMANTIC GUARD: the developer credited IS the row's account_id value", async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    const out = await reconcileOneRow(X402_ROW)
    expect(out).toBe('settled')
    expect(vi.mocked(eq)).toHaveBeenCalledWith(mockDevelopers.id, 'dev-7')
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
