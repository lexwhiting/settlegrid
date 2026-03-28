/**
 * Progressive take rate calculator for SettleGrid.
 *
 * Replaces the flat revenueSharePct model. Take rates are marginal:
 * each revenue bracket is taxed at its own rate, not the entire amount.
 *
 * Brackets (in cents, monthly tool revenue):
 *   $0 - $1,000    → 0% take  (developer keeps 100%)
 *   $1,001 - $10,000 → 2% take (developer keeps 98%)
 *   $10,001 - $50,000 → 2.5% take (developer keeps 97.5%)
 *   $50,001+        → 5% take  (developer keeps 95%)
 */

export interface TakeRateBracket {
  /** Upper bound in cents (inclusive). Use Infinity for the last bracket. */
  upTo: number
  /** Take rate as a decimal (e.g. 0.02 = 2%) */
  rate: number
}

export const TAKE_RATE_BRACKETS: readonly TakeRateBracket[] = [
  { upTo: 100_000, rate: 0 },       // $0 - $1,000 → 0%
  { upTo: 1_000_000, rate: 0.02 },   // $1,001 - $10,000 → 2%
  { upTo: 5_000_000, rate: 0.025 },  // $10,001 - $50,000 → 2.5%
  { upTo: Infinity, rate: 0.05 },     // $50,001+ → 5%
] as const

/**
 * Calculate the total platform take in cents for a given monthly revenue.
 * Uses marginal brackets — each slice of revenue is taxed at its bracket rate.
 *
 * @param monthlyRevenueCents - Developer's total monthly tool revenue in cents
 * @returns Platform take amount in cents (floored to whole cents)
 */
export function calculateTakeCents(monthlyRevenueCents: number): number {
  if (!Number.isFinite(monthlyRevenueCents) || monthlyRevenueCents <= 0) return 0

  let takeCents = 0
  let remaining = monthlyRevenueCents
  let prevCeiling = 0

  for (const bracket of TAKE_RATE_BRACKETS) {
    if (remaining <= 0) break

    const bracketWidth = bracket.upTo === Infinity
      ? remaining
      : Math.min(remaining, bracket.upTo - prevCeiling)

    takeCents += bracketWidth * bracket.rate
    remaining -= bracketWidth
    prevCeiling = bracket.upTo
  }

  return Math.floor(takeCents)
}

/**
 * Calculate the effective (blended) take rate for a given monthly revenue.
 *
 * @param monthlyRevenueCents - Developer's total monthly tool revenue in cents
 * @returns Effective take rate as a decimal (e.g. 0.015 = 1.5%)
 */
export function calculateEffectiveRate(monthlyRevenueCents: number): number {
  if (!Number.isFinite(monthlyRevenueCents) || monthlyRevenueCents <= 0) return 0

  const takeCents = calculateTakeCents(monthlyRevenueCents)
  return takeCents / monthlyRevenueCents
}

/**
 * Calculate the developer's payout amount after progressive take rate.
 *
 * @param monthlyRevenueCents - Developer's total monthly tool revenue in cents
 * @returns Developer payout in cents
 */
export function calculateDeveloperPayoutCents(monthlyRevenueCents: number): number {
  if (!Number.isFinite(monthlyRevenueCents) || monthlyRevenueCents <= 0) return 0

  return monthlyRevenueCents - calculateTakeCents(monthlyRevenueCents)
}

/**
 * Returns a human-readable description of the progressive take rate model.
 */
export function getProgressiveTakeDescription(): string {
  return 'Progressive: 0% on first $1K, 2% on $1K-$10K, 2.5% on $10K-$50K, 5% above $50K'
}

/**
 * Returns a short label for UI display.
 */
export function getProgressiveTakeLabel(): string {
  return 'Progressive: 0% on first $1K/mo, scales to 5% at $50K+'
}
