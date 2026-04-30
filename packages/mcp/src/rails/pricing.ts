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

// ─── Response-header helper (P3.K4 spec-diff F2) ────────────────────
//
// The P3.K4 card requires that the router "exposes both the rail's
// fee and SettleGrid's progressive take in the response headers."
// `resolveRailFee` handles the rail side; the SettleGrid platform
// take is caller-supplied (tracked per-LedgerEntry via
// takeBps/takeCents, not on the rate card itself).
//
// `buildPricingResponseHeaders` is the pure function the router
// calls with both numbers to produce a standard, grep-able header
// set. Downstream dashboards + SDK-consumer code read the same
// headers regardless of which rail served the invocation.

/**
 * Optional platform-take override. When omitted, the response
 * emits the rail side only — useful in environments where the
 * take is computed later (after the ledger row has settled).
 */
export interface PlatformTake {
  /** Platform markup in basis points (0-10000). */
  percentBps: number
  /** Platform flat fee in cents (default 0). */
  flatCents?: number
}

/**
 * Build the `X-SettleGrid-*` response header bundle the router
 * attaches to the invocation response. Keys stay lowercase so
 * fetch / Node's `Headers` surface consumers see canonical names
 * regardless of caller capitalization.
 *
 * Example output:
 *
 *   {
 *     'x-settlegrid-rail-fee-bps':    '290',
 *     'x-settlegrid-rail-fee-cents':  '30',
 *     'x-settlegrid-rail-fee-tier':   'base',
 *     'x-settlegrid-platform-take-bps':   '100',
 *     'x-settlegrid-platform-take-cents': '0',
 *   }
 */
export function buildPricingResponseHeaders(
  fee: ResolvedRailFee,
  platformTake?: PlatformTake,
): Record<string, string> {
  if (fee === null || typeof fee !== 'object') {
    throw new TypeError(
      'buildPricingResponseHeaders: `fee` must be a ResolvedRailFee object.',
    )
  }
  assertBps(fee.percentBps, 'fee.percentBps')
  assertFlatCents(fee.flatCents, 'fee.flatCents')
  // Hostile fix H26 — sourceTier ships verbatim in a response
  // header. An adversary who can mint a ResolvedRailFee (e.g., via
  // a future plugin API) could otherwise inject arbitrary bytes —
  // including CRLF — into the header value via a poisoned
  // sourceTier string. Close the union explicitly.
  if (fee.sourceTier !== 'base' && fee.sourceTier !== 'volume-tier') {
    throw new TypeError(
      `buildPricingResponseHeaders: \`fee.sourceTier\` must be 'base' or ` +
        `'volume-tier'; got ${JSON.stringify(fee.sourceTier)}.`,
    )
  }

  const headers: Record<string, string> = {
    'x-settlegrid-rail-fee-bps': String(fee.percentBps),
    'x-settlegrid-rail-fee-cents': String(fee.flatCents),
    'x-settlegrid-rail-fee-tier': fee.sourceTier,
  }

  if (platformTake !== undefined) {
    if (platformTake === null || typeof platformTake !== 'object') {
      throw new TypeError(
        'buildPricingResponseHeaders: `platformTake`, when provided, must be an object.',
      )
    }
    assertBps(platformTake.percentBps, 'platformTake.percentBps')
    const takeFlatCents = platformTake.flatCents ?? 0
    assertFlatCents(takeFlatCents, 'platformTake.flatCents')
    headers['x-settlegrid-platform-take-bps'] = String(platformTake.percentBps)
    headers['x-settlegrid-platform-take-cents'] = String(takeFlatCents)
  }

  return headers
}
