/**
 * (V-N2) — settled-value conversion + broadcast-seam divergence detection.
 *
 * SettleGrid credits a developer's balance for an on-chain settlement and pays it
 * out as unclawbackable fiat ≤24h later, so the credit MUST equal the USDC the
 * settling tx actually moved. The settled value is the BROADCASTING proof's
 * `authorization.value` (EIP-3009 `transferWithAuthorization` moves EXACTLY
 * `value`), recorded at broadcast (markSettlementBroadcast) keyed to the tx hash.
 * The reconciler tail then credits THAT recorded value rather than the frozen
 * first-write `amountCents` (which a same-(from,nonce) re-sign under a changed
 * tool price can outpace — the over/under-credit vector).
 *
 * This module owns the two pieces shared across the credit seam:
 *   - settledBaseUnitsToCents — the funds-safe base-units→cents conversion (BigInt
 *     FLOOR, overflow-guarded) the reconciler tail credits with (§13.E);
 *   - detectSettledValueDivergence — the broadcast-seam detector that fires when
 *     the value being collected diverges from the row's frozen amountCents (§13.F).
 *
 * Deliberately depends ONLY on the logger so it loads cleanly into both the
 * orchestrator (broadcast seam) and the reconciler (credit seam) test contexts.
 */
import { logger } from '@/lib/logger'

/** 1 US cent = 10,000 USDC base units (USDC has 6 decimals). */
const USDC_BASE_UNITS_PER_CENT = 10_000n

/**
 * The largest cents value the credit columns can hold: `amount_cents`,
 * `developers.balanceCents`, and `tools.totalRevenueCents` are all PostgreSQL
 * int4 (max 2,147,483,647). §13.E names "int4 max" as the reject bound. A floored
 * value above this cannot arise under universal exactAmount — tool prices are
 * themselves int4-bounded, so cost×10_000 can never exceed it — so this only
 * catches out-of-band metadata corruption; rejecting it here routes the caller to
 * the bounded frozen-amountCents fallback + alert, instead of letting a DB
 * `22003 integer out of range` roll the whole credit back into a manual incident.
 */
const MAX_CREDIT_CENTS = 2_147_483_647n

/**
 * The metadata JSONB key the broadcast writers persist the actually-collected
 * settled value under. Kept DISTINCT from the frozen `authorizedValueBaseUnits`
 * (that one is frozen at the first-write INSERT — re-reading it re-credits the
 * STALE value and every test still passes, the silent-fail trap §13.B warns of).
 * The ledger writers persist this key inline in their jsonb_build_object SQL —
 * keep that literal in sync with this constant.
 */
export const SETTLED_VALUE_BASE_UNITS_KEY = 'settledValueBaseUnits'

/**
 * Convert an integer USDC-base-units decimal string to whole CENTS, flooring.
 *   - BigInt FLOOR (`value / 10_000n`): a sub-cent remainder truncates DOWN — the
 *     only funds-safe direction (round/ceil would credit a sub-cent the platform
 *     never collected). Mirrors the seller-side floor precedent in
 *     packages/client/src/protocols/x402.ts.
 *   - Divide in BigInt BEFORE narrowing to Number: a base-units value > 2^53
 *     loses precision under a premature Number(); divide first, then narrow.
 *   - Overflow-guarded: a cents result beyond the int4 credit-column ceiling
 *     (MAX_CREDIT_CENTS) is corruption, not a credit — return null so the caller
 *     rejects + alerts rather than silently crediting garbage or 22003-rolling
 *     back the credit at the DB. (≤ int4 max ⟹ also < Number.MAX_SAFE_INTEGER, so
 *     the final Number() narrowing is always lossless.)
 * Returns null on a non-integer / negative / overflowing input.
 */
export function settledBaseUnitsToCents(baseUnits: string): number | null {
  let units: bigint
  try {
    units = BigInt(baseUnits)
  } catch {
    return null
  }
  if (units < 0n) return null
  const cents = units / USDC_BASE_UNITS_PER_CENT // BigInt floor
  if (cents > MAX_CREDIT_CENTS) return null
  return Number(cents)
}

/**
 * (V-N2 detect) — fire at the BROADCAST seam, where the broadcasting proof's
 * settled value (P2) and the row's frozen amountCents (P1) coexist. The
 * reconciler tail is structurally blind to this (it would only ever see
 * P1-vs-P1), so the detection must happen here. The settled value comes from the
 * PROOF, never a frozen row column.
 *
 * Predicate (§13.F):
 *   - floor(settledCents) < frozen amountCents → logger.error (the LOSS
 *     direction: the platform is about to collect LESS than the row was minted to
 *     credit — the money incident; logger.error is the Sentry-mirrored money
 *     convention).
 *   - floor(settledCents) > frozen amountCents → logger.warn (the RAISE
 *     direction: the symmetric UNDER-credit V-N2 also fixes, but NOT the loss
 *     incident — routed off the page to avoid alarm fatigue).
 *   - equal → silent (the happy path under universal exact-amount).
 *   - floor(settledCents) === 0 → silent: a free/sub-cent tool; the credit path's
 *     credit_skipped_no_data guard owns the no-data case (no double-page).
 * Best-effort: never throws — a detector must never perturb the money path.
 */
export function detectSettledValueDivergence(params: {
  operationId: string | null
  rail: string
  settledValueBaseUnits: string
  frozenAmountCents: number
}): void {
  const { operationId, rail, settledValueBaseUnits, frozenAmountCents } = params
  const settledCents = settledBaseUnitsToCents(settledValueBaseUnits)
  if (settledCents === null) {
    // The offline verifier already proved `value` is a valid BigInt before any
    // broadcast, so this is defensive — but a corrupt/unconvertible value AT
    // BROADCAST is a real anomaly worth surfacing.
    logger.error('settlement.settled_value_unconvertible', {
      operationId,
      rail,
      settledValueBaseUnits,
      frozenAmountCents,
    })
    return
  }
  if (settledCents === 0) return // defers to credit_skipped_no_data (no double-page)
  if (settledCents < frozenAmountCents) {
    logger.error('settlement.settled_value_below_frozen', {
      operationId,
      rail,
      settledCents,
      frozenAmountCents,
      lossCents: frozenAmountCents - settledCents,
      settledValueBaseUnits,
    })
  } else if (settledCents > frozenAmountCents) {
    logger.warn('settlement.settled_value_above_frozen', {
      operationId,
      rail,
      settledCents,
      frozenAmountCents,
      settledValueBaseUnits,
    })
  }
}
