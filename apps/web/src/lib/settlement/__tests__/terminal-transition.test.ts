/**
 * (T) — terminal-transition integrity + credit observability: EMPIRICAL pins.
 *
 * Closes the ③ deep-audit register's P1 + P2 (both HIGHs) + P3. Unlike
 * reconcile.test.ts (arg-shape assertions), this suite EXECUTES the SQL the
 * REAL ledger.ts + reconcile.ts emit against a stateful in-memory table
 * (the reconcile-starvation.test.ts interpreter pattern, extended):
 *   - update().set().where() applies the captured WHERE conjuncts as filters
 *     and MUTATES matching rows; `.returning()` reports the matched set (the
 *     markSettlement* contract — ledger.ts is NOT mocked here);
 *   - transaction(cb) snapshots state and rolls back on throw (the
 *     creditSettlement + marker atomicity pin);
 *   - aggregate selects terminating at .where() compute count(*) from the
 *     same interpreter (the sweep + overdue queries);
 *   - select().from().where().limit() WITHOUT orderBy resolves from state
 *     (the real findSettlementRow path).
 *
 * The two HIGH pins FAIL against the pre-(T) tree (captured in
 * .audit/t-build/{p2,p1}-prefix-fail.txt):
 *   P2 — a stale-hash failed-flip LANDS pre-fix (no external_ref CAS conjunct
 *        in markSettlementFailed's WHERE) and is REJECTED post-fix;
 *   P1 — a settled-but-uncredited row is INVISIBLE pre-fix (no credited_at
 *        marker, no sweep, no summary.uncredited) and ENUMERATED post-fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

interface Row {
  id: string
  operationId: string
  rail: string
  externalRef: string | null
  settlementStatus: string
  createdAt: Date
  settledAt: Date | null
  lastReconciledAt: Date | null
  creditedAt: Date | null
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

const {
  state, mockDb, drizzleMock, ledgerEntriesMock, developersMock, toolsMock,
  mockConfirm, mockLogger,
} = vi.hoisted(() => {
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
  interface Dev { id: string; balanceCents: number }
  interface Tool { id: string; totalRevenueCents: number }
  const state = {
    rows: [] as Row[],
    devs: [] as Dev[],
    tools: [] as Tool[],
    /** when set, the NEXT db.transaction call throws (the P1 kill simulation). */
    killNextTransaction: false,
  }
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
      case 'isNull':
        return field(row, node.col) === null
      case 'lt': {
        const v = field(row, node.col)
        if (v === null) return false
        return (v as Date | number) < (node.val as Date | number)
      }
      default:
        throw new Error(`terminal-transition interpreter: unhandled WHERE node '${node.kind}'`)
    }
  }
  const compare = (orderArgs: Node[]) => (a: Row, b: Row): number => {
    for (const o of orderArgs) {
      if (o.kind === 'asc') {
        // PG-faithful: plain ASC sorts NULLs LAST.
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
          const ak = (field(a, (o.vals ?? [])[0]) ?? field(a, (o.vals ?? [])[1])) as Date
          const bk = (field(b, (o.vals ?? [])[0]) ?? field(b, (o.vals ?? [])[1])) as Date
          if (ak < bk) return -1
          if (ak > bk) return 1
        } else {
          throw new Error(`terminal-transition interpreter: unhandled sql ORDER BY '${joined}'`)
        }
      } else {
        throw new Error(`terminal-transition interpreter: unhandled ORDER BY node '${o.kind}'`)
      }
    }
    return 0
  }
  const project = (fields: Record<string, unknown>, rows: Row[]) =>
    rows.map((r) => {
      const out: Record<string, unknown> = {}
      for (const [key, colToken] of Object.entries(fields)) out[key] = field(r, colToken)
      return out
    })
  /** Aggregate eval for selects that terminate at .where() (overdue + sweep). */
  const runAggregate = (fields: Record<string, unknown>, where: Node) => {
    const matched = state.rows.filter((r) => evalWhere(where, r))
    const out: Record<string, unknown> = {}
    for (const [key, f] of Object.entries(fields)) {
      const node = f as Node
      const joined = (node.strings ?? []).join('#')
      if (joined.includes('count(*) filter')) {
        out[key] = String(matched.filter((r) => field(r, (node.vals ?? [])[0]) === null).length)
      } else if (joined.includes('count(*)')) {
        // postgres-js returns count as a STRING (DC-18 — load-bearing).
        out[key] = String(matched.length)
      } else if (joined.includes('min(')) {
        const vals = matched.map((r) => field(r, (node.vals ?? [])[0]) as Date | null).filter((v) => v !== null) as Date[]
        out[key] = vals.length ? new Date(Math.min(...vals.map((d) => d.getTime()))) : null
      } else {
        throw new Error(`terminal-transition interpreter: unhandled aggregate '${joined}'`)
      }
    }
    return [out]
  }

  const select = (fields: Record<string, unknown>) => {
    let where: Node | null = null
    const run = (order: Node[] | null, limit: number) => {
      let rows = state.rows.filter((r) => evalWhere(where as Node, r))
      if (order) rows = [...rows].sort(compare(order))
      return project(fields, rows.slice(0, limit))
    }
    const afterWhere = {
      orderBy: (...order: Node[]) => ({
        limit: async (n: number) => run(order, n),
      }),
      // findSettlementRow: select().from().where().limit() — NO orderBy.
      limit: async (n: number) => run(null, n),
      // overdue + sweep aggregates terminate at .where() (thenable).
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        try {
          return Promise.resolve(runAggregate(fields, where as Node)).then(resolve, reject)
        } catch (e) {
          return Promise.reject(e).then(resolve, reject)
        }
      },
    }
    const chain = {
      from: () => chain,
      where: (w: Node) => {
        where = w
        return afterWhere
      },
    }
    return chain
  }

  /** Increment-aware SET application for dev/tool sql`col + n` updates. */
  const applyInc = (current: number, v: unknown): number => {
    const node = v as Node
    if (node && node.kind === 'sql') {
      const inc = (node.vals ?? []).find((x) => typeof x === 'number') as number | undefined
      return current + (inc ?? 0)
    }
    return typeof v === 'number' ? v : current
  }

  const update = (table: unknown) => ({
    set: (vals: Record<string, unknown>) => ({
      where: (cond: Node) => {
        let matched: Array<Record<string, unknown>> = []
        if (table === ledgerEntriesMock) {
          const rows = state.rows.filter((r) => evalWhere(cond, r))
          for (const r of rows) {
            for (const [k, v] of Object.entries(vals)) {
              if (k === 'updatedAt') continue
              ;(r as unknown as Record<string, unknown>)[k] = v
            }
          }
          matched = rows.map((r) => ({ id: r.id }))
        } else if (table === developersMock) {
          const devs = state.devs.filter((d) => (cond.kind === 'eq' ? d.id === cond.val : false))
          for (const d of devs) {
            if ('balanceCents' in vals) d.balanceCents = applyInc(d.balanceCents, vals.balanceCents)
          }
          matched = devs.map((d) => ({ id: d.id }))
        } else if (table === toolsMock) {
          const tools = state.tools.filter((t) => (cond.kind === 'eq' ? t.id === cond.val : false))
          for (const t of tools) {
            if ('totalRevenueCents' in vals) t.totalRevenueCents = applyInc(t.totalRevenueCents, vals.totalRevenueCents)
          }
          matched = tools.map((t) => ({ id: t.id }))
        } else {
          throw new Error('terminal-transition interpreter: update on unknown table')
        }
        return {
          // watermark update awaits .where() directly.
          then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve([]).then(resolve, reject),
          returning: async () => matched,
        }
      },
    }),
  })

  const snapshot = () => ({
    rows: state.rows.map((r) => ({ ...r })),
    devs: state.devs.map((d) => ({ ...d })),
    tools: state.tools.map((t) => ({ ...t })),
  })
  const restore = (s: ReturnType<typeof snapshot>) => {
    state.rows = s.rows
    state.devs = s.devs
    state.tools = s.tools
  }

  const mockDb = {
    select,
    update,
    transaction: async (cb: (tx: unknown) => Promise<void>) => {
      if (state.killNextTransaction) {
        state.killNextTransaction = false
        throw new Error('terminal-transition: simulated process kill before the credit txn')
      }
      const snap = snapshot()
      try {
        await cb({ update })
      } catch (err) {
        restore(snap)
        throw err
      }
    },
  }

  const drizzleMock = {
    and: (...args: Node[]) => ({ kind: 'and', args }),
    eq: (col: string, val: unknown) => ({ kind: 'eq', col, val }),
    inArray: (col: string, vals: unknown[]) => ({ kind: 'inArray', col, vals }),
    lt: (col: string, val: unknown) => ({ kind: 'lt', col, val }),
    asc: (col: string) => ({ kind: 'asc', col }),
    isNotNull: (col: string) => ({ kind: 'isNotNull', col }),
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
  const developersMock = { id: 'developers.id', balanceCents: 'developers.balanceCents', updatedAt: 'developers.updatedAt' }
  const toolsMock = { id: 'tools.id', totalRevenueCents: 'tools.totalRevenueCents', updatedAt: 'tools.updatedAt' }

  const mockConfirm = vi.fn()
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  return { state, mockDb, drizzleMock, ledgerEntriesMock, developersMock, toolsMock, mockConfirm, mockLogger }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  ledgerEntries: ledgerEntriesMock,
  developers: developersMock,
  tools: toolsMock,
}))
vi.mock('drizzle-orm', () => drizzleMock)
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))
vi.mock('../circle-nano/settle-engine', () => ({ confirmSettlementTx: mockConfirm }))
// ../ledger is REAL: the CAS pin executes the actual emitted UPDATE.
// ./rails and @/lib/env are REAL (pure; the testnet flag is cleared per-test).

import { markSettlementFailed } from '../ledger'
import { reconcileOneRow, reconcilePendingSettlements } from '../reconcile'

const FROM = `0x${'a'.repeat(40)}`
const NONCE = `0x${'1'.padStart(64, '0')}`
const MAINNET_OP = `circle-nano:eip155:8453:${FROM}:${NONCE}`
const X402_MAINNET_OP = `x402:eip155:8453:${FROM}:${NONCE}`
const SEPOLIA_OP = `circle-nano:eip155:84532:${FROM}:${NONCE}`
const HOUR = 3_600_000

const row = (over: Partial<Row>): Row => ({
  id: 'r1',
  operationId: MAINNET_OP,
  rail: 'circle-nano',
  externalRef: '0xH1',
  settlementStatus: 'pending',
  createdAt: new Date(Date.now() - HOUR),
  settledAt: null,
  lastReconciledAt: null,
  creditedAt: null,
  amountCents: null,
  accountId: null,
  metadata: null,
  ...over,
})

beforeEach(() => {
  state.rows = []
  state.devs = [{ id: 'dev-7', balanceCents: 0 }]
  state.tools = [{ id: 'tool-9', totalRevenueCents: 0 }]
  state.killNextTransaction = false
  mockConfirm.mockReset()
  mockLogger.info.mockReset()
  mockLogger.warn.mockReset()
  mockLogger.error.mockReset()
  delete process.env.SETTLEGRID_X402_ALLOW_TESTNET
})

describe('P2 — stale-hash CAS on markSettlementFailed (register HIGH #2)', () => {
  it('REJECTS a failed-flip whose hash is not the row\'s current external_ref (stale batch SELECT vs live re-point) — FAILS PRE-FIX', async () => {
    // The reconciler SELECTed ref=0xH1; the live path then resubmitted and
    // markSettlementBroadcast re-pointed the row to 0xH2, which will settle.
    state.rows = [row({ externalRef: '0xH2' })]
    const flipped = await markSettlementFailed(MAINNET_OP, 'circle-nano', '0xH1')
    expect(flipped).toBe(false)
    expect(state.rows[0].settlementStatus).toBe('pending') // the resubmitted tx can still win
    expect(state.rows[0].externalRef).toBe('0xH2')
  })

  it('reconcileOneRow classifies the CAS-reject as pending-stale-ref (row stays pending; truthful telemetry) — FAILS PRE-FIX', async () => {
    state.rows = [row({ externalRef: '0xH2' })]
    // The batch row object carries the STALE ref the run SELECTed.
    mockConfirm.mockResolvedValue({ kind: 'reverted', txHash: '0xH1', nonceConsumed: false })
    const outcome = await reconcileOneRow({
      operationId: MAINNET_OP, rail: 'circle-nano', externalRef: '0xH1',
    })
    expect(outcome).toBe('pending-stale-ref')
    expect(state.rows[0].settlementStatus).toBe('pending')
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'reconcile.failed_flip_stale_ref',
      expect.objectContaining({ operationId: MAINNET_OP, staleTxHash: '0xH1', currentRef: '0xH2' }),
    )
  })

  it('LB-2 zombie-inverse pin: a LEGITIMATE failed-flip (hash === current ref) still lands — passes pre- AND post-fix', async () => {
    state.rows = [row({ externalRef: '0xH1' })]
    const flipped = await markSettlementFailed(MAINNET_OP, 'circle-nano', '0xH1')
    expect(flipped).toBe(true)
    expect(state.rows[0].settlementStatus).toBe('failed')
    expect(state.rows[0].externalRef).toBe('0xH1')
  })

  it('full-run telemetry: a mid-examination re-point lands in the pending bucket and the summary identity holds', async () => {
    state.rows = [row({ externalRef: '0xH2' })]
    // Simulate "re-pointed AFTER this run's SELECT": the confirm step returns a
    // clean revert for the ref the run read, while a concurrent broadcast moves
    // the row's ref forward.
    mockConfirm.mockImplementation(async (_n: string, txHash: string) => {
      state.rows[0].externalRef = '0xH3'
      return { kind: 'reverted', txHash, nonceConsumed: false }
    })
    const summary = await reconcilePendingSettlements()
    expect(summary.scanned).toBe(1)
    expect(summary.outcomes['pending-stale-ref']).toBe(1)
    expect(summary.pending).toBe(1)
    expect(summary.failed).toBe(0)
    expect(summary.scanned).toBe(
      summary.settled + summary.failed + summary.pending + summary.skipped +
      summary.noop + summary.errored + summary.deferred,
    )
  })
})

describe('P1 — credited_at marker + uncredited-row sweep (register HIGH #1)', () => {
  it('ENUMERATES a settled-but-uncredited row past the grace window — FAILS PRE-FIX', async () => {
    state.rows = [row({
      settlementStatus: 'settled',
      settledAt: new Date(Date.now() - 2 * HOUR),
      externalRef: '0xH1',
      rail: 'x402',
      operationId: X402_MAINNET_OP,
    })]
    const summary = await reconcilePendingSettlements()
    expect(summary.uncredited).toBe(1)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'reconcile.uncredited_settled',
      expect.objectContaining({ uncreditedCount: 1, operationIds: [X402_MAINNET_OP] }),
    )
  })

  it('process-kill between flip and credit leaves a detectable settled-unmarked row (the silent-loss class, now visible)', async () => {
    state.rows = [row({ accountId: 'dev-7', amountCents: 50, metadata: { toolId: 'tool-9' } })]
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xH1' })
    state.killNextTransaction = true // the kill lands between the flip and the credit txn
    await reconcilePendingSettlements()
    expect(state.rows[0].settlementStatus).toBe('settled')
    expect(state.rows[0].creditedAt).toBeNull()
    expect(state.devs[0].balanceCents).toBe(0)
    // The next run's sweep enumerates the loss. Deterministic tick: the flip
    // happened "this ms" — settled_at < cutoff needs a strictly earlier tick
    // (same posture as the pin-block test below).
    state.rows[0].settledAt = new Date(Date.now() - 1000)
    const summary = await reconcilePendingSettlements({ creditGraceMs: 0 })
    expect(summary.uncredited).toBe(1)
  })

  it('marker commits in the SAME transaction as the credit; exactly-once across runs', async () => {
    state.rows = [row({ accountId: 'dev-7', amountCents: 50, metadata: { toolId: 'tool-9' } })]
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xH1' })
    const s1 = await reconcilePendingSettlements({ creditGraceMs: 0 })
    expect(s1.settled).toBe(1)
    expect(state.rows[0].settlementStatus).toBe('settled')
    expect(state.rows[0].creditedAt).not.toBeNull()
    expect(state.devs[0].balanceCents).toBe(50)
    expect(state.tools[0].totalRevenueCents).toBe(50)
    expect(s1.uncredited).toBe(0)
    // Second run: terminal row is outside the window — no re-credit, no page.
    const s2 = await reconcilePendingSettlements({ creditGraceMs: 0 })
    expect(s2.scanned).toBe(0)
    expect(state.devs[0].balanceCents).toBe(50)
    expect(s2.uncredited).toBe(0)
  })

  it('grace window: a freshly-settled unmarked row does NOT page (in-flight credit headroom)', async () => {
    state.rows = [row({
      settlementStatus: 'settled',
      settledAt: new Date(Date.now() - 5 * 60_000),
      rail: 'x402',
      operationId: X402_MAINNET_OP,
    })]
    const summary = await reconcilePendingSettlements()
    expect(summary.uncredited).toBe(0)
    expect(mockLogger.error).not.toHaveBeenCalledWith('reconcile.uncredited_settled', expect.anything())
  })
})

describe('P3 — reconciler credit-gate mainnet pin (latent, DC-13)', () => {
  it('a Sepolia row reaching the prod-shaped gate flips (honest bookkeeping) but is NEVER credited; loud log; row pages in the sweep', async () => {
    state.rows = [row({ operationId: SEPOLIA_OP, accountId: 'dev-7', amountCents: 50, metadata: { toolId: 'tool-9' } })]
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xH1' })
    const s = await reconcilePendingSettlements({ creditGraceMs: 0 })
    expect(s.settled).toBe(1) // the flip is NOT gated (DC-09: no immortal pending row)
    expect(state.rows[0].settlementStatus).toBe('settled')
    expect(state.devs[0].balanceCents).toBe(0) // the CREDIT is gated
    expect(state.rows[0].creditedAt).toBeNull()
    expect(mockLogger.error).toHaveBeenCalledWith(
      'reconcile.credit_blocked_testnet',
      expect.objectContaining({ operationId: SEPOLIA_OP, network: 'eip155:84532' }),
    )
    // The open incident pages on the NEXT run's sweep (the row settled mid-run;
    // settledAt < cutoff needs a strictly earlier tick — same posture as the
    // kill-simulation pin above).
    state.rows[0].settledAt = new Date(Date.now() - 1000)
    const s2 = await reconcilePendingSettlements({ creditGraceMs: 0 })
    expect(s2.uncredited).toBe(1) // open incident — deliberate
  })

  it('a mainnet row credits exactly as before (the (G) LB-2 over-broad-guard trap pin)', async () => {
    state.rows = [row({ accountId: 'dev-7', amountCents: 50, metadata: { toolId: 'tool-9' } })]
    mockConfirm.mockResolvedValue({ kind: 'settled', txHash: '0xH1' })
    await reconcilePendingSettlements({ creditGraceMs: 0 })
    expect(state.devs[0].balanceCents).toBe(50)
    expect(state.rows[0].creditedAt).not.toBeNull()
  })
})
