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
  mockDbUpdateWhere,
  agg,
  sweepAgg,
  selectPlan,
  expiryPlan,
  mockNonceState,
  mockChainTs,
  mockExpired,
  mockFindRow,
  mockQuarantineReturning,
} = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    transaction: vi.fn(),
    // (S) db-level update chain — the per-row rotation-watermark UPDATE
    // (db.update(ledgerEntries).set({lastReconciledAt}).where(eq(id, row.id))).
    update: vi.fn(),
    set: vi.fn(),
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
  // (S) terminal of the watermark UPDATE chain (awaited per row).
  mockDbUpdateWhere: vi.fn(),
  // (S) overdue-aggregate result holder (the run's THIRD db.select() under the
  // (U) detectors-first order — terminates at .where()). error simulates the
  // aggregate query failing.
  agg: {
    value: [{ total: '0', noTxhash: '0', oldestCreatedAt: null }] as unknown[],
    error: null as Error | null,
  },
  // (T) uncredited-sweep aggregate (the run's FIRST db.select() under (U) —
  // the P1 detector emits first) + the bounded id-sample chain (the SECOND
  // select, only when the count is non-zero).
  sweepAgg: {
    value: [{ total: '0' }] as unknown[],
    error: null as Error | null,
    sample: [] as unknown[],
  },
  // (T) per-run select plan — replaces the (S) odd/even parity routing, which
  // cannot survive the sweep's extra selects per run (R2 audit fix B6).
  // (U) canonical order: sweep 1st → [sample] → overdue → window LAST.
  selectPlan: { seq: ['sweep', 'overdue', 'window'] as string[] },
  // (V) — the expiry pass's candidate SELECT (the run's select between the
  // overdue aggregate and the window under the (V) order) + the two bounded
  // engine readers + the evidence-CAS terminal writer.
  expiryPlan: { candidates: [] as unknown[] },
  mockNonceState: vi.fn(),
  mockChainTs: vi.fn(),
  mockExpired: vi.fn(),
  // (T) ledger mock for findSettlementRow (the CAS-reject re-read).
  mockFindRow: vi.fn(),
  // (V) ② seal — the quarantine-classify UPDATE's .returning({id}) terminal (the
  // truth CAS rowcount; default = one row classified).
  mockQuarantineReturning: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  ledgerEntries: {
    id: 'id',
    operationId: 'operation_id',
    rail: 'rail',
    externalRef: 'external_ref',
    settlementStatus: 'settlement_status',
    createdAt: 'created_at',
    settledAt: 'settled_at',
    lastReconciledAt: 'last_reconciled_at',
    creditedAt: 'credited_at',
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
  // (T) — the credited_at marker WHERE + the sweep's NULL-marker conjunct.
  isNull: vi.fn((a: unknown) => ({ isNull: a })),
  sql: mockSql,
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../circle-nano/settle-engine', () => ({
  confirmSettlementTx: mockConfirm,
  // (V) — the expiry pass's bounded readers.
  readAuthorizationStateBounded: mockNonceState,
  readSafeBlockTimestampBounded: mockChainTs,
}))
vi.mock('../ledger', () => ({
  markSettlementSettled: mockSettled,
  markSettlementFailed: mockFailed,
  // (V) — the expiry pass's evidence-CAS terminal writer.
  markSettlementExpiredNoBroadcast: mockExpired,
  // (T) — the CAS-reject disambiguation re-read.
  findSettlementRow: mockFindRow,
}))

import {
  parseSettlementOperationId,
  reconcileOneRow,
  reconcilePendingSettlements,
} from '../reconcile'
// Mocked above — imported for assertions (the B4 semantic-guard pin + log checks).
import { eq, inArray, isNull } from 'drizzle-orm'
import { logger } from '@/lib/logger'
// Mocked above — the schema token objects, for tx.update(<table>) identity asserts.
import { ledgerEntries } from '@/lib/db/schema'

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
  // (T) per-call select PLAN — replaces the (S) odd/even parity routing, which
  // cannot survive the sweep's extra selects per run (R2 audit fix B6).
  // (U) detectors-first canonical order: sweep 1st → [sample, when a test sets
  // a non-zero sweep count] → overdue → window LAST. Each run's selects cycle
  // through selectPlan.seq:
  //   'window'  → the existing mockDb chain (terminal .limit delegates to
  //               mockDb.limit, so mockDb.limit.mockResolvedValue(...) tests
  //               pass unedited);
  //   'overdue' → the pending-age aggregate (terminates at .where(); resolves
  //               agg.value / throws agg.error);
  //   'sweep'   → the (T) uncredited aggregate (same shape; sweepAgg);
  //   'sample'  → the (T) bounded id-sample chain (orderBy → limit), only
  //               when a test sets a non-zero sweep count.
  mockDb.select.mockImplementation(() => {
    const seq = selectPlan.seq
    const step = seq[(mockDb.select.mock.calls.length - 1) % seq.length]
    if (step === 'window') return mockDb
    if (step === 'expiry') {
      // (V) — the candidates SELECT: from→where→orderBy→limit.
      return {
        from: () => ({
          where: () => ({ orderBy: () => ({ limit: async () => expiryPlan.candidates }) }),
        }),
      }
    }
    if (step === 'sample') {
      return {
        from: () => ({
          where: () => ({ orderBy: () => ({ limit: async () => sweepAgg.sample }) }),
        }),
      }
    }
    const holder = step === 'sweep' ? sweepAgg : agg
    return {
      from: () => ({
        where: async () => {
          if (holder.error) throw holder.error
          return holder.value
        },
      }),
    }
  })
  agg.value = [{ total: '0', noTxhash: '0', oldestCreatedAt: null }]
  agg.error = null
  sweepAgg.value = [{ total: '0' }]
  sweepAgg.error = null
  sweepAgg.sample = []
  selectPlan.seq = ['sweep', 'overdue', 'expiry', 'window']
  expiryPlan.candidates = []
  mockNonceState.mockReset()
  mockNonceState.mockResolvedValue('unconsumed')
  mockChainTs.mockReset()
  // (V-N4) — the safe-block object: {ts, blockNumber}. ts far past every fixture
  // vb; blockNumber = the N the nonce read pins to.
  mockChainTs.mockResolvedValue({ ts: 9_999_999_999, blockNumber: 42n })
  mockExpired.mockReset()
  mockExpired.mockResolvedValue(true)
  // (T) findSettlementRow default: terminal row — flipped:false reads as a
  // concurrent-winner noop unless a test makes the row still-pending.
  mockFindRow.mockResolvedValue({ id: 'r1', settlementStatus: 'failed', externalRef: TX })
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.orderBy.mockReturnValue(mockDb)
  mockDb.limit.mockResolvedValue([])
  // (S) the per-row watermark UPDATE chain. (V) ② seal: where()'s return is an
  // awaitable that ALSO exposes .returning() — the watermark UPDATE awaits
  // where() directly while the quarantine-classify UPDATE chains .returning({id})
  // (the truth-CAS rowcount; same dual-shape pattern as the credit-txn mock).
  mockDb.update.mockReturnValue(mockDb)
  mockDb.set.mockReturnValue({ where: mockDbUpdateWhere })
  mockDbUpdateWhere.mockImplementation(() =>
    Object.assign(Promise.resolve([]), { returning: mockQuarantineReturning }),
  )
  mockQuarantineReturning.mockResolvedValue([{ id: 'exp-1' }])
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
    // (U) the reason-plumb: a plain unconfirmed logs the receipt-unavailable default.
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.unconfirmed',
      expect.objectContaining({ reason: 'receipt-unavailable' }),
    )
  })

  it('(U) LB-2 unconfirmed (revert-nonce-unverifiable) → leaves pending, no flip, reason surfaces in the log', async () => {
    mockConfirm.mockResolvedValue({ kind: 'unconfirmed', txHash: TX, reason: 'revert-nonce-unverifiable' })
    const out = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(out).toBe('pending-unconfirmed')
    expect(mockSettled).not.toHaveBeenCalled()
    expect(mockFailed).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.unconfirmed',
      expect.objectContaining({ reason: 'revert-nonce-unverifiable' }),
    )
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
  // (V-N2) — the row carries metadata.settledValueBaseUnits='300000' (= 30 cents,
  // the ACTUAL collected value) DISTINCT from the frozen amountCents=50: a
  // same-(from,nonce) re-sign under a LOWERED price. The reconciler must credit
  // the SETTLED 30, not the frozen 50 (non-vacuity: reverting the source to
  // row.amountCents credits 50 and these tests go RED).
  const X402_ROW = {
    operationId: X402_OPID,
    rail: 'x402',
    externalRef: TX,
    amountCents: 50,
    accountId: 'dev-7',
    metadata: { toolId: 'tool-9', settledValueBaseUnits: '300000' },
  }

  it('(V-N2) x402 settled + flipped → credits dev balance THEN tool revenue THEN the credited_at marker in ONE txn, by the SETTLED value (30c) NOT the frozen amountCents (50c)', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    const out = await reconcileOneRow(X402_ROW)
    expect(out).toBe('settled')
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(mockTx.update).toHaveBeenNthCalledWith(1, mockDevelopers)
    expect(mockTx.update).toHaveBeenNthCalledWith(2, mockTools)
    // (T) the credit marker rides the SAME transaction (lock order dev→tools→marker).
    expect(mockTx.update).toHaveBeenNthCalledWith(3, ledgerEntries)
    expect(mockTx.update).toHaveBeenCalledTimes(3)
    // (T) marker-WHERE shape: operationId + rail + settled + credited_at IS NULL.
    expect(vi.mocked(eq)).toHaveBeenCalledWith('operation_id', X402_OPID)
    expect(vi.mocked(eq)).toHaveBeenCalledWith('rail', 'x402')
    expect(vi.mocked(eq)).toHaveBeenCalledWith('settlement_status', 'settled')
    expect(vi.mocked(isNull)).toHaveBeenCalledWith('credited_at')
    // (V-N2) the SETTLED value (30) flows into BOTH sql interpolations — NOT 50.
    const sqlAmounts = mockSql.mock.calls.flatMap((c) => c.slice(1))
    expect(sqlAmounts.filter((v) => v === 30)).toHaveLength(2)
    expect(sqlAmounts.filter((v) => v === 50)).toHaveLength(0)
  })

  it("x402 settled but flip LOST (flipped===false) → NO credit (another actor owns the credit) + outcome 'settled-noop' (S item 3: not a transition THIS run performed)", async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(false)
    const out = await reconcileOneRow(X402_ROW)
    expect(out).toBe('settled-noop')
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('(V-N2) circle-nano settled + flipped → credits dev balance THEN tool revenue in ONE txn, by the SETTLED value (30c) NOT amountCents (50c) (Part C2 rail-agnostic widen)', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    const out = await reconcileOneRow({
      operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX,
      amountCents: 50, accountId: 'dev-7', metadata: { toolId: 'tool-9', settledValueBaseUnits: '300000' },
    })
    expect(out).toBe('settled')
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(mockTx.update).toHaveBeenNthCalledWith(1, mockDevelopers)
    expect(mockTx.update).toHaveBeenNthCalledWith(2, mockTools)
    // (T) + the credited_at marker, same transaction.
    expect(mockTx.update).toHaveBeenNthCalledWith(3, ledgerEntries)
    expect(mockTx.update).toHaveBeenCalledTimes(3)
    // (V-N2) the SETTLED value (30) flows into BOTH sql interpolations — NOT 50.
    const sqlAmounts = mockSql.mock.calls.flatMap((c) => c.slice(1))
    expect(sqlAmounts.filter((v) => v === 30)).toHaveLength(2)
    expect(sqlAmounts.filter((v) => v === 50)).toHaveLength(0)
  })

  it("circle-nano settled but flip LOST (flipped===false) → NO credit (exactly-once holds across the widen) + outcome 'settled-noop'", async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(false)
    const out = await reconcileOneRow({
      operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX,
      amountCents: 50, accountId: 'dev-7', metadata: { toolId: 'tool-9' },
    })
    expect(out).toBe('settled-noop')
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("reverted (nonce free) but flip LOST (flipped===false) → outcome 'failed-noop' (S item 3)", async () => {
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: TX, nonceConsumed: false })
    mockFailed.mockResolvedValue(false)
    const out = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(out).toBe('failed-noop')
    expect(mockSettled).not.toHaveBeenCalled()
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it("(T) reverted but flip CAS-REJECTED on a still-pending row → outcome 'pending-stale-ref' + stale-ref warn (the P2 disambiguation)", async () => {
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: TX, nonceConsumed: false })
    mockFailed.mockResolvedValue(false)
    // The re-read finds the row STILL PENDING with a re-pointed ref — the CAS
    // rejected stale evidence, not a concurrent terminal winner.
    mockFindRow.mockResolvedValue({ id: 'r1', settlementStatus: 'pending', externalRef: '0xNEWER' })
    const out = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(out).toBe('pending-stale-ref')
    expect(mockFindRow).toHaveBeenCalledWith(CNANO_OPID, 'circle-nano')
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'reconcile.failed_flip_stale_ref',
      { operationId: CNANO_OPID, rail: 'circle-nano', staleTxHash: TX, currentRef: '0xNEWER' },
    )
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
      // (V-N2) settled value present (50c) but NO toolId — credits the dev on the
      // primary settled path, skips the tool stat.
      amountCents: 50, accountId: 'dev-7', metadata: { settledValueBaseUnits: '500000' },
    })
    expect(out).toBe('settled')
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    // (T) developers + the credited_at marker (no tools update without a toolId).
    expect(mockTx.update).toHaveBeenCalledTimes(2)
    expect(mockTx.update).toHaveBeenNthCalledWith(1, mockDevelopers)
    expect(mockTx.update).toHaveBeenNthCalledWith(2, ledgerEntries)
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
      // (V-N2) the credited amount is the SETTLED value (30), not the frozen 50.
      expect.objectContaining({ operationId: X402_OPID, developerId: 'dev-7', amountCents: 30 }),
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

// ─── (V-N2) reconciler-tail credits the ACTUAL settled value ─────────────────
// The reconciler credits the value RECORDED AT BROADCAST (metadata.settledValueBaseUnits,
// the broadcasting proof's authorization.value), NOT the frozen first-write amountCents
// a same-(from,nonce) re-sign under a changed price can outpace. These reproduce the
// vector in BOTH directions + the boundary/fallback/recovery cases (§13.C/.E/.G/.I).
describe('(V-N2) reconcileOneRow — credits the settled value, not the frozen amountCents', () => {
  const row = (settledValueBaseUnits: string | undefined, amountCents = 50) => ({
    operationId: X402_OPID,
    rail: 'x402',
    externalRef: TX,
    amountCents,
    accountId: 'dev-7',
    metadata:
      settledValueBaseUnits === undefined
        ? { toolId: 'tool-9' }
        : { toolId: 'tool-9', settledValueBaseUnits },
  })
  // The numeric amounts interpolated into the two credit-increment sql templates
  // (developers.balanceCents + N, tools.totalRevenueCents + N) — N twice on a
  // successful dev+tool credit.
  const creditedAmounts = () =>
    mockSql.mock.calls.flatMap((c) => c.slice(1)).filter((v) => typeof v === 'number')

  beforeEach(() => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
  })

  it('PRICE-LOWERED (§13.C — the vector): frozen 50c, settled 30c → credits 30 (stops the over-credit), NEVER 50', async () => {
    const out = await reconcileOneRow(row('300000', 50)) // 300000 base units = 30c
    expect(out).toBe('settled')
    const amts = creditedAmounts()
    expect(amts.filter((v) => v === 30)).toHaveLength(2) // dev + tool
    expect(amts.filter((v) => v === 50)).toHaveLength(0) // the over-credit is gone
  })

  it('PRICE-RAISED (§13.C symmetry): frozen 50c, settled 70c → credits 70 (stops the under-credit), NEVER 50', async () => {
    const out = await reconcileOneRow(row('700000', 50)) // 700000 base units = 70c
    expect(out).toBe('settled')
    const amts = creditedAmounts()
    expect(amts.filter((v) => v === 70)).toHaveLength(2)
    expect(amts.filter((v) => v === 50)).toHaveLength(0)
  })

  it('LEGACY/IN-FLIGHT (§13.G): NO settledValueBaseUnits → credits the frozen amountCents + logs the legacy-fallback signal', async () => {
    const out = await reconcileOneRow(row(undefined, 50))
    expect(out).toBe('settled')
    expect(creditedAmounts().filter((v) => v === 50)).toHaveLength(2) // safe fallback
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'settlement.settled_value_legacy_fallback',
      expect.objectContaining({ operationId: X402_OPID, rail: 'x402', amountCents: 50 }),
    )
  })

  it('UNITS BOUNDARY (§13.E): a sub-cent settled value FLOORS down (305000 base units = 30.5c → credits 30, never 31)', async () => {
    const out = await reconcileOneRow(row('305000', 50)) // 30.5c → floor 30
    expect(out).toBe('settled')
    const amts = creditedAmounts()
    expect(amts.filter((v) => v === 30)).toHaveLength(2)
    expect(amts.filter((v) => v === 31)).toHaveLength(0) // never rounds/ceils up
  })

  it('UNITS BOUNDARY (§13.E): an OVERFLOWING settled value is NOT silently credited → falls back to amountCents + logs unconvertible', async () => {
    const out = await reconcileOneRow(row('1' + '0'.repeat(30), 50)) // 10^30 base units → cents >> MAX_SAFE
    expect(out).toBe('settled')
    expect(creditedAmounts().filter((v) => v === 50)).toHaveLength(2) // bounded fallback, not garbage
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.settled_value_unconvertible',
      expect.objectContaining({ operationId: X402_OPID, rail: 'x402', amountCents: 50 }),
    )
  })

  it('NONCE-CONSUMED RECOVERY (§13.I / DC-06): reverted-but-nonce-consumed with a recorded settled value → NEVER auto-credits, stays pending', async () => {
    // txB(P2=70c) reverted because txA(P1) confirmed concurrently (nonce consumed):
    // the recorded settledValueBaseUnits is NON-authoritative — the row must NOT
    // auto-credit (manual repair reads the on-chain Transfer, not this field).
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: TX, nonceConsumed: true })
    const out = await reconcileOneRow(row('700000', 50))
    expect(out).toBe('pending-nonce-consumed')
    expect(mockSettled).not.toHaveBeenCalled()
    expect(mockDb.transaction).not.toHaveBeenCalled() // no credit txn fires
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

// (S) helper — a recent (NOT overdue) window row with the id/createdAt fields
// the rotation SELECT now returns.
const winRow = (id: string, opId: string, rail: string) => ({
  id,
  createdAt: new Date(Date.now() - 10 * 60_000),
  operationId: opId,
  rail,
  externalRef: TX,
})

describe('reconcilePendingSettlements — bounded batch + summary', () => {
  it('reconciles each queried row and tallies the FULL summary (settled/failed/pending/skipped/noop/errored)', async () => {
    mockDb.limit.mockResolvedValue([
      winRow('r1', CNANO_OPID, 'circle-nano'),
      winRow('r2', CNANO_OPID, 'circle-nano'),
      winRow('r3', CNANO_OPID, 'circle-nano'),
      winRow('r4', X402_OPID, 'x402'),
      winRow('r5', X402_OPID, 'x402'),
    ])
    mockConfirm
      .mockResolvedValueOnce({ kind: 'settled', txHash: TX })
      .mockResolvedValueOnce({ kind: 'reverted', txHash: TX, nonceConsumed: false })
      .mockResolvedValueOnce({ kind: 'reverted', txHash: TX, nonceConsumed: true })
      .mockResolvedValueOnce({ kind: 'unsupported-network' })
      .mockResolvedValueOnce({ kind: 'settled', txHash: TX })
    // (S) the 5th row's flip is LOST to a concurrent winner → settled-noop.
    mockSettled.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const summary = await reconcilePendingSettlements({ limit: 25 })
    expect(summary.scanned).toBe(5)
    expect(summary.settled).toBe(1) // TRUE transitions only (S item 3)
    expect(summary.failed).toBe(1)
    expect(summary.pending).toBe(1) // the reverted + nonce-consumed row
    expect(summary.skipped).toBe(1) // the unsupported-network row
    expect(summary.noop).toBe(1) // the raced no-op flip
    expect(summary.errored).toBe(0)
    expect(summary.overdue).toBe(0) // default aggregate: nothing overdue
    expect(summary.uncredited).toBe(0) // (T) default sweep: no open incidents
    // Pin the aggregation arithmetic (a dropped term in the sums survives otherwise).
    expect(summary.outcomes['pending-nonce-consumed']).toBe(1)
    expect(summary.outcomes['skipped-unsupported']).toBe(1)
    expect(summary.outcomes['settled-noop']).toBe(1)
    // (S/③) truthful-telemetry invariant.
    expect(summary.scanned).toBe(
      summary.settled + summary.failed + summary.pending + summary.skipped + summary.noop + summary.errored + summary.deferred,
    )
    expect(mockDb.limit).toHaveBeenCalledWith(25)
  })

  it('(T) the uncredited sweep failing → uncredited:null + reconcile.uncredited_check_failed; the run still returns a full summary', async () => {
    sweepAgg.error = new Error('sweep agg boom')
    const summary = await reconcilePendingSettlements()
    expect(summary.uncredited).toBeNull()
    expect(summary.overdue).toBe(0) // the (S) overdue block is unaffected
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.uncredited_check_failed',
      {},
      expect.any(Error),
    )
  })

  it('(T) uncredited rows present → ONE reconcile.uncredited_settled error line with bare rail-prefixed operationIds (bounded sample)', async () => {
    selectPlan.seq = ['sweep', 'sample', 'overdue', 'expiry', 'window']
    sweepAgg.value = [{ total: '2' }]
    const oldSettled = new Date(Date.now() - 7_200_000)
    sweepAgg.sample = [
      { operationId: X402_OPID, settledAt: oldSettled },
      { operationId: CNANO_OPID, settledAt: new Date(Date.now() - 3_600_000) },
    ]
    const summary = await reconcilePendingSettlements()
    expect(summary.uncredited).toBe(2) // postgres-js STRING '2' → Number (DC-18)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.uncredited_settled',
      expect.objectContaining({
        uncreditedCount: 2,
        oldestSettledAt: oldSettled,
        // operation_id is rail-prefixed by construction — NO extra rail prefix.
        operationIds: [X402_OPID, CNANO_OPID],
      }),
    )
  })

  it('one row throwing does not abort the batch — and is counted in errored (S item 3)', async () => {
    mockDb.limit.mockResolvedValue([
      winRow('r1', CNANO_OPID, 'circle-nano'),
      winRow('r2', X402_OPID, 'x402'),
    ])
    mockConfirm
      .mockRejectedValueOnce(new Error('rpc boom'))
      .mockResolvedValueOnce({ kind: 'settled', txHash: TX })

    const summary = await reconcilePendingSettlements()
    expect(summary.scanned).toBe(2)
    expect(summary.settled).toBe(1) // the second row still processed
    expect(summary.errored).toBe(1) // the thrower no longer vanishes from every bucket
    expect(summary.scanned).toBe(
      summary.settled + summary.failed + summary.pending + summary.skipped + summary.noop + summary.errored + summary.deferred,
    )
  })

  it('(S) rotation watermark: ONE per-row UPDATE keyed to that row id, issued BEFORE that row is examined', async () => {
    mockDb.limit.mockResolvedValue([
      winRow('r1', CNANO_OPID, 'circle-nano'),
      winRow('r2', X402_OPID, 'x402'),
    ])
    mockConfirm.mockResolvedValue({ kind: 'unconfirmed', txHash: TX })

    await reconcilePendingSettlements()
    // one watermark UPDATE per selected row, keyed by eq(id, <that row's id>)
    expect(mockDbUpdateWhere).toHaveBeenCalledTimes(2)
    expect(vi.mocked(eq)).toHaveBeenCalledWith('id', 'r1')
    expect(vi.mocked(eq)).toHaveBeenCalledWith('id', 'r2')
    // mark-BEFORE-examine, per row: update(i) precedes confirm(i) precedes update(i+1)
    const u = mockDbUpdateWhere.mock.invocationCallOrder
    const c = mockConfirm.mock.invocationCallOrder
    expect(u[0]).toBeLessThan(c[0])
    expect(c[0]).toBeLessThan(u[1])
    expect(u[1]).toBeLessThan(c[1])
  })

  it('(S) zero selected rows → zero watermark UPDATEs', async () => {
    await reconcilePendingSettlements()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('(S) a failing watermark UPDATE never blocks examination — logged once with the count', async () => {
    mockDb.limit.mockResolvedValue([
      winRow('r1', CNANO_OPID, 'circle-nano'),
      winRow('r2', X402_OPID, 'x402'),
    ])
    mockDbUpdateWhere.mockRejectedValue(new Error('db blip'))
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })

    const summary = await reconcilePendingSettlements()
    expect(summary.settled).toBe(2) // both rows still examined + flipped
    // seal fix S10/S13: the operator can identify WHICH rows lost their
    // rotation slot and sees the underlying error.
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.watermark_update_failed',
      { count: 2, operationIds: [CNANO_OPID, X402_OPID] },
      expect.any(Error),
    )
  })

  it('(S) a watermark UPDATE rejecting with a NON-Error value (battery H6 pin) → bare catch holds, examination proceeds', async () => {
    mockDb.limit.mockResolvedValue([winRow('r1', CNANO_OPID, 'circle-nano')])
    mockDbUpdateWhere.mockRejectedValue('string-rejection')
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })

    const summary = await reconcilePendingSettlements()
    expect(summary.settled).toBe(1)
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.watermark_update_failed',
      { count: 1, operationIds: [CNANO_OPID] },
      'string-rejection',
    )
  })

  it('(S) pending-age alert: fires ONE classified reconcile.pending_overdue when overdue rows exist', async () => {
    // an overdue (10h) nonce-consumed sticky row is in this run's window…
    mockDb.limit.mockResolvedValue([
      { ...winRow('r1', CNANO_OPID, 'circle-nano'), createdAt: new Date(Date.now() - 10 * 3_600_000) },
    ])
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: TX, nonceConsumed: true })
    // …and the aggregate sees 3 overdue total, 1 of them settle-path-owned
    // (null external_ref). postgres-js returns aggregate values as STRINGS.
    agg.value = [{
      total: '3',
      noTxhash: '1',
      oldestCreatedAt: new Date(Date.now() - 10 * 3_600_000).toISOString(),
    }]

    const summary = await reconcilePendingSettlements()
    expect(summary.overdue).toBe(3)
    const alerts = vi.mocked(logger.error).mock.calls.filter((c) => c[0] === 'reconcile.pending_overdue')
    expect(alerts).toHaveLength(1) // one line per run, never per row
    const payload = alerts[0][1] as Record<string, unknown>
    expect(payload.overdueCount).toBe(3)
    expect(payload.noTxhashCount).toBe(1)
    expect(payload.overdueAfterMs).toBe(6 * 3_600_000)
    // (U) the classification moved to the post-loop carrier (the pre-loop
    // detectors-first alert cannot know what this run will examine).
    // ②-fix: error level — the (S)-sealed classification rode an error-level
    // payload into the Sentry mirror; warn is never mirrored (logger.ts).
    expect(payload.examinedThisRun).toBeUndefined()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.overdue_examined',
      expect.objectContaining({
        examinedThisRun: expect.objectContaining({
          nonceConsumed: 1,
          unconfirmed: 0,
          unparseable: 0,
          unsupported: 0,
          errored: 0,
        }),
        overdueAfterMs: 6 * 3_600_000,
      }),
    )
    // the string-typed min(created_at) converts to a real, finite age (DC-18 NaN guard)
    expect(Number.isFinite(payload.oldestPendingAgeMs)).toBe(true)
    expect(payload.oldestPendingAgeMs as number).toBeGreaterThan(0)
  })

  it('(S) pending-age alert: silent when nothing is overdue', async () => {
    mockDb.limit.mockResolvedValue([winRow('r1', CNANO_OPID, 'circle-nano')])
    mockConfirm.mockResolvedValue({ kind: 'unconfirmed', txHash: TX })

    const summary = await reconcilePendingSettlements()
    expect(summary.overdue).toBe(0)
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith('reconcile.pending_overdue', expect.anything())
  })

  it('(③) run budget exhausted → remaining rows DEFERRED (not examined, NOT watermarked, keep their queue place) and the overdue aggregate + alert + summary still emit', async () => {
    mockDb.limit.mockResolvedValue([
      winRow('r1', CNANO_OPID, 'circle-nano'),
      winRow('r2', X402_OPID, 'x402'),
    ])
    // first row's confirm takes ~25ms; budget of 10ms expires before row 2
    mockConfirm.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25))
      return { kind: 'settled', txHash: TX }
    })
    agg.value = [{ total: '1', noTxhash: '0', oldestCreatedAt: new Date(Date.now() - 7 * 3_600_000).toISOString() }]

    const summary = await reconcilePendingSettlements({ runBudgetMs: 10 })
    expect(mockConfirm).toHaveBeenCalledTimes(1) // row 2 never examined
    expect(mockDbUpdateWhere).toHaveBeenCalledTimes(1) // row 2 never watermarked (keeps queue place)
    expect(summary.scanned).toBe(2)
    expect(summary.settled).toBe(1)
    expect(summary.deferred).toBe(1)
    // the alert still emitted despite the exhausted budget — the truncation fix
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith('reconcile.pending_overdue', expect.anything())
    expect(summary.scanned).toBe(
      summary.settled + summary.failed + summary.pending + summary.skipped + summary.noop + summary.errored + summary.deferred,
    )
  })

  it('(③) zero run budget → entire window deferred, zero examinations, summary + aggregate still complete', async () => {
    mockDb.limit.mockResolvedValue([
      winRow('r1', CNANO_OPID, 'circle-nano'),
      winRow('r2', X402_OPID, 'x402'),
    ])
    const summary = await reconcilePendingSettlements({ runBudgetMs: 0 })
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
    expect(summary.deferred).toBe(2)
    expect(summary.overdue).toBe(0) // aggregate still ran (default agg)
  })

  it('(S) the overdue check failing never aborts the run: overdue=null + reconcile.overdue_check_failed', async () => {
    mockDb.limit.mockResolvedValue([winRow('r1', CNANO_OPID, 'circle-nano')])
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    agg.error = new Error('aggregate boom')

    const summary = await reconcilePendingSettlements()
    expect(summary.scanned).toBe(1)
    expect(summary.settled).toBe(1) // the run completed normally
    expect(summary.overdue).toBeNull()
    // (U) the S11 fallback payload is superseded: the catch fires PRE-loop
    // (nothing examined yet — payload {}); classification surfaces via the
    // post-loop reconcile.overdue_examined carrier (pinned below).
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.overdue_check_failed',
      {},
      expect.any(Error),
    )
  })

  it('(U) S11-successor: aggregate fails + examined sticky overdue row → overdue_check_failed({}) AND the overdue_examined carrier BOTH emit', async () => {
    mockDb.limit.mockResolvedValue([
      { ...winRow('r1', CNANO_OPID, 'circle-nano'), createdAt: new Date(Date.now() - 10 * 3_600_000) },
    ])
    mockConfirm.mockResolvedValue({ kind: 'unconfirmed', txHash: TX })
    agg.error = new Error('aggregate boom')

    const summary = await reconcilePendingSettlements()
    expect(summary.overdue).toBeNull()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.overdue_check_failed',
      {},
      expect.any(Error),
    )
    // the classification still surfaces — via the carrier, regardless of the
    // aggregate's own outcome (strictly stronger than the old S11 fallback).
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.overdue_examined',
      expect.objectContaining({
        examinedThisRun: expect.objectContaining({ unconfirmed: 1 }),
        overdueAfterMs: 6 * 3_600_000,
      }),
    )
  })

  it('(U) overdue_examined carrier: SILENT when this run examined no overdue rows', async () => {
    mockDb.limit.mockResolvedValue([winRow('r1', CNANO_OPID, 'circle-nano')]) // 10min old — not overdue
    mockConfirm.mockResolvedValue({ kind: 'unconfirmed', txHash: TX })
    await reconcilePendingSettlements()
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith('reconcile.overdue_examined', expect.anything())
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalledWith('reconcile.overdue_examined', expect.anything())
  })

  it('(S) aggregate returning ZERO rows (battery H1 pin) → destructure caught, overdue=null, run completes', async () => {
    agg.value = []
    mockDb.limit.mockResolvedValue([winRow('r1', CNANO_OPID, 'circle-nano')])
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })

    const summary = await reconcilePendingSettlements()
    expect(summary.scanned).toBe(1)
    expect(summary.settled).toBe(1)
    expect(summary.overdue).toBeNull()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.overdue_check_failed',
      expect.anything(),
      expect.anything(),
    )
  })

  it('selects ONLY the on-chain RECONCILABLE_RAILS (pins the by-construction link with the (H) hop guard)', async () => {
    mockDb.limit.mockResolvedValue([])
    await reconcilePendingSettlements()
    // The reconciler's WHERE gates rail on inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS]); the hop
    // guard (rails.ts isReconcilableRail) excludes EXACTLY this set, so a hop row's rail is never in the
    // reconciler's selection set — provable by construction via the shared constant.
    expect(inArray).toHaveBeenCalledWith('rail', ['circle-nano', 'x402'])
  })
})

// ─── (V) — the expiry pass (P5-ii), P8-c, and the C4 rider ──────────────────────────────
describe('(V) reconcilePendingSettlements — the expiry pass (terminalization-evidence invariant)', () => {
  const NOW_SEC = Math.floor(Date.now() / 1000)
  const VB_EXPIRED = String(NOW_SEC - 7_200) // wall-expired by 2h
  const candidate = (over: Record<string, unknown> = {}) => ({
    id: 'exp-1',
    createdAt: new Date(Date.now() - 7_200_000),
    operationId: CNANO_OPID,
    rail: 'circle-nano',
    externalRef: null,
    metadata: { validBefore: VB_EXPIRED, toolId: 't1' },
    ...over,
  })
  const expirySeq = () => {
    selectPlan.seq = ['sweep', 'overdue', 'expiry', 'window']
  }
  /** The quarantine/classification UPDATE payloads (metadata sql-merges) — distinguished
   *  from the per-candidate watermark UPDATEs ({lastReconciledAt}). */
  const metadataSetCalls = () =>
    mockDb.set.mock.calls.filter((c) => (c[0] as Record<string, unknown>).metadata !== undefined)

  it('R-V12 (THE adversarial case): a mined-then-expired row (expired AND nonce CONSUMED) QUARANTINES with the alert — NEVER flips failed — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate()]
    mockNonceState.mockResolvedValue('consumed')
    await reconcilePendingSettlements()
    expect(mockExpired).not.toHaveBeenCalled()
    expect(mockFailed).not.toHaveBeenCalled()
    expect(metadataSetCalls().length).toBe(1) // the quarantine merge
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.expired_nonce_consumed_quarantined',
      expect.objectContaining({ operationId: CNANO_OPID, rail: 'circle-nano', validBefore: VB_EXPIRED }),
    )
  })

  it('R-V27 (② seal S1 — the truth CAS): a consumed-arm row that acquired a LIVE ref mid-pass (classify matches 0 rows) emits NO untracked alert and counts NO quarantine — FAILS PRE-FIX', async () => {
    // The race: candidate SELECT read the row at ref NULL; a buyer re-sign ran the
    // full live path during the pass's bounded reads (refresh vb2 → broadcast T2 →
    // onBroadcast committed ref=T2 → T2 MINED). The nonce read then returns
    // 'consumed' — but the consumption is TRACKED (ref=T2 on the row). The
    // classify UPDATE's isNull(external_ref) CAS matches 0 rows; the P8(b)
    // 'untracked' alert and the quarantined tally MUST stay silent (DC-18 — a
    // false fire of the one alert guarding real untracked losses).
    expirySeq()
    expiryPlan.candidates = [candidate()]
    mockNonceState.mockResolvedValue('consumed')
    mockQuarantineReturning.mockResolvedValue([]) // the truth CAS: row no longer ref-NULL
    await reconcilePendingSettlements()
    expect(mockExpired).not.toHaveBeenCalled()
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith(
      'reconcile.expired_nonce_consumed_quarantined',
      expect.anything(),
    )
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.expiry_pass',
      expect.objectContaining({ examined: 1, terminalized: 0, quarantined: 0 }),
    )
  })

  it('R-V28 (② seal S1 — arg-shape pin): the quarantine UPDATE WHERE carries isNull(external_ref) — the classify domain is ref-NULL rows only — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate({ metadata: null })] // legacy arm — classify fires
    await reconcilePendingSettlements()
    // call #1 = the watermark where; call #2 = the quarantine where
    const quarantineWhereArg = mockDbUpdateWhere.mock.calls[1]?.[0] as { and?: unknown[] }
    expect(quarantineWhereArg).toBeDefined()
    expect(
      (quarantineWhereArg.and ?? []).some(
        (n) => (n as Record<string, unknown>).isNull === 'external_ref',
      ),
    ).toBe(true)
  })

  it('R-V29 (② seal S1/S3 — truthful counters): the one-shot expiry_unprovable is gated on the classify rowcount, and quarantined never counts an uncommitted classify — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate({ metadata: null })] // legacy arm
    mockQuarantineReturning.mockResolvedValue([]) // classify matched 0 rows
    await reconcilePendingSettlements()
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith(
      'reconcile.expiry_unprovable',
      expect.anything(),
    )
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.expiry_pass',
      expect.objectContaining({ examined: 1, quarantined: 0 }),
    )
  })

  it('R-V13: expired + UNCONSUMED terminalizes via the evidence-CAS writer (proved value = the candidate-read bound) — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate()]
    mockNonceState.mockResolvedValue('unconsumed')
    mockChainTs.mockResolvedValue({ ts: NOW_SEC - 100, blockNumber: 555n }) // chain past vb (vb = now-7200)
    await reconcilePendingSettlements()
    expect(mockExpired).toHaveBeenCalledWith(
      CNANO_OPID,
      'circle-nano',
      VB_EXPIRED,
      expect.objectContaining({ chainTs: NOW_SEC - 100 }),
    )
    // (V-N4 / ③ TF-2 / DC-05) the evidence is the SCALAR-only shape {chainTs, checkedAt}.
    // objectContaining above is a SUPERSET match — it would PASS even if a build embedded
    // {ts,blockNumber}; this EXACT-keys assertion is the runtime guard against the object
    // leaking (tsc's typed evidence param is the compile-time one).
    const expiredEvidence = mockExpired.mock.calls[0][3] as Record<string, unknown>
    expect(Object.keys(expiredEvidence).sort()).toEqual(['chainTs', 'checkedAt'])
    expect(expiredEvidence).not.toHaveProperty('blockNumber')
    expect(mockFailed).not.toHaveBeenCalled() // never the (T) failed-CAS writer
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.expired_terminalized',
      expect.objectContaining({ operationId: CNANO_OPID, validBefore: VB_EXPIRED }),
    )
  })

  it('R-V30 (V-N4 — THE threading fix, UNTESTED at the reconcile boundary pre-V-N4): the nonce read is PINNED to the cached safe block N (4th arg === chainTs.blockNumber, not "latest"/a wrong value) — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate()]
    mockChainTs.mockResolvedValue({ ts: NOW_SEC - 100, blockNumber: 777n }) // safe block N = 777
    mockNonceState.mockResolvedValue('unconsumed')
    await reconcilePendingSettlements()
    expect(mockNonceState).toHaveBeenCalledWith('eip155:8453', FROM, NONCE, 777n)
  })

  it("R-V14: a FAILED nonce read ('unknown') leaves the row pending and unclassified — but the pass is TRUTHFUL about it — FAILS PRE-FIX", async () => {
    expirySeq()
    expiryPlan.candidates = [candidate()]
    mockNonceState.mockResolvedValue('unknown')
    await reconcilePendingSettlements()
    expect(mockNonceState).toHaveBeenCalled() // positive assert (R1-I4)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.expiry_pass',
      expect.objectContaining({ examined: 1, unknown: 1, terminalized: 0 }),
    )
    expect(mockExpired).not.toHaveBeenCalled()
    expect(metadataSetCalls().length).toBe(0)
  })

  it('R-V31 (V-N4 / DC-18 — the anchor-degradation backstop): a pass that examined ≥1 candidate, read nonce "unknown", terminalized+quarantined NOTHING fires reconcile.expiry_anchor_degraded ON THE SAME RUN; a normal terminalizing pass does NOT — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate()]
    mockNonceState.mockResolvedValue('unknown') // pinned read cannot serve N → unknown
    await reconcilePendingSettlements()
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.expiry_anchor_degraded',
      expect.objectContaining({ examined: 1, unknown: 1, terminalized: 0, quarantined: 0 }),
    )
    // a normal pass (something terminalized) does NOT fire it
    vi.mocked(logger.error).mockClear()
    mockNonceState.mockResolvedValue('unconsumed')
    await reconcilePendingSettlements()
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith(
      'reconcile.expiry_anchor_degraded',
      expect.anything(),
    )
  })

  it('R-V15: a LEGACY row (no stored validBefore) quarantines legacy-no-validbefore WITHOUT touching the chain; NULL-metadata rows classify via the COALESCE merge — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate({ metadata: { toolId: 't1' } }), candidate({ id: 'exp-2', metadata: null })]
    await reconcilePendingSettlements()
    expect(mockNonceState).not.toHaveBeenCalled()
    expect(mockChainTs).not.toHaveBeenCalled()
    const merges = metadataSetCalls()
    expect(merges.length).toBe(2)
    for (const call of merges) {
      const node = (call[0] as { metadata: { __sql: TemplateStringsArray; vals: unknown[] } }).metadata
      const joined = Array.from(node.__sql ?? []).join('#')
      expect(joined).toContain('COALESCE(') // the R1-B1 NULL-strictness rule
      expect(node.vals).toContain('legacy-no-validbefore')
    }
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.expiry_unprovable',
      expect.objectContaining({ expiryClass: 'legacy-no-validbefore' }),
    )
  })

  it('R-V16: a within-margin row is examined but untouched (no readers, no classification) — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate({ metadata: { validBefore: String(NOW_SEC - 10) } })] // inside vb+300
    await reconcilePendingSettlements()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.expiry_pass',
      expect.objectContaining({ examined: 1, terminalized: 0 }),
    )
    expect(mockNonceState).not.toHaveBeenCalled()
    expect(mockChainTs).not.toHaveBeenCalled()
    expect(metadataSetCalls().length).toBe(0)
  })

  it('R-V17: detector EMISSION happens-before the first expiry-pass chain read (invocationCallOrder — the order pin)', async () => {
    expirySeq()
    agg.value = [{ total: '2', noTxhash: '1', oldestCreatedAt: null }] // overdue fires
    expiryPlan.candidates = [candidate()]
    await reconcilePendingSettlements()
    const overdueEmit = vi.mocked(logger.error).mock.invocationCallOrder[
      vi.mocked(logger.error).mock.calls.findIndex((c) => c[0] === 'reconcile.pending_overdue')
    ]
    const firstChainRead = mockChainTs.mock.invocationCallOrder[0]
    expect(overdueEmit).toBeDefined()
    expect(firstChainRead).toBeDefined()
    expect(overdueEmit).toBeLessThan(firstChainRead)
  })

  it('R-V18: the candidates SELECT WHERE carries the classified-row exclusion + the never-broadcast predicate (arg-shape pin)', async () => {
    expirySeq()
    await reconcilePendingSettlements()
    const sqlTemplates = mockSql.mock.calls.map((c) => Array.from(c[0] as TemplateStringsArray).join('#'))
    expect(sqlTemplates.some((t) => t.includes("'expiryClass'") && t.includes('IS NULL'))).toBe(true)
    const isNullCalls = vi.mocked(isNull).mock.calls.map((c) => c[0])
    expect(isNullCalls).toContain('external_ref')
  })

  it('R-V23: a PRESENT-but-malformed validBefore quarantines unparseable BEFORE any comparison — the readers are never called — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [
      candidate({ id: 'm1', metadata: { validBefore: '' } }),
      candidate({ id: 'm2', metadata: { validBefore: 'abc' } }),
      candidate({ id: 'm3', metadata: { validBefore: '0' } }),
    ]
    await reconcilePendingSettlements()
    expect(mockNonceState).not.toHaveBeenCalled()
    expect(mockChainTs).not.toHaveBeenCalled()
    expect(mockExpired).not.toHaveBeenCalled()
    const merges = metadataSetCalls()
    expect(merges.length).toBe(3)
    for (const call of merges) {
      const node = (call[0] as { metadata: { vals: unknown[] } }).metadata
      expect(node.vals).toContain('unparseable')
    }
  })

  it('R-V24: wall-expired but NOT chain-expired (sequencer catch-up shape) SKIPS — and a null chain read stays pending as unknown — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate()]
    mockChainTs.mockResolvedValue({ ts: Number(VB_EXPIRED) - 10, blockNumber: 100n }) // chain has NOT passed the bound
    await reconcilePendingSettlements()
    expect(mockChainTs).toHaveBeenCalled() // positive assert (R2-imp5)
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.expiry_pass',
      expect.objectContaining({ examined: 1, terminalized: 0 }),
    )
    expect(mockExpired).not.toHaveBeenCalled()
    expect(mockNonceState).not.toHaveBeenCalled()

    vi.mocked(logger.info).mockClear()
    vi.mocked(logger.error).mockClear()
    mockChainTs.mockResolvedValue(null) // the safe read failed — DC-08 direction
    await reconcilePendingSettlements()
    expect(mockExpired).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.expiry_pass',
      expect.objectContaining({ examined: 1, unknown: 1, terminalized: 0 }),
    )
    // (V-N4 / ③ TF-7 / DC-18) the NULL-safe-head-anchor route ALSO increments stats.unknown
    // and MUST fire the same-run degradation page BY NAME — pin it (R-V31 only covers the
    // nonce-'unknown' route into the same counter; this is the chainTs===null route).
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.expiry_anchor_degraded',
      expect.objectContaining({ examined: 1, unknown: 1, terminalized: 0, quarantined: 0 }),
    )
  })

  it('R-V25: the refreshed (raised) bound governs — chainTs past the STALE vb1 but not the stored vb2 → NO terminalization — FAILS PRE-FIX', async () => {
    expirySeq()
    const vb2 = String(NOW_SEC - 400) // raised by a re-sign; still wall-expired (now > vb2+300)
    expiryPlan.candidates = [candidate({ metadata: { validBefore: vb2 } })]
    mockChainTs.mockResolvedValue({ ts: NOW_SEC - 1_000, blockNumber: 200n }) // ∈ (vb1, vb2): past the old bound only
    await reconcilePendingSettlements()
    expect(mockChainTs).toHaveBeenCalled()
    expect(mockExpired).not.toHaveBeenCalled()
    expect(mockNonceState).not.toHaveBeenCalled()
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      'reconcile.expiry_pass',
      expect.objectContaining({ examined: 1, terminalized: 0 }),
    )
  })

  it('R-V26: an out-of-allowlist network (eip155:1 — IN USDC_ADDRESSES, NOT canonical) quarantines unsupported-network before ANY read — FAILS PRE-FIX', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate({ operationId: `circle-nano:eip155:1:${FROM}:${NONCE}` })]
    await reconcilePendingSettlements()
    expect(mockNonceState).not.toHaveBeenCalled()
    expect(mockChainTs).not.toHaveBeenCalled()
    expect(mockExpired).not.toHaveBeenCalled()
    const merges = metadataSetCalls()
    expect(merges.length).toBe(1)
    expect((merges[0][0] as { metadata: { vals: unknown[] } }).metadata.vals).toContain('unsupported-network')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'reconcile.expiry_unprovable',
      expect.objectContaining({ expiryClass: 'unsupported-network' }),
    )
  })

  it('R-V21: summary identity holds with a non-empty pass — expiry work appears in NO summary bucket (scanned counts window rows only)', async () => {
    expirySeq()
    expiryPlan.candidates = [candidate()]
    mockNonceState.mockResolvedValue('unknown')
    mockDb.limit.mockResolvedValue([
      { id: 'w1', createdAt: new Date(Date.now() - 600_000), operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX, amountCents: 5, accountId: 'dev-7', metadata: null },
    ])
    mockConfirm.mockResolvedValue({ kind: 'unconfirmed', txHash: TX })
    const summary = await reconcilePendingSettlements()
    expect(summary.scanned).toBe(1)
    expect(summary.scanned).toBe(
      summary.settled + summary.failed + summary.pending + summary.skipped + summary.noop + summary.errored + summary.deferred,
    )
    expect(Object.keys(summary).sort()).toEqual(
      ['deferred', 'errored', 'failed', 'noop', 'outcomes', 'overdue', 'pending', 'scanned', 'settled', 'skipped', 'uncredited'].sort(),
    )
  })
})

describe('(V) reconcileOneRow — P8-c (the settled-noop failed-row re-read) + the C4 rider', () => {
  it("R-V19: a settled confirmation whose flip no-ops onto a terminally FAILED row emits the (T) receipt-time alert key (divergent receipt views NAMED, not lumped) — FAILS PRE-FIX", async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(false) // WHERE-pending no-match
    mockFindRow.mockResolvedValue({ id: 'r1', settlementStatus: 'failed', externalRef: '0xOTHER' })
    const outcome = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(outcome).toBe('settled-noop') // tally unchanged — summary identity pinned
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.settled_evidence_on_terminal_failed_row',
      expect.objectContaining({ operationId: CNANO_OPID, rowStatus: 'failed', winningTxHash: TX, storedRef: '0xOTHER' }),
    )
  })

  it('R-V19-settled: a settled-noop onto an already-SETTLED row stays silent (a normal raced winner, not the mirror)', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(false)
    mockFindRow.mockResolvedValue({ id: 'r1', settlementStatus: 'settled', externalRef: TX })
    const outcome = await reconcileOneRow({ operationId: CNANO_OPID, rail: 'circle-nano', externalRef: TX })
    expect(outcome).toBe('settled-noop')
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith(
      'settlement.settled_evidence_on_terminal_failed_row',
      expect.anything(),
    )
  })

  it('R-V20: a tools-stat UPDATE matching ZERO rows logs credit_tool_stat_unmatched and NEVER throws — the developer credit still commits (C4) — FAILS PRE-FIX', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    mockReturning
      .mockResolvedValueOnce([{ id: 'dev-7' }]) // developers UPDATE — credit lands
      .mockResolvedValueOnce([]) // tools UPDATE — dangling toolId
      .mockResolvedValueOnce([{ id: 'r1' }]) // credited_at marker
    const outcome = await reconcileOneRow({
      operationId: CNANO_OPID,
      rail: 'circle-nano',
      externalRef: TX,
      amountCents: 50,
      accountId: 'dev-7',
      metadata: { toolId: 'ghost-tool' },
    })
    expect(outcome).toBe('settled')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.credit_tool_stat_unmatched',
      expect.objectContaining({ operationId: CNANO_OPID, toolId: 'ghost-tool' }),
    )
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith('settlement.credited', expect.anything())
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith('settlement.credit_failed', expect.anything(), expect.anything())
  })

  it('R-V30 (② seal S4): credit_tool_stat_unmatched is emitted only AFTER the credit transaction COMMITS — a marker-write rollback emits credit_failed alone, never the stat alert for a credit that never landed — FAILS PRE-FIX', async () => {
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: TX })
    mockSettled.mockResolvedValue(true)
    mockReturning
      .mockResolvedValueOnce([{ id: 'dev-7' }]) // developers UPDATE — credit lands (pre-rollback)
      .mockResolvedValueOnce([]) // tools UPDATE — dangling toolId
      .mockRejectedValueOnce(new Error('marker write failed')) // credited_at marker → tx ROLLS BACK
    await reconcileOneRow({
      operationId: CNANO_OPID,
      rail: 'circle-nano',
      externalRef: TX,
      amountCents: 50,
      accountId: 'dev-7',
      metadata: { toolId: 'ghost-tool' },
    })
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.credit_failed',
      expect.anything(),
      expect.anything(),
    )
    expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith(
      'settlement.credit_tool_stat_unmatched',
      expect.anything(),
    )
  })
})
