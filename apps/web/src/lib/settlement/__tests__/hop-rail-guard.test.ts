/**
 * (H) rail-enum guard — recordHop must NOT write a unified-ledger settlement row
 * for an on-chain rail (x402 / circle-nano). A hop row's operation_id is a bare
 * random UUID (the hopId) that never parses as a settlement operation_id, so a hop
 * row carrying an on-chain rail + external_ref would be re-SELECTed by the
 * settlement reconciler every run forever (skipped-unparseable) and starve its
 * bounded batch. The guard excludes EXACTLY the reconciler's RECONCILABLE_RAILS
 * (shared constant ⟹ drift-proof, provable by construction). The hop is still
 * recorded for budget either way. See docs/tech-debt/h-f1-trace-2026-06-08.md §1b.
 *
 * FAILS PRE-FIX: the unguarded recordHop calls recordSettlementEntryAsync for ANY
 * rail (the if-branch only checks rail/protocol/accountId are non-empty strings).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockRecordSettlementEntryAsync, mockRedis, mockDb, mockLogger } = vi.hoisted(() => {
  const mockRedis = {
    incrby: vi.fn(async () => 100), // spent after increment = costCents
    get: vi.fn(async (key: string) => (key.includes('budget') ? 10000 : 0)), // budget=10000, reserved=0
    decrby: vi.fn(async () => 0),
  }
  const mockDb = {
    // expiry gate: db.select({...}).from().where().limit(1) → an active, non-expiring session
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ status: 'active', expiresAt: null }]),
        })),
      })),
    })),
    // JSONB-append + spentCents update: db.update().set().where()
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  }
  return {
    mockRecordSettlementEntryAsync: vi.fn(),
    mockRedis,
    mockDb,
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
})

vi.mock('@/lib/settlement/ledger', () => ({ recordSettlementEntryAsync: mockRecordSettlementEntryAsync }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
  tryRedis: async (fn: () => Promise<unknown>) => {
    try { return await fn() } catch { return null }
  },
}))
vi.mock('@/lib/logger', () => ({ logger: mockLogger }))
vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  workflowSessions: {
    id: 'id', status: 'status', expiresAt: 'expires_at', hops: 'hops',
    spentCents: 'spent_cents', updatedAt: 'updated_at',
  },
  // recordHop does not use these, but sessions.ts destructures them at import.
  settlementBatches: {}, tools: {}, developers: {}, organizations: {},
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...a: unknown[]) => ({ and: a })),
  lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
  sql: vi.fn((s: TemplateStringsArray, ...v: unknown[]) => ({ sql: s, v })),
}))

import { recordHop } from '../sessions'
import { RECONCILABLE_RAILS, isReconcilableRail } from '../rails'

const base = { serviceId: 'svc-1', toolId: 'tool-1', method: 'GET', costCents: 100, protocol: 'mpp', accountId: 'dev-1' }
const TX = '0x' + 'a'.repeat(64)

beforeEach(() => {
  vi.clearAllMocks()
})

// Order-independence: clean up any env/global stub a sibling left in the shared
// pool worker (the register's stripe-connect-mocking-sibling flake). unstub* is
// the exact cleanup that leak needs; vi.restoreAllMocks() is unnecessary here —
// this file installs no vi.spyOn spies, and its hoisted vi.fn(impl) mocks
// (mockRedis/mockDb) survive restore in vitest 2.1.9 (beforeEach's clearAllMocks
// already resets their call history).
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('recordHop rail-enum guard (H — closes the reconciler-starvation trap)', () => {
  it('SKIPS the unified-ledger settlement write for the on-chain rail x402 (+ structured warn)', async () => {
    await recordHop('sess-1', { ...base, rail: 'x402', externalRef: TX })
    expect(mockRecordSettlementEntryAsync).not.toHaveBeenCalled()
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'session.hop_settlement_skipped_onchain_rail',
      expect.objectContaining({ rail: 'x402', sessionId: 'sess-1' }),
    )
  })

  it('SKIPS the settlement write for the on-chain rail circle-nano', async () => {
    await recordHop('sess-1', { ...base, rail: 'circle-nano', externalRef: TX })
    expect(mockRecordSettlementEntryAsync).not.toHaveBeenCalled()
  })

  it('WRITES the settlement row for an OFF-chain rail (stripe-connect) — control, unaffected', async () => {
    await recordHop('sess-1', { ...base, rail: 'stripe-connect', externalRef: 'pi_abc' })
    expect(mockRecordSettlementEntryAsync).toHaveBeenCalledTimes(1)
    expect(mockRecordSettlementEntryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ rail: 'stripe-connect', status: 'pending', sessionId: 'sess-1' }),
    )
  })

  it('still records the hop (budget) regardless — the JSONB-append + spentCents update runs', async () => {
    const { hopId } = await recordHop('sess-1', { ...base, rail: 'x402', externalRef: TX })
    expect(typeof hopId).toBe('string')
    expect(mockDb.update).toHaveBeenCalledTimes(1) // the authoritative budget write still happened
  })

  it('the guard excludes EXACTLY the reconciler RECONCILABLE_RAILS (shared constant, drift-proof)', () => {
    for (const rail of RECONCILABLE_RAILS) expect(isReconcilableRail(rail)).toBe(true)
    expect(isReconcilableRail('stripe-connect')).toBe(false)
    expect(isReconcilableRail('internal')).toBe(false)
    expect([...RECONCILABLE_RAILS].sort()).toEqual(['circle-nano', 'x402'])
  })
})
