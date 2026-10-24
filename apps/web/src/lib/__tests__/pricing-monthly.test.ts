/**
 * calculateMonthlyMarginalTakeCents applies the progressive brackets to a
 * developer's calendar-month earnings across any number of payouts.
 */
import { describe, it, expect } from 'vitest'
import { calculateMonthlyMarginalTakeCents, calculateTakeCents } from '../pricing'

/** Sum of per-payout takes when a month is paid out in the given parts. */
function takeOverSplit(parts: number[]): number {
  let mtd = 0
  let total = 0
  for (const part of parts) {
    total += calculateMonthlyMarginalTakeCents(part, mtd)
    mtd += part
  }
  return total
}

/** Deterministic pseudo-random generator so failures are reproducible. */
function lcg(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

describe('calculateMonthlyMarginalTakeCents', () => {
  it('equals calculateTakeCents for the first payout of the month', () => {
    for (const gross of [1, 99_999, 100_000, 100_001, 247_350, 1_000_000, 5_000_000, 7_654_321]) {
      expect(calculateMonthlyMarginalTakeCents(gross, 0)).toBe(calculateTakeCents(gross))
    }
  })

  it('charges 0% while month-to-date stays within the first $1,000', () => {
    expect(calculateMonthlyMarginalTakeCents(40_000, 50_000)).toBe(0)
    expect(calculateMonthlyMarginalTakeCents(50_000, 50_000)).toBe(0)
  })

  it('continues from month-to-date: $900 already paid + $300 → 2% on $200 = $4', () => {
    expect(calculateMonthlyMarginalTakeCents(30_000, 90_000)).toBe(400)
  })

  it('charges the bracket rate in full once month-to-date is past a boundary', () => {
    // $10,000 already paid; next $1,000 is entirely in the 2.5% bracket.
    expect(calculateMonthlyMarginalTakeCents(100_000, 1_000_000)).toBe(2_500)
    // $50,000 already paid; next $1,000 is entirely in the 5% bracket.
    expect(calculateMonthlyMarginalTakeCents(100_000, 5_000_000)).toBe(5_000)
  })

  it('splits a payout that crosses two bracket boundaries', () => {
    // $900 already paid; $10,000 payout covers $100 at 0%, $9,000 at 2%,
    // $900 at 2.5% → $0 + $180 + $22.50.
    expect(calculateMonthlyMarginalTakeCents(1_000_000, 90_000)).toBe(20_250)
  })

  it('returns 0 for a non-positive or non-finite payout', () => {
    expect(calculateMonthlyMarginalTakeCents(0, 500_000)).toBe(0)
    expect(calculateMonthlyMarginalTakeCents(-100, 500_000)).toBe(0)
    expect(calculateMonthlyMarginalTakeCents(Number.NaN, 500_000)).toBe(0)
    expect(calculateMonthlyMarginalTakeCents(Number.POSITIVE_INFINITY, 0)).toBe(0)
  })

  it('treats a negative or non-finite month-to-date as no prior payouts', () => {
    expect(calculateMonthlyMarginalTakeCents(200_000, -1)).toBe(calculateTakeCents(200_000))
    expect(calculateMonthlyMarginalTakeCents(200_000, Number.NaN)).toBe(calculateTakeCents(200_000))
  })

  it('sums to calculateTakeCents(month total) for fixed splits', () => {
    const splits: number[][] = [
      [100_000, 100_000],
      [99_999, 1, 1, 1],
      [90_000, 30_000],
      [50_000, 50_000, 50_000, 50_000, 50_000],
      [100_001, 899_999, 1, 4_000_000, 1, 2],
      [33_333, 33_333, 33_334, 1_234_567, 3_765_433, 999],
      Array.from({ length: 31 }, () => 8_065), // daily payouts of $80.65
      Array.from({ length: 30 }, () => 333_337), // daily payouts across all brackets
    ]
    for (const parts of splits) {
      const total = parts.reduce((a, b) => a + b, 0)
      expect(takeOverSplit(parts)).toBe(calculateTakeCents(total))
    }
  })

  it('sums to calculateTakeCents(month total) for random splits', () => {
    const rand = lcg(20261024)
    for (let trial = 0; trial < 500; trial++) {
      const count = 1 + Math.floor(rand() * 31)
      const parts = Array.from({ length: count }, () => 1 + Math.floor(rand() * 600_000))
      const total = parts.reduce((a, b) => a + b, 0)
      const take = takeOverSplit(parts)
      expect(take).toBe(calculateTakeCents(total))
      // Never more than the whole month taken at the top rate.
      expect(take).toBeLessThanOrEqual(Math.floor(total * 0.05))
    }
  })

  it('never charges a payout less than the same payout taken alone', () => {
    const rand = lcg(42)
    for (let trial = 0; trial < 2_000; trial++) {
      const gross = 1 + Math.floor(rand() * 2_000_000)
      const mtd = Math.floor(rand() * 8_000_000)
      const fee = calculateMonthlyMarginalTakeCents(gross, mtd)
      expect(Number.isInteger(fee)).toBe(true)
      expect(fee).toBeGreaterThanOrEqual(calculateTakeCents(gross))
      expect(fee).toBeLessThanOrEqual(gross)
    }
  })
})
