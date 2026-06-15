/**
 * (V-N2) — settled-value conversion + broadcast-seam divergence detector.
 *
 * settledBaseUnitsToCents is the FUNDS-SAFE base-units→cents conversion the
 * reconciler tail credits with: BigInt FLOOR (never round/ceil up a sub-cent the
 * platform never collected), BigInt-before-Number, overflow-rejecting.
 * detectSettledValueDivergence fires at the broadcast seam: error ONLY on the
 * loss direction, warn on the raise direction, silent otherwise.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { settledBaseUnitsToCents, detectSettledValueDivergence, SETTLED_VALUE_BASE_UNITS_KEY } from '../settled-value'
import { logger } from '@/lib/logger'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('settledBaseUnitsToCents — BigInt FLOOR, overflow-guarded (§13.E)', () => {
  it('converts whole-cent base units exactly (500000 → 50)', () => {
    expect(settledBaseUnitsToCents('500000')).toBe(50)
  })

  it('FLOORS a sub-cent remainder DOWN, never up (305000 = 30.5c → 30; 309999 → 30)', () => {
    expect(settledBaseUnitsToCents('305000')).toBe(30)
    expect(settledBaseUnitsToCents('309999')).toBe(30)
  })

  it('a sub-cent total floors to 0 (9999 base units → 0)', () => {
    expect(settledBaseUnitsToCents('9999')).toBe(0)
    expect(settledBaseUnitsToCents('0')).toBe(0)
  })

  it('rejects a negative value → null (never credit a negative)', () => {
    expect(settledBaseUnitsToCents('-10000')).toBeNull()
  })

  it('rejects a non-integer / non-numeric string → null (BigInt throws)', () => {
    expect(settledBaseUnitsToCents('1.5')).toBeNull()
    expect(settledBaseUnitsToCents('abc')).toBeNull()
    expect(settledBaseUnitsToCents('1e6')).toBeNull()
  })

  it('accepts the exact int4-max-cents boundary, rejects one cent past it (the amount_cents/balanceCents column ceiling, §13.E)', () => {
    const maxCents = 2_147_483_647 // PostgreSQL int4 max — the credit-column ceiling
    expect(settledBaseUnitsToCents((BigInt(maxCents) * 10_000n).toString())).toBe(maxCents)
    expect(settledBaseUnitsToCents(((BigInt(maxCents) + 1n) * 10_000n).toString())).toBeNull()
  })

  it('rejects an absurdly large value → null (overflow, not a credit)', () => {
    expect(settledBaseUnitsToCents('1' + '0'.repeat(30))).toBeNull()
  })
})

describe('detectSettledValueDivergence — broadcast seam, loss-only error (§13.F)', () => {
  const P = (settledValueBaseUnits: string, frozenAmountCents: number) => ({
    operationId: 'x402:eip155:8453:0xpayer:0xnonce',
    rail: 'x402',
    settledValueBaseUnits,
    frozenAmountCents,
  })

  it('LOSS direction (settled 30c < frozen 50c) → logger.error with the loss delta', () => {
    detectSettledValueDivergence(P('300000', 50))
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.settled_value_below_frozen',
      expect.objectContaining({ settledCents: 30, frozenAmountCents: 50, lossCents: 20 }),
    )
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })

  it('RAISE direction (settled 70c > frozen 50c) → logger.warn, NOT error (off the page)', () => {
    detectSettledValueDivergence(P('700000', 50))
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'settlement.settled_value_above_frozen',
      expect.objectContaining({ settledCents: 70, frozenAmountCents: 50 }),
    )
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
  })

  it('EQUAL (settled == frozen, the happy path under exact-amount) → silent', () => {
    detectSettledValueDivergence(P('500000', 50))
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })

  it('settledCents === 0 → silent (defers to credit_skipped_no_data; no double-page)', () => {
    detectSettledValueDivergence(P('9999', 0))
    detectSettledValueDivergence(P('0', 5))
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled()
  })

  it('an unconvertible value at the seam → logger.error (defensive anomaly)', () => {
    detectSettledValueDivergence(P('not-a-number', 50))
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      'settlement.settled_value_unconvertible',
      expect.objectContaining({ frozenAmountCents: 50 }),
    )
  })
})

// (V-N2 §13.B) — write/read key-sync guard. The reconciler READS the recorded
// value via SETTLED_VALUE_BASE_UNITS_KEY; the ledger writers WRITE it as an inline
// SQL literal. If a rename of the constant ever misses those literals, the row is
// written-under-A / read-under-B: the reconciler never finds the value → silent
// legacy-fallback → the over-credit vector V-N2 closes returns unnoticed. This
// pins the two to the same string (mirrors credit-writer-census / verifier-exactamount-census).
describe('(V-N2) settled-value metadata key — write literal == read constant (no split-brain)', () => {
  it('ledger.ts persists the key under the SAME literal SETTLED_VALUE_BASE_UNITS_KEY holds, at both broadcast/settled writers', () => {
    const ledgerSrc = readFileSync(join(process.cwd(), 'src/lib/settlement/ledger.ts'), 'utf8')
    const writes = ledgerSrc.match(new RegExp(`jsonb_build_object\\('${SETTLED_VALUE_BASE_UNITS_KEY}'`, 'g')) ?? []
    expect(writes.length).toBe(2) // markSettlementBroadcast + markSettlementSettled
  })
})
