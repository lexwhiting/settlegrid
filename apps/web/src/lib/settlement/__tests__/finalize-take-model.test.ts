/**
 * (C) revenueSharePct take-model reconciliation — finalizeSession funds test.
 *
 * Pins the SINGLE-take model for the sessions settlement path: finalizeSession's
 * deferred/atomic branch must credit the developer the FULL hop amount with ZERO
 * platform fee at settlement time. The progressive platform take happens exactly
 * once, later, at payout (calculateTakeCents, lib/pricing.ts) on the pooled
 * balanceCents — identical to the meter path.
 *
 * This is the behavior-change guard for chunk (C). It FAILS on pre-(C) code,
 * where the deferred branch took a flat session fee
 *   platformFeeCents = Math.ceil(entry.amountCents * ((100 - revShare) / 100))
 * (= 15% at the live DB default 85), credited the post-fee amount, and then let
 * payout take AGAIN on the pool → a structural DOUBLE-TAKE. Post-(C) the fee is 0
 * and the full amount is credited.
 *
 * Bespoke DB mock (NOT the shared multi-hop.test.ts harness, whose mock hardcodes
 * from()→'sessions' and cannot drive the tools IN(...) select). Mock routes by a
 * `__table` discriminator on the schema mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mutable fixtures (read inside the hoisted vi.mock factories) ─────────────

interface SeedHop {
  hopId: string
  serviceId: string
  toolId: string
  method: string
  costCents: number
  timestamp: string
  status: string
  latencyMs: number | null
  metadata: unknown
}

const SESSION_ID = 'sess-take-model-1'
let sessionFixture: Record<string, unknown> | null = null
let toolRowsFixture: Array<{ toolId: string; developerId: string }> = []
let capturedBatch: Record<string, unknown> | null = null

function resetFixtures() {
  sessionFixture = null
  toolRowsFixture = []
  capturedBatch = null
}

function hop(toolId: string, costCents: number, i: number): SeedHop {
  return {
    hopId: `hop-${toolId}-${i}`,
    serviceId: `svc-${toolId}`,
    toolId,
    method: 'invoke',
    costCents,
    timestamp: '2026-06-07T00:00:00.000Z',
    status: 'success',
    latencyMs: null,
    metadata: null,
  }
}

function seedDeferredSession(hops: SeedHop[]) {
  sessionFixture = {
    id: SESSION_ID,
    customerId: 'cust-1',
    parentSessionId: null,
    budgetCents: 1_000_000,
    spentCents: hops.reduce((s, h) => s + h.costCents, 0),
    reservedCents: 0,
    status: 'active',
    settlementMode: 'deferred',
    protocol: null,
    hops,
    atomicSettlementId: null,
    metadata: null,
    expiresAt: null,
    completedAt: null,
    finalizedAt: null,
    settledAt: null,
    createdAt: new Date('2026-06-07T00:00:00.000Z'),
    updatedAt: new Date('2026-06-07T00:00:00.000Z'),
  }
}

// ─── Mock @/lib/db — a table-routing query builder ───────────────────────────

vi.mock('@/lib/db', () => {
  function resolveFor(op: string, table: string | null): unknown {
    if (op === 'update' && table === 'workflowSessions') {
      // step 1 (active→finalizing, .returning) and step 5 (link batch, awaited).
      return [{ id: SESSION_ID }]
    }
    if (op === 'select' && table === 'workflowSessions') return sessionFixture ? [sessionFixture] : []
    if (op === 'select' && table === 'tools') return toolRowsFixture
    if (op === 'insert' && table === 'settlementBatches') return [{ id: 'batch-1' }]
    return []
  }

  function builder(op: string, initialTable: string | null) {
    const ctx: { op: string; table: string | null } = { op, table: initialTable }
    const b: Record<string, unknown> = {
      from(t: { __table?: string }) { ctx.table = t?.__table ?? null; return b },
      set() { return b },
      values(v: Record<string, unknown>) {
        if (ctx.op === 'insert' && ctx.table === 'settlementBatches') capturedBatch = v
        return b
      },
      innerJoin() { return b },
      where() { return b },
      limit() { return b },
      returning() { return Promise.resolve(resolveFor(ctx.op, ctx.table)) },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(resolveFor(ctx.op, ctx.table)).then(onF, onR)
      },
    }
    return b
  }

  return {
    db: {
      select: vi.fn(() => builder('select', null)),
      update: vi.fn((t: { __table?: string }) => builder('update', t?.__table ?? null)),
      insert: vi.fn((t: { __table?: string }) => builder('insert', t?.__table ?? null)),
    },
  }
})

// ─── Mock @/lib/db/schema — discriminated table stubs ────────────────────────

vi.mock('@/lib/db/schema', () => ({
  workflowSessions: {
    __table: 'workflowSessions',
    id: 'id', customerId: 'customer_id', status: 'status', settlementMode: 'settlement_mode',
    hops: 'hops', spentCents: 'spent_cents', atomicSettlementId: 'atomic_settlement_id',
    finalizedAt: 'finalized_at', settledAt: 'settled_at', updatedAt: 'updated_at',
  },
  tools: { __table: 'tools', id: 'id', developerId: 'developer_id' },
  developers: { __table: 'developers', id: 'id', balanceCents: 'balance_cents', updatedAt: 'updated_at' },
  settlementBatches: {
    __table: 'settlementBatches',
    id: 'id', sessionId: 'session_id', status: 'status', totalAmountCents: 'total_amount_cents',
    platformFeeCents: 'platform_fee_cents', disbursements: 'disbursements', createdAt: 'created_at',
  },
  organizations: { __table: 'organizations', id: 'id' },
}))

// ─── Mock the rest of sessions.ts's module-level imports ──────────────────────

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({ del: vi.fn(async () => 1) })),
  tryRedis: vi.fn(async (fn: () => Promise<unknown>) => { try { return await fn() } catch { return null } }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('./ledger', () => ({
  recordSettlementEntryAsync: vi.fn(),
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  lt: vi.fn((...args: unknown[]) => args),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values, __isSql: true })),
    { join: vi.fn((...args: unknown[]) => args) },
  ),
}))

async function getFinalizeSession() {
  const mod = await import('../sessions')
  return mod.finalizeSession
}

describe('(C) finalizeSession — single take model (full credit, zero fee at settlement)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetFixtures()
  })

  it('credits the FULL hop total with ZERO platform fee for one tool (take deferred to payout)', async () => {
    const finalizeSession = await getFinalizeSession()
    // Two success hops for one tool → 7000 + 3000 = 10000c.
    seedDeferredSession([hop('tool-a', 7000, 1), hop('tool-a', 3000, 2)])
    toolRowsFixture = [{ toolId: 'tool-a', developerId: 'dev-a' }]

    const result = await finalizeSession(SESSION_ID)

    expect(result.batchId).toBe('batch-1')
    expect(result.totalSettledCents).toBe(10000)

    expect(capturedBatch).not.toBeNull()
    // Batch-level fee is 0 — the take is taken once at payout, not here.
    expect(capturedBatch!.platformFeeCents).toBe(0)
    expect(capturedBatch!.totalAmountCents).toBe(10000)

    const disbursements = capturedBatch!.disbursements as Array<{
      developerId: string; toolId: string; amountCents: number; platformFeeCents: number
    }>
    expect(disbursements).toHaveLength(1)
    expect(disbursements[0].developerId).toBe('dev-a')
    expect(disbursements[0].toolId).toBe('tool-a')
    // FULL credit (pre-(C) this was 8500 after a flat 15% fee) and ZERO fee.
    expect(disbursements[0].amountCents).toBe(10000)
    expect(disbursements[0].platformFeeCents).toBe(0)
  })

  it('aggregates multi-tool hops at full credit / zero fee (no flat session take)', async () => {
    const finalizeSession = await getFinalizeSession()
    // tool-a: 6000, tool-b: 4000 → batch total 10000.
    seedDeferredSession([hop('tool-a', 6000, 1), hop('tool-b', 4000, 1)])
    toolRowsFixture = [
      { toolId: 'tool-a', developerId: 'dev-a' },
      { toolId: 'tool-b', developerId: 'dev-b' },
    ]

    await finalizeSession(SESSION_ID)

    expect(capturedBatch).not.toBeNull()
    expect(capturedBatch!.platformFeeCents).toBe(0)
    expect(capturedBatch!.totalAmountCents).toBe(10000)

    const disbursements = capturedBatch!.disbursements as Array<{
      toolId: string; amountCents: number; platformFeeCents: number
    }>
    expect(disbursements).toHaveLength(2)
    // Every disbursement credits its full amount with no fee.
    const byTool = Object.fromEntries(disbursements.map(d => [d.toolId, d]))
    expect(byTool['tool-a'].amountCents).toBe(6000)
    expect(byTool['tool-a'].platformFeeCents).toBe(0)
    expect(byTool['tool-b'].amountCents).toBe(4000)
    expect(byTool['tool-b'].platformFeeCents).toBe(0)
    // The whole batch takes nothing at settlement — every cent is credited.
    const totalCredited = disbursements.reduce((s, d) => s + d.amountCents, 0)
    const totalFee = disbursements.reduce((s, d) => s + d.platformFeeCents, 0)
    expect(totalCredited).toBe(10000)
    expect(totalFee).toBe(0)
  })
})
