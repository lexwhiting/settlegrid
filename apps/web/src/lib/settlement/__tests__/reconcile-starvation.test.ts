/**
 * (S) — LB-1 starvation regression. The bounded reconciler window (limit 25,
 * 15-min cron) must be a fair ROTATION over pending rows: deferral, never
 * exclusion. Rare never-terminal rows (dropped-tx → 'unconfirmed' forever;
 * reverted+nonce-consumed) must NOT occupy the window permanently and starve
 * newer confirmable rows of their real-money credit.
 *
 * Unlike reconcile.test.ts (arg-shape assertions), this suite EXECUTES the
 * query the code emits against a stateful in-memory table: the mocked drizzle
 * operators return inspectable nodes, and a small interpreter applies the
 * captured WHERE conjuncts as filters, the captured ORDER BY list as a sort
 * (including the raw sql`COALESCE(last_reconciled_at, created_at) ASC` FIFO
 * rotation key — queue position = last examined, else created; chosen by the
 * seal review over NULLS FIRST, whose absolute new-row priority let sustained
 * inflow >= limit/run defer a watermarked row indefinitely), and the per-row
 * watermark UPDATE (set({lastReconciledAt}).where(eq(id, <row id>)), emitted
 * once per loop iteration — mark-BEFORE-examine) as a mutation of the same
 * table. The interpreter mirrors POSTGRES semantics exactly where it matters:
 * a plain asc() over a nullable column sorts NULLs LAST (PG default) — so a
 * future "cleanup" to asc(lastReconciledAt) fails these rotation tests the
 * way it would starve in prod, instead of passing on JS null-coercion (seal
 * finding S2). To be precise about HOW it fails: the interpreter THROWS only
 * on an UNRECOGNIZED sql / ORDER BY / WHERE node; a recognized-but-
 * semantically-wrong node (e.g. a plain asc(lastReconciledAt)) does NOT throw
 * — it sorts PG-faithfully and the rotation ASSERTIONS go red. Either path
 * catches a wrong ordering or a missing watermark write HERE, not in prod.
 *
 * Both tests FAIL against the pre-(S) reconciler (bare createdAt ASC, no
 * watermark): the empirical red run is captured in
 * .audit/s-build/starvation-test-prefix-fail.txt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Row {
  id: string
  operationId: string
  rail: string
  externalRef: string | null
  settlementStatus: string
  createdAt: Date
  lastReconciledAt: Date | null
  amountCents: number | null
  accountId: string | null
  metadata: unknown
}

interface Node {
  kind: string
  col?: string
  val?: unknown
  vals?: unknown[]
  args?: Node[]
  strings?: readonly string[]
}

const { state, mockDb, drizzleMock, ledgerEntriesMock, mockConfirm, mockSettled, mockFailed } =
  vi.hoisted(() => {
    // column token (as the schema mock exposes it) → in-memory row key
    const COL: Record<string, string> = {
      id: 'id',
      operation_id: 'operationId',
      rail: 'rail',
      external_ref: 'externalRef',
      settlement_status: 'settlementStatus',
      created_at: 'createdAt',
      settled_at: 'settledAt',
      last_reconciled_at: 'lastReconciledAt',
      credited_at: 'creditedAt',
      amount_cents: 'amountCents',
      account_id: 'accountId',
      metadata: 'metadata',
    }
    const state = { rows: [] as Row[] }
    const field = (row: Row, colToken: unknown): unknown =>
      (row as unknown as Record<string, unknown>)[COL[colToken as string]]

    const evalWhere = (node: Node, row: Row): boolean => {
      switch (node.kind) {
        case 'and':
          return (node.args ?? []).every((a) => evalWhere(a, row))
        case 'eq':
          return field(row, node.col) === node.val
        case 'inArray':
          return (node.vals ?? []).includes(field(row, node.col))
        case 'isNotNull':
          return field(row, node.col) !== null
        case 'lt': {
          const v = field(row, node.col)
          return (v as Date | number) < (node.val as Date | number)
        }
        default:
          throw new Error(`starvation-test interpreter: unhandled WHERE node '${node.kind}'`)
      }
    }
    const compare = (orderArgs: Node[]) => (a: Row, b: Row): number => {
      for (const o of orderArgs) {
        if (o.kind === 'asc') {
          // PG-faithful: plain ASC sorts NULLs LAST (seal finding S2 — JS
          // null-coercion would sort them FIRST and green-light a starving
          // asc(lastReconciledAt) refactor).
          const av = field(a, o.col) as Date | null
          const bv = field(b, o.col) as Date | null
          if ((av === null) !== (bv === null)) return av === null ? 1 : -1
          if (av !== null && bv !== null) {
            if (av < bv) return -1
            if (av > bv) return 1
          }
        } else if (o.kind === 'sql') {
          const joined = (o.strings ?? []).join('#')
          if (joined.includes('COALESCE(') && joined.includes(') ASC')) {
            // COALESCE(colA, colB) ASC — non-null by construction here.
            const ak = (field(a, (o.vals ?? [])[0]) ?? field(a, (o.vals ?? [])[1])) as Date
            const bk = (field(b, (o.vals ?? [])[0]) ?? field(b, (o.vals ?? [])[1])) as Date
            if (ak < bk) return -1
            if (ak > bk) return 1
          } else if (joined.includes('ASC NULLS FIRST')) {
            const colToken = (o.vals ?? [])[0]
            const av = field(a, colToken) as Date | null
            const bv = field(b, colToken) as Date | null
            if ((av === null) !== (bv === null)) return av === null ? -1 : 1
            if (av !== null && bv !== null) {
              if (av < bv) return -1
              if (av > bv) return 1
            }
          } else {
            throw new Error(`starvation-test interpreter: unhandled sql ORDER BY '${joined}'`)
          }
        } else {
          throw new Error(`starvation-test interpreter: unhandled ORDER BY node '${o.kind}'`)
        }
      }
      return 0
    }
    const runSelect = (fields: Record<string, unknown>, where: Node, order: Node[], limit: number) => {
      const selected = state.rows
        .filter((r) => evalWhere(where, r))
        .sort(compare(order))
        .slice(0, limit)
      return selected.map((r) => {
        const out: Record<string, unknown> = {}
        for (const [key, colToken] of Object.entries(fields)) out[key] = field(r, colToken)
        return out
      })
    }

    const mockDb = {
      select: (fields: Record<string, unknown>) => {
        let where: Node | null = null
        const afterWhere = {
          orderBy: (...order: Node[]) => ({
            limit: async (n: number) => runSelect(fields, where as Node, order, n),
          }),
          // The overdue aggregate terminates at .where() — resolve it inertly
          // (postgres-js returns aggregate counts as STRINGS). Residual: a
          // NON-numeric count(*) would make summary.overdue Number(garbage)=NaN
          // → JSON-null, masquerading as "check failed" — accepted disposition
          // (sealed s-reconciler-starvation-resolution-2026-06-10.md, "Theoretical
          // NaN-overdue"): a real count(*) can't yield garbage, so it stays silent.
          then: (
            resolve: (v: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) => Promise.resolve([{ total: '0', noTxhash: '0', oldestCreatedAt: null }]).then(resolve, reject),
        }
        const chain = {
          from: () => chain,
          where: (w: Node) => {
            where = w
            return afterWhere
          },
        }
        return chain
      },
      update: () => ({
        set: (vals: Record<string, unknown>) => ({
          where: async (cond: Node) => {
            for (const r of state.rows) {
              if (evalWhere(cond, r)) Object.assign(r, vals)
            }
            return []
          },
        }),
      }),
      // The frozen credit spine must never run in these scenarios (rows carry
      // no accountId/amountCents, so creditSettlement exits at its guard).
      transaction: vi.fn(async () => {
        throw new Error('starvation test: db.transaction must not be reached')
      }),
    }

    const drizzleMock = {
      and: (...args: Node[]) => ({ kind: 'and', args }),
      eq: (col: string, val: unknown) => ({ kind: 'eq', col, val }),
      inArray: (col: string, vals: unknown[]) => ({ kind: 'inArray', col, vals }),
      lt: (col: string, val: unknown) => ({ kind: 'lt', col, val }),
      asc: (col: string) => ({ kind: 'asc', col }),
      isNotNull: (col: string) => ({ kind: 'isNotNull', col }),
      // (T) — the uncredited sweep's NULL-marker conjunct. Without this key the
      // sweep would die on an undefined operator and go SILENTLY dark
      // (uncredited:null swallowed by its best-effort catch) in this suite.
      isNull: (col: string) => ({ kind: 'isNull', col }),
      sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ kind: 'sql', strings, vals }),
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

    // Sticky rows (externalRef '0xs…') never confirm; confirmable rows ('0xc…') settle.
    const mockConfirm = vi.fn(async (_network: string, txHash: string) =>
      txHash.startsWith('0xs') ? { kind: 'unconfirmed', txHash } : { kind: 'settled', txHash },
    )
    const mockSettled = vi.fn(async (operationId: string, rail: string) => {
      const r = state.rows.find(
        (x) => x.operationId === operationId && x.rail === rail && x.settlementStatus === 'pending',
      )
      if (!r) return false
      r.settlementStatus = 'settled'
      return true
    })
    const mockFailed = vi.fn(async () => false)

    return { state, mockDb, drizzleMock, ledgerEntriesMock, mockConfirm, mockSettled, mockFailed }
  })

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  ledgerEntries: ledgerEntriesMock,
  developers: { id: 'developers.id', balanceCents: 'developers.balanceCents' },
  tools: { id: 'tools.id', totalRevenueCents: 'tools.totalRevenueCents' },
}))
vi.mock('drizzle-orm', () => drizzleMock)
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../circle-nano/settle-engine', () => ({ confirmSettlementTx: mockConfirm }))
vi.mock('../ledger', () => ({
  markSettlementSettled: mockSettled,
  markSettlementFailed: mockFailed,
  // (T) — reconcile.ts newly imports the CAS-reject re-read (DC-05: every new
  // symbol needs its factory key even when these scenarios never reach it).
  findSettlementRow: vi.fn(async () => null),
}))

import { reconcilePendingSettlements } from '../reconcile'

const FROM = `0x${'a'.repeat(40)}`
const opid = (i: number) => `circle-nano:eip155:8453:${FROM}:0x${i.toString(16).padStart(64, '0')}`
// All rows are comfortably older than the 5-min cutoff. Sticky rows are the
// OLDEST (the head of the pre-fix window); confirmable rows are the newest.
const BASE_T = Date.now() - 3_600_000
const row = (i: number, sticky: boolean): Row => ({
  id: `${sticky ? 's' : 'c'}${i}`,
  operationId: opid(sticky ? i : 1000 + i),
  rail: 'circle-nano',
  externalRef: sticky ? `0xs${i}` : `0xc${i}`,
  settlementStatus: 'pending',
  createdAt: new Date(sticky ? BASE_T + i * 1000 : BASE_T + 600_000 + i * 1000),
  lastReconciledAt: null,
  amountCents: null,
  accountId: null,
  metadata: null,
})

/** Run one reconciler pass; returns the examined rows' externalRefs IN ORDER. */
async function runOnce(): Promise<string[]> {
  const before = mockConfirm.mock.calls.length
  await reconcilePendingSettlements()
  return mockConfirm.mock.calls.slice(before).map((c) => c[1] as string)
}

beforeEach(() => {
  vi.clearAllMocks() // clears calls; vi.fn(impl) implementations survive
  state.rows = []
})

describe('reconciler window rotation — deferral, never exclusion (LB-1)', () => {
  it('every row left unexamined by run 1 enters run 2 window AHEAD of every re-examined row (FAILS pre-fix: same oldest-25 occupy the window every run)', async () => {
    state.rows = Array.from({ length: 30 }, (_, i) => row(i, true))

    const run1 = await runOnce()
    expect(run1).toHaveLength(25)

    // Implementation-independent: the 5 rows run 1 did NOT examine…
    const unexamined = state.rows
      .map((r) => r.externalRef as string)
      .filter((ref) => !run1.includes(ref))
    expect(unexamined).toHaveLength(5)

    const run2 = await runOnce()
    // (i) …must ALL be examined by run 2 (rotation guarantee). The window
    // REFILLS with re-examined rows behind them (limit 25 > 5) — that is
    // correct spare capacity, NOT a violation.
    for (const ref of unexamined) expect(run2).toContain(ref)
    // (ii) …and must come FIRST: every never-examined row outranks every
    // re-examined row (COALESCE queue: a created_at position always predates
    // any watermark set in this run).
    expect([...run2.slice(0, unexamined.length)].sort()).toEqual([...unexamined].sort())
  })

  it('a confirmable row behind 30 sticky rows is reached and settled within 2 runs (FAILS pre-fix: sticky head starves it forever)', async () => {
    state.rows = [
      ...Array.from({ length: 30 }, (_, i) => row(i, true)),
      ...Array.from({ length: 5 }, (_, i) => row(i, false)),
    ]

    await runOnce()
    await runOnce()

    const confirmable = state.rows.filter((r) => (r.externalRef as string).startsWith('0xc'))
    expect(confirmable).toHaveLength(5)
    // Reach-within-K: every confirmable row's USDC credit path was reached
    // (mockSettled flipped it) within K=2 runs.
    expect(confirmable.map((r) => r.settlementStatus)).toEqual(Array(5).fill('settled'))
    // And the frozen credit spine was never bypassed into a raw transaction
    // (rows carry no credit data; creditSettlement exits at its guard).
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('a watermarked pending row is NOT preempted by sustained new-row inflow — bounded deferral (FAILS under NULLS-FIRST ordering: new arrivals would starve it for the duration of the flood)', async () => {
    // Seal findings S1/S3: queue position must be COALESCE(watermark, created)
    // so rows arriving AFTER the victim's examination sort BEHIND it. Fake
    // timers model the real 15-min cron cadence: the victim is examined in
    // run 1, then 25 fresh stuck-pending rows arrive before EVERY later run.
    vi.useFakeTimers()
    try {
      const T0 = new Date('2026-06-10T12:00:00Z').getTime()
      vi.setSystemTime(T0)
      state.rows = [
        { ...row(0, true), id: 'victim', externalRef: '0xsvictim', createdAt: new Date(T0 - 3_600_000) },
      ]
      const run1 = await runOnce()
      expect(run1).toEqual(['0xsvictim']) // examined + watermarked at T0

      let seq = 0
      const inject = (now: number) => {
        for (let i = 0; i < 25; i++) {
          state.rows.push({
            ...row(0, true),
            id: `flood-${seq}`,
            externalRef: `0xsflood${seq++}`,
            // created AFTER the victim's watermark, old enough for the 5-min cutoff
            createdAt: new Date(now - 6 * 60_000),
          })
        }
      }
      let victimReexaminedAtRun = -1
      for (let r = 2; r <= 4 && victimReexaminedAtRun === -1; r++) {
        vi.setSystemTime(T0 + (r - 1) * 15 * 60_000) // next cron tick
        inject(Date.now())
        const examined = await runOnce()
        if (examined.includes('0xsvictim')) victimReexaminedAtRun = r
      }
      // Bounded deferral: the victim (queue position T0) outranks every flood
      // row (created > T0) and is re-examined on the very next run.
      expect(victimReexaminedAtRun).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("(T) the uncredited sweep is LIVE in this harness — summary.uncredited is a NUMBER, never null (a missing mock capability would silently dark-en it via the best-effort catch)", async () => {
    state.rows = [row(1, false)]
    const summary = await reconcilePendingSettlements()
    expect(typeof summary.uncredited).toBe('number')
    expect(summary.uncredited).toBe(0)
  })
})
