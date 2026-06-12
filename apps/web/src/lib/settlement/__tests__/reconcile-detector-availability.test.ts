/**
 * (U) — the detector-availability STRUCTURAL guarantee (the P4 ③-escalation's bar):
 * "No single RPC call can prevent the reconcile run's detectors (reconcile.pending_overdue,
 * reconcile.uncredited_settled) from emitting." The (U) reorder runs both detector aggregates
 * (sweep FIRST — the P1 loss detector) BEFORE the window SELECT and the examination loop, so
 * detector emission happens-before every RPC call and every loop DB write.
 *
 * Harness: SHAPE-dispatched (starvation-suite style — a select that reaches .orderBy().limit()
 * is the window; a select awaited at .where() is an aggregate), NOT call-order dispatched, so
 * this file runs CORRECTLY against PRE-fix and POST-fix reconcile.ts alike: red/green lands on
 * the TIMELINE ASSERT, never on a harness error (the vacuous-red rule). Both tests 1 and 3 FAIL
 * against the pre-(U) reconciler (aggregates trail the loop); test 2 FAILS pre-(U) because the
 * thrown window SELECT propagates before any aggregate runs. Empirical pre-fix red captures:
 * .audit/u-build/.
 *
 * Aggregate counts stay 0 here (no sample select — its chain shape would collide with the
 * window's; the sample path is covered by reconcile.test.ts's order-dispatched harness).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { state, timeline, mockDb, drizzleMock, ledgerEntriesMock, mockConfirm, mockSettled, mockFailed, mockFindRow } =
  vi.hoisted(() => {
    const timeline: string[] = []
    const state = {
      windowRows: [] as unknown[],
      windowThrows: false,
      aggCount: 0,
      // (②-fix M2) per-aggregate count control: a non-zero OVERDUE total lets the
      // suite pin ALERT EMISSION order, not just query resolution. The sweep total
      // stays '0' (a non-zero sweep spawns the id-sample select, whose
      // .orderBy().limit() shape would collide with the window dispatch).
      overdueTotal: '0',
    }
    const mockDb = {
      select: () => {
        const afterWhere = {
          orderBy: () => ({
            limit: async () => {
              timeline.push('window')
              if (state.windowThrows) throw new Error('window select boom')
              return state.windowRows
            },
          }),
          // Aggregates (sweep + overdue) are awaited at .where() — thenable. postgres-js
          // returns count(*) as a STRING (DC-18).
          then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
            state.aggCount += 1
            timeline.push(`agg:${state.aggCount}`)
            // agg:1 = the sweep (always 0 — see the overdueTotal note); agg:2 = overdue.
            const total = state.aggCount === 2 ? state.overdueTotal : '0'
            return Promise.resolve([{ total, noTxhash: '0', oldestCreatedAt: null }]).then(resolve, reject)
          },
        }
        const chain = { from: () => chain, where: () => afterWhere }
        return chain
      },
      // per-row rotation watermark UPDATE — inert here.
      update: () => ({ set: () => ({ where: async () => [] }) }),
      transaction: vi.fn(async () => {
        throw new Error('detector-availability test: db.transaction must not be reached')
      }),
    }
    const drizzleMock = {
      and: (...args: unknown[]) => ({ and: args }),
      eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
      inArray: (a: unknown, b: unknown) => ({ inArray: [a, b] }),
      lt: (a: unknown, b: unknown) => ({ lt: [a, b] }),
      asc: (a: unknown) => ({ asc: a }),
      isNotNull: (a: unknown) => ({ isNotNull: a }),
      isNull: (a: unknown) => ({ isNull: a }),
      sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: strings, vals }),
    }
    const ledgerEntriesMock = {
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
    }
    const mockConfirm = vi.fn()
    const mockSettled = vi.fn(async () => true)
    const mockFailed = vi.fn(async () => false)
    const mockFindRow = vi.fn(async () => null)
    return { state, timeline, mockDb, drizzleMock, ledgerEntriesMock, mockConfirm, mockSettled, mockFailed, mockFindRow }
  })

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  ledgerEntries: ledgerEntriesMock,
  developers: { id: 'developers.id', balanceCents: 'developers.balanceCents' },
  tools: { id: 'tools.id', totalRevenueCents: 'tools.totalRevenueCents' },
}))
vi.mock('drizzle-orm', () => drizzleMock)
// (②-fix M2) the error logger ALSO stamps the shared timeline so the suite pins
// EMISSION order (the bar's literal "emitting"), not just query resolution — a
// regression that keeps the aggregates pre-loop but hoists the alert lines
// post-loop must go red HERE, not only in the seal-time battery's source checks.
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn((msg: string) => {
      timeline.push(`emit:${msg}`)
    }),
  },
}))
vi.mock('../circle-nano/settle-engine', () => ({ confirmSettlementTx: mockConfirm }))
vi.mock('../ledger', () => ({
  markSettlementSettled: mockSettled,
  markSettlementFailed: mockFailed,
  findSettlementRow: mockFindRow,
}))

import { reconcilePendingSettlements } from '../reconcile'

const FROM = `0x${'a'.repeat(40)}`
const NONCE = `0x${'b'.repeat(64)}`
const TX = `0x${'c'.repeat(64)}`

const row = () => ({
  id: 'r1',
  createdAt: new Date(Date.now() - 10 * 60_000),
  operationId: `circle-nano:eip155:8453:${FROM}:${NONCE}`,
  rail: 'circle-nano',
  externalRef: TX,
  amountCents: null,
  accountId: null,
  metadata: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  timeline.length = 0
  state.aggCount = 0
  state.windowThrows = false
  state.overdueTotal = '0'
  state.windowRows = [row()]
  mockConfirm.mockImplementation(async () => {
    timeline.push('confirm')
    return { kind: 'unconfirmed', txHash: TX }
  })
})

describe('(U) detectors-first — emission happens-before every RPC call', () => {
  it('both detector aggregates resolve BEFORE the first examination RPC and BEFORE the window SELECT', async () => {
    const summary = await reconcilePendingSettlements()
    expect(summary.uncredited).toBe(0) // the sweep RAN (not null)
    expect(summary.overdue).toBe(0) // the overdue aggregate RAN
    expect(timeline.indexOf('agg:1')).toBeGreaterThanOrEqual(0)
    expect(timeline.indexOf('agg:2')).toBeGreaterThanOrEqual(0)
    expect(timeline.indexOf('confirm')).toBeGreaterThanOrEqual(0)
    // the structural guarantee: detectors happen-before any RPC…
    expect(timeline.indexOf('agg:1')).toBeLessThan(timeline.indexOf('confirm'))
    expect(timeline.indexOf('agg:2')).toBeLessThan(timeline.indexOf('confirm'))
    // …and before the window SELECT itself (nothing loop-shaped precedes them)
    expect(timeline.indexOf('agg:1')).toBeLessThan(timeline.indexOf('window'))
    expect(timeline.indexOf('agg:2')).toBeLessThan(timeline.indexOf('window'))
  })

  it('detectors emit even when the window SELECT throws (strictly better than pre-(U))', async () => {
    state.windowThrows = true
    await expect(reconcilePendingSettlements()).rejects.toThrow('window select boom')
    // both aggregates already resolved before the throw propagated
    expect(timeline.indexOf('agg:1')).toBeGreaterThanOrEqual(0)
    expect(timeline.indexOf('agg:2')).toBeGreaterThanOrEqual(0)
    expect(timeline.indexOf('agg:1')).toBeLessThan(timeline.indexOf('window'))
    expect(timeline.indexOf('agg:2')).toBeLessThan(timeline.indexOf('window'))
  })

  it('a slow examination cannot delay detector emission (the escalation\'s starvation shape)', async () => {
    mockConfirm.mockImplementation(async () => {
      timeline.push('confirm:start')
      await new Promise((r) => setTimeout(r, 50))
      return { kind: 'unconfirmed', txHash: TX }
    })
    await reconcilePendingSettlements()
    expect(timeline.indexOf('confirm:start')).toBeGreaterThanOrEqual(0)
    expect(timeline.indexOf('agg:1')).toBeLessThan(timeline.indexOf('confirm:start'))
    expect(timeline.indexOf('agg:2')).toBeLessThan(timeline.indexOf('confirm:start'))
  })

  it('(②-fix M2) the overdue alert EMISSION itself (not just its query) happens-before the window SELECT and every examination RPC', async () => {
    state.overdueTotal = '3'
    const summary = await reconcilePendingSettlements()
    expect(summary.overdue).toBe(3)
    const emit = timeline.indexOf('emit:reconcile.pending_overdue')
    expect(emit).toBeGreaterThanOrEqual(0)
    // a mutant that resolves the aggregate pre-loop but hoists the logger.error
    // line post-loop passes every resolution-order pin above — THIS goes red.
    expect(emit).toBeLessThan(timeline.indexOf('window'))
    expect(emit).toBeLessThan(timeline.indexOf('confirm'))
  })
})
