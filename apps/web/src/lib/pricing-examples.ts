/**
 * Worked take-rate examples shown on the public /pricing page.
 *
 * Every SettleGrid figure is derived from the brackets in lib/pricing.ts so
 * the displayed numbers cannot drift from what payouts actually charge.
 * Competitor figures are a 15% flat take (e.g. MCPize).
 */

import {
  TAKE_RATE_BRACKETS,
  calculateDeveloperPayoutCents,
  calculateTakeCents,
} from '@/lib/pricing'

/** Format cents as US dollars, e.g. 4_882_000 → "$48,820". */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatPct(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`
}

function keepExample(revenueCents: number): string {
  return `${formatUsd(revenueCents)} revenue → you keep ${formatUsd(calculateDeveloperPayoutCents(revenueCents))}`
}

/** How much more a developer keeps on SettleGrid than at a competitor. */
export function savingsVsCompetitorCents(revenueCents: number, competitorKeepCents: number): number {
  return calculateDeveloperPayoutCents(revenueCents) - competitorKeepCents
}

const BRACKET_LABELS = ['$0 – $1,000', '$1,001 – $10,000', '$10,001 – $50,000', '$50,001+'] as const
const BRACKET_EXAMPLE_REVENUE_CENTS = [100_000, 500_000, 2_500_000, 10_000_000] as const

export const takeRateBrackets = TAKE_RATE_BRACKETS.map((bracket, i) => ({
  bracket: BRACKET_LABELS[i],
  rate: formatPct(bracket.rate),
  youKeep: formatPct(1 - bracket.rate),
  example: keepExample(BRACKET_EXAMPLE_REVENUE_CENTS[i]),
}))

function revenueExample(
  revenueCents: number,
  mcpizeKeepCents: number,
  note: (savings: string) => string,
) {
  return {
    monthly: formatUsd(revenueCents),
    settlegrid: formatUsd(calculateDeveloperPayoutCents(revenueCents)),
    mcpize: formatUsd(mcpizeKeepCents),
    note: note(formatUsd(savingsVsCompetitorCents(revenueCents, mcpizeKeepCents))),
  }
}

export const revenueExamples = [
  revenueExample(50_000, 42_500, () => 'SettleGrid: 0% take. MCPize: 15% take.'),
  revenueExample(200_000, 170_000, () => '0% on first $1K + 2% on next $1K.'),
  revenueExample(1_000_000, 850_000, (s) => `Progressive brackets save you ${s}/mo.`),
  revenueExample(5_000_000, 4_250_000, (s) => `At scale, you keep ${s} more per month.`),
  revenueExample(10_000_000, 8_500_000, (s) => `You keep ${s} more per month vs 15% flat.`),
]

/** SettleGrid's take on $10,000/month (for the 15%-flat FAQ answer). */
export const takeOnTenThousand = formatUsd(calculateTakeCents(1_000_000))

/** Extra kept at $100K/month vs a 15% flat take (for the FAQ answer). */
export const savingsAtOneHundredThousand = formatUsd(
  savingsVsCompetitorCents(10_000_000, 8_500_000),
)
