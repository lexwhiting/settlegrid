/**
 * P3.K4 — Rail pricing resolver.
 *
 * Walks a {@link RailPricingRateCard} and picks the effective
 * `{ percentBps, flatCents }` for a given invocation context.
 * Adapters never resolve their own rate — they publish the card
 * via `RailAdapter.pricing` and the router calls this resolver
 * with the in-flight context (developer's monthly volume, the
 * invocation's currency) to compute the applicable fee.
 *
 * Output contract:
 *   - `percentBps` + `flatCents` always non-negative finite integers.
 *   - `sourceTier` names the tier that contributed the base rate
 *     (`'base'` when no volume tier qualified).
 *   - `currencySurcharge` is populated when a surcharge applied, so
 *     observability dashboards can show the breakdown.
 *
 * The resolver is PURE — no I/O, no clocks. All runtime-varying
 * inputs come from the `context` parameter, so tests can pass any
 * combination without mocking timers or databases.
 */

import type {
  RailPricingCurrencySurcharge,
  RailPricingRateCard,
  RailPricingVolumeTier,
} from './types'

export interface RailFeeContext {
  /**
   * Developer's rolling monthly settled volume in cents. `0` when
   * unknown — the resolver treats unknown as "new developer" and
   * stays on the base tier.
   */
  monthlyVolumeCents?: number
  /**
   * ISO-4217 currency of the invocation. Case-insensitive; the
   * resolver normalizes via `.toLowerCase()` before matching against
   * {@link RailPricingRateCard.currencySurcharges}.
   */
  currency?: string
}

export interface ResolvedRailFee {
  percentBps: number
  flatCents: number
  /** Name of the tier that produced the base rate, or `'base'`. */
  sourceTier: 'base' | 'volume-tier'
  /** The volume tier that applied, if any (useful for logs/headers). */
  appliedTier?: RailPricingVolumeTier
  /** The currency surcharge that applied, if any. */
  currencySurcharge?: RailPricingCurrencySurcharge
}

/**
 * Resolve the effective fee for the given context. Validates the
 * rate card up front — a rail with a malformed card throws at
 * resolve time rather than silently mis-billing. The throw is
 * typed as `TypeError` so callers can distinguish it from a
 * downstream rail-RPC failure.
 */
export function resolveRailFee(
  card: RailPricingRateCard,
  context: RailFeeContext = {},
): ResolvedRailFee {
  validateCard(card)

  let percentBps = card.basePercentBps
  let flatCents = card.baseFlatCents
  let sourceTier: ResolvedRailFee['sourceTier'] = 'base'
  let appliedTier: RailPricingVolumeTier | undefined

  const volume =
    typeof context.monthlyVolumeCents === 'number' &&
    Number.isFinite(context.monthlyVolumeCents) &&
    context.monthlyVolumeCents >= 0
      ? Math.floor(context.monthlyVolumeCents)
      : 0

  const tiers = card.volumeTiers ?? []
  // Pick the HIGHEST threshold that still qualifies. If the tiers are
  // declared out of order, this still returns the correct answer —
  // we do not trust adapter-side ordering.
  for (const tier of tiers) {
    validateTier(tier)
    if (volume >= tier.minMonthlyCents) {
      if (
        appliedTier === undefined ||
        tier.minMonthlyCents > appliedTier.minMonthlyCents
      ) {
        appliedTier = tier
      }
    }
  }
  if (appliedTier !== undefined) {
    percentBps = appliedTier.percentBps
    flatCents = appliedTier.flatCents
    sourceTier = 'volume-tier'
  }

  // Currency surcharge layering. Keyed by lowercased code so
  // 'USD' / 'usd' both match. Non-matching currencies are inert.
  let currencySurcharge: RailPricingCurrencySurcharge | undefined
  const currencyRaw = context.currency
  if (typeof currencyRaw === 'string' && currencyRaw.length > 0) {
    const key = currencyRaw.toLowerCase()
    const surcharges = card.currencySurcharges ?? {}
    for (const [rawKey, value] of Object.entries(surcharges)) {
      if (rawKey.toLowerCase() === key) {
        validateSurcharge(value)
        currencySurcharge = value
        percentBps += value.percentBps
        flatCents += value.flatCents ?? 0
        break
      }
    }
  }

  return {
    percentBps,
    flatCents,
    sourceTier,
    appliedTier,
    currencySurcharge,
  }
}

// ─── Internal validators ─────────────────────────────────────────────

const BPS_MAX = 10_000

function validateCard(card: unknown): asserts card is RailPricingRateCard {
  if (card === null || typeof card !== 'object') {
    throw new TypeError('resolveRailFee: `card` must be a non-null object.')
  }
  const c = card as RailPricingRateCard
  assertBps(c.basePercentBps, 'basePercentBps')
  assertFlatCents(c.baseFlatCents, 'baseFlatCents')
}

function validateTier(tier: unknown): asserts tier is RailPricingVolumeTier {
  if (tier === null || typeof tier !== 'object') {
    throw new TypeError(
      'resolveRailFee: each volumeTiers entry must be a non-null object.',
    )
  }
  const t = tier as RailPricingVolumeTier
  if (
    typeof t.minMonthlyCents !== 'number' ||
    !Number.isFinite(t.minMonthlyCents) ||
    !Number.isInteger(t.minMonthlyCents) ||
    t.minMonthlyCents < 0
  ) {
    throw new TypeError(
      `resolveRailFee: volume tier \`minMonthlyCents\` must be a non-negative integer; got ${JSON.stringify(
        t.minMonthlyCents,
      )}.`,
    )
  }
  assertBps(t.percentBps, 'volumeTiers[].percentBps')
  assertFlatCents(t.flatCents, 'volumeTiers[].flatCents')
}

function validateSurcharge(
  s: unknown,
): asserts s is RailPricingCurrencySurcharge {
  if (s === null || typeof s !== 'object') {
    throw new TypeError(
      'resolveRailFee: each currencySurcharges value must be a non-null object.',
    )
  }
  const v = s as RailPricingCurrencySurcharge
  assertBps(v.percentBps, 'currencySurcharges[].percentBps')
  if (v.flatCents !== undefined) {
    assertFlatCents(v.flatCents, 'currencySurcharges[].flatCents')
  }
}

function assertBps(value: unknown, field: string): void {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > BPS_MAX
  ) {
    throw new TypeError(
      `resolveRailFee: \`${field}\` must be an integer in [0, ${BPS_MAX}]; got ${JSON.stringify(
        value,
      )}.`,
    )
  }
}

function assertFlatCents(value: unknown, field: string): void {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new TypeError(
      `resolveRailFee: \`${field}\` must be a non-negative integer; got ${JSON.stringify(
        value,
      )}.`,
    )
  }
}
