/**
 * P3.RAIL3 — Stripe-specific rails helpers (payout schedule + chargeback
 * velocity).
 *
 * # Two scopes
 *
 *   - **`updatePayoutSchedule(client, accountId, schedule, currentSchedule?)`**
 *     — wraps `Account.update({ settings: { payouts: { schedule: ... } } })`
 *     with idempotency. Per hostile (a), the helper compares the
 *     desired schedule against the caller-supplied current schedule
 *     and SKIPS the API call when they match — a double-submit
 *     re-render, a stale form re-post, and a retry after a network
 *     blip all collapse to a no-op.
 *
 *   - **`classifyChargebackVelocity({ chargesCount, chargebacksCount,
 *     chargesVolumeCents, chargebacksVolumeCents }, options?)`** —
 *     pure tier classifier (green / yellow / red) with the
 *     low-sample-size guard from hostile (b). A developer with 1
 *     chargeback out of 2 charges is not flagged; the helper requires
 *     a minimum count of charges before any non-green tier can fire.
 *
 * Everything here is dependency-injectable so tests can pass a plain
 * object satisfying the `StripePayoutClient` interface and exercise
 * the orchestration without the Stripe SDK.
 */

// ─── Stripe API surface (the minimum we need) ────────────────────────

export interface StripePayoutSchedule {
  /** Stripe's interval enum for Account.payouts.schedule. */
  interval: 'manual' | 'daily' | 'weekly' | 'monthly'
  /** Required when interval='weekly'. Stripe's enum: lowercase day name. */
  weekly_anchor?:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday'
  /** Required when interval='monthly'. 1–31; 31 falls back to last day of month. */
  monthly_anchor?: number
  /** Optional, but Stripe surfaces it. Read-only from our perspective. */
  delay_days?: number | 'minimum'
}

export interface StripePayoutClient {
  accounts: {
    /** Update the connected account's payout schedule. The helper
     *  passes `{ settings: { payouts: { schedule } } }` per Stripe's
     *  Account.update API. Returns the updated account so the caller
     *  can read back the persisted schedule. */
    update: (
      id: string,
      params: {
        settings: { payouts: { schedule: StripePayoutSchedule } }
      },
    ) => Promise<{
      id: string
      settings?: { payouts?: { schedule?: StripePayoutSchedule } } | null
    }>
    /** Used when the caller doesn't pass a `currentSchedule` — the
     *  helper retrieves it before deciding whether to update. */
    retrieve: (id: string) => Promise<{
      id: string
      settings?: { payouts?: { schedule?: StripePayoutSchedule } } | null
    }>
  }
}

// ─── Public types ────────────────────────────────────────────────────

/** Caller-facing schedule shape. Validated + normalized in the helper. */
export type DesiredPayoutSchedule =
  | { interval: 'manual' }
  | { interval: 'daily' }
  | {
      interval: 'weekly'
      weekday:
        | 'monday'
        | 'tuesday'
        | 'wednesday'
        | 'thursday'
        | 'friday'
        | 'saturday'
        | 'sunday'
    }
  | { interval: 'monthly'; monthDay: number }

export interface UpdatePayoutScheduleResult {
  /** True when the helper actually called Stripe; false on no-op. */
  updated: boolean
  /** The schedule now in effect at Stripe (post-update or pre-existing). */
  schedule: StripePayoutSchedule
  /** Why the helper made the choice it did. */
  reason: string
}

export class InvalidPayoutScheduleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPayoutScheduleError'
  }
}

// ─── Validation + normalization ──────────────────────────────────────

const VALID_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const
const VALID_INTERVALS = ['manual', 'daily', 'weekly', 'monthly'] as const

/**
 * Translate the caller-supplied {@link DesiredPayoutSchedule} to the
 * Stripe-native shape. Throws {@link InvalidPayoutScheduleError} when
 * the input is missing required anchors, has an out-of-range monthDay,
 * or carries fields that don't match the interval discriminant.
 *
 * Pure: no Stripe SDK reference; tests exercise it directly.
 */
export function normalizePayoutSchedule(
  desired: DesiredPayoutSchedule,
): StripePayoutSchedule {
  if (!desired || typeof desired !== 'object') {
    throw new InvalidPayoutScheduleError('schedule is required')
  }
  if (!VALID_INTERVALS.includes(desired.interval as (typeof VALID_INTERVALS)[number])) {
    throw new InvalidPayoutScheduleError(
      `interval must be one of ${VALID_INTERVALS.join(', ')}; got ${JSON.stringify(desired.interval)}`,
    )
  }
  if (desired.interval === 'manual' || desired.interval === 'daily') {
    return { interval: desired.interval }
  }
  if (desired.interval === 'weekly') {
    const weekday = (desired as { weekday?: string }).weekday
    if (typeof weekday !== 'string' || !VALID_WEEKDAYS.includes(weekday as (typeof VALID_WEEKDAYS)[number])) {
      throw new InvalidPayoutScheduleError(
        `weekly schedule requires \`weekday\` ∈ ${VALID_WEEKDAYS.join(', ')}; got ${JSON.stringify(weekday)}`,
      )
    }
    return {
      interval: 'weekly',
      weekly_anchor: weekday as StripePayoutSchedule['weekly_anchor'],
    }
  }
  // monthly
  const monthDay = (desired as { monthDay?: number }).monthDay
  if (
    typeof monthDay !== 'number' ||
    !Number.isInteger(monthDay) ||
    monthDay < 1 ||
    monthDay > 31
  ) {
    throw new InvalidPayoutScheduleError(
      `monthly schedule requires integer \`monthDay\` ∈ [1, 31]; got ${JSON.stringify(monthDay)}`,
    )
  }
  return { interval: 'monthly', monthly_anchor: monthDay }
}

/**
 * Compare two schedules by VALUE so a re-submit of the existing
 * configuration short-circuits the Stripe API call (idempotency).
 * Stripe surfaces a non-spec `delay_days` field; we ignore it because
 * the API response includes it but our caller never sets it.
 */
export function payoutSchedulesEqual(
  a: StripePayoutSchedule | null | undefined,
  b: StripePayoutSchedule | null | undefined,
): boolean {
  if (!a || !b) return false
  if (a.interval !== b.interval) return false
  if (a.interval === 'weekly') {
    return a.weekly_anchor === b.weekly_anchor
  }
  if (a.interval === 'monthly') {
    return a.monthly_anchor === b.monthly_anchor
  }
  // manual / daily — interval alone suffices
  return true
}

// ─── Idempotent payout-schedule update ───────────────────────────────

/**
 * Update the connected account's payout schedule, idempotently.
 *
 * Semantics:
 *   - If `currentSchedule` is supplied AND already matches the
 *     `desired` shape, no Stripe call is made; result is
 *     `{ updated: false, reason: 'already-current' }`.
 *   - If `currentSchedule` is omitted, the helper RETRIEVES the
 *     account first to read its current schedule. This consumes one
 *     extra Stripe call per invocation; callers that have a fresh
 *     copy in their DB cache should pass it.
 *   - The Stripe API itself is idempotent for same-value writes
 *     (no harm if the read-vs-desired check is bypassed); the
 *     pre-flight is purely an optimization + observability win.
 *
 * Hostile (a): a double-submit (page form posted twice in quick
 * succession with the same payload) collapses to one Stripe call
 * worst-case + zero in the cache-hit path.
 */
export async function updatePayoutSchedule(
  client: StripePayoutClient,
  accountId: string,
  desired: DesiredPayoutSchedule,
  currentSchedule?: StripePayoutSchedule | null,
): Promise<UpdatePayoutScheduleResult> {
  if (typeof accountId !== 'string' || accountId.length === 0) {
    throw new InvalidPayoutScheduleError(
      'accountId is required (Stripe connected-account id)',
    )
  }
  const target = normalizePayoutSchedule(desired)

  let observed: StripePayoutSchedule | null | undefined = currentSchedule
  if (observed === undefined) {
    const account = await client.accounts.retrieve(accountId)
    observed = account.settings?.payouts?.schedule ?? null
  }

  if (payoutSchedulesEqual(observed, target)) {
    return {
      updated: false,
      schedule: target,
      reason: 'already-current',
    }
  }

  const updated = await client.accounts.update(accountId, {
    settings: { payouts: { schedule: target } },
  })
  const persisted = updated.settings?.payouts?.schedule
  if (!persisted || !payoutSchedulesEqual(persisted, target)) {
    // Stripe should never persist a different shape than we sent, but
    // surface an explicit error rather than silently returning the
    // requested schedule when the response shows otherwise.
    throw new Error(
      `Stripe accepted the payout-schedule update for ${accountId} but the response schedule does not match the requested one`,
    )
  }
  return {
    updated: true,
    schedule: persisted,
    reason: 'applied',
  }
}

// ─── Chargeback velocity classifier ──────────────────────────────────

/** Tier constants — the spec's three-tier ladder. */
export const CHARGEBACK_GREEN_RATE = 0.003 // 0.3%
export const CHARGEBACK_YELLOW_RATE = 0.005 // 0.5%
export const CHARGEBACK_STRIPE_INTERVENTION_RATE = 0.01 // 1% — Stripe's own threshold

/**
 * Hostile (b): a developer with 1 chargeback out of 2 charges has a
 * 50% rate but the sample is statistically meaningless. Don't fire a
 * tier alert until the account has at least this many charges over
 * the rolling 30-day window. 10 is the bar the spec implicitly
 * sets — small enough that genuinely problematic accounts are caught
 * within a week or two, large enough that one early dispute on a
 * fresh account doesn't trip the wire.
 */
export const MIN_CHARGES_FOR_VELOCITY_ALERT = 10

export type ChargebackTier = 'green' | 'yellow' | 'red'

export interface VelocityInputs {
  /** Number of charges in the rolling 30-day window. */
  chargesCount: number
  /** Number of disputes/chargebacks opened against those charges. */
  chargebacksCount: number
  /** Total charge volume in cents (net of refunds is fine; gross is fine — pick one and stay consistent). */
  chargesVolumeCents: number
  /** Total chargeback volume in cents (sum of `dispute.amount`). */
  chargebacksVolumeCents: number
}

export interface VelocityClassification {
  readonly tier: ChargebackTier
  /** chargebacks / charges by COUNT (0–1). 0 when chargesCount is 0. */
  readonly rateByCount: number
  /** chargebacks / charges by VOLUME (0–1). 0 when chargesVolumeCents is 0. */
  readonly rateByVolume: number
  /** True when the sample-size guard suppressed an otherwise-eligible alert. */
  readonly suppressedByLowSampleSize: boolean
  /** Human-readable reason a non-green tier did or did not fire. */
  readonly reason: string
}

export interface ClassifyOptions {
  /** Override the count threshold for the low-sample-size guard. */
  minChargesForAlert?: number
  /** Override the green/yellow boundary. */
  yellowThreshold?: number
  /** Override the yellow/red boundary. */
  redThreshold?: number
}

/**
 * Classify a developer's chargeback velocity into green / yellow /
 * red. Pure: no I/O, no SDK references.
 *
 * The classifier uses the MAX of `rateByCount` and `rateByVolume`. A
 * developer who took $10,000 in 200 charges with one $9,000
 * chargeback has rateByCount = 0.5% but rateByVolume = 90% — the
 * volume signal is the load-bearing one in that case, so the
 * classifier picks the worse of the two.
 */
export function classifyChargebackVelocity(
  inputs: VelocityInputs,
  options: ClassifyOptions = {},
): VelocityClassification {
  if (
    !Number.isInteger(inputs.chargesCount) ||
    inputs.chargesCount < 0 ||
    !Number.isInteger(inputs.chargebacksCount) ||
    inputs.chargebacksCount < 0
  ) {
    throw new TypeError(
      `classifyChargebackVelocity: counts must be non-negative integers; got charges=${inputs.chargesCount}, chargebacks=${inputs.chargebacksCount}`,
    )
  }
  if (
    !Number.isInteger(inputs.chargesVolumeCents) ||
    inputs.chargesVolumeCents < 0 ||
    !Number.isInteger(inputs.chargebacksVolumeCents) ||
    inputs.chargebacksVolumeCents < 0
  ) {
    throw new TypeError(
      `classifyChargebackVelocity: volumes must be non-negative integer cents; got charges=${inputs.chargesVolumeCents}, chargebacks=${inputs.chargebacksVolumeCents}`,
    )
  }
  const minCharges = options.minChargesForAlert ?? MIN_CHARGES_FOR_VELOCITY_ALERT
  const yellow = options.yellowThreshold ?? CHARGEBACK_GREEN_RATE
  const red = options.redThreshold ?? CHARGEBACK_YELLOW_RATE
  if (
    !Number.isFinite(yellow) ||
    yellow < 0 ||
    !Number.isFinite(red) ||
    red < 0 ||
    red < yellow
  ) {
    throw new TypeError(
      `classifyChargebackVelocity: thresholds must satisfy 0 ≤ yellow ≤ red; got yellow=${yellow}, red=${red}`,
    )
  }

  const rateByCount =
    inputs.chargesCount === 0 ? 0 : inputs.chargebacksCount / inputs.chargesCount
  const rateByVolume =
    inputs.chargesVolumeCents === 0
      ? 0
      : inputs.chargebacksVolumeCents / inputs.chargesVolumeCents
  const worstRate = Math.max(rateByCount, rateByVolume)

  // Low-sample-size guard. A non-green tier requires the count
  // threshold AND the worst-rate threshold. Green can fire at any
  // sample size (including zero charges); the suppression only ever
  // demotes a candidate yellow/red back to green.
  const meetsSampleSize = inputs.chargesCount >= minCharges
  let candidateTier: ChargebackTier = 'green'
  if (worstRate > red) candidateTier = 'red'
  else if (worstRate > yellow) candidateTier = 'yellow'

  if (candidateTier !== 'green' && !meetsSampleSize) {
    return Object.freeze({
      tier: 'green',
      rateByCount,
      rateByVolume,
      suppressedByLowSampleSize: true,
      reason:
        `low sample size (${inputs.chargesCount} < ${minCharges} charges) — ` +
        `would otherwise be ${candidateTier} (worstRate=${worstRate.toFixed(4)})`,
    })
  }

  return Object.freeze({
    tier: candidateTier,
    rateByCount,
    rateByVolume,
    suppressedByLowSampleSize: false,
    reason:
      candidateTier === 'green'
        ? `worstRate=${worstRate.toFixed(4)} ≤ ${yellow}`
        : `worstRate=${worstRate.toFixed(4)} > ${candidateTier === 'yellow' ? yellow : red}`,
  })
}

// ─── Alert rate-limit helper (hostile (d)) ───────────────────────────

export const ALERT_WINDOW_HOURS_YELLOW = 24 * 7 // 7 days
export const ALERT_WINDOW_HOURS_RED = 24 // 24 hours

export interface ChargebackAlertHistoryRow {
  /** ISO-8601 timestamp the prior alert was emitted. */
  emittedAtIso: string
  /** Tier of the prior alert. */
  tier: ChargebackTier
}

export interface AlertRateLimitDecision {
  open: boolean
  reason: string
}

/**
 * Decide whether the velocity job should send an alert email NOW
 * given the developer's prior alerts. Pure helper — caller passes in
 * the relevant rows from `chargeback_alerts` for this developer +
 * tier and the function answers yes/no.
 *
 * Hostile (d): yellow alerts fire once per 7 days, red alerts once
 * per 24 hours. A persistently-bad account does not get a fresh
 * email every cron run.
 */
export function shouldSendChargebackAlert(
  tier: ChargebackTier,
  history: readonly ChargebackAlertHistoryRow[],
  options: { nowIso?: string; yellowWindowHours?: number; redWindowHours?: number } = {},
): AlertRateLimitDecision {
  if (tier === 'green') {
    return { open: false, reason: 'green tier — never alerts' }
  }
  const yellowWindow = options.yellowWindowHours ?? ALERT_WINDOW_HOURS_YELLOW
  const redWindow = options.redWindowHours ?? ALERT_WINDOW_HOURS_RED
  const nowIso = options.nowIso ?? new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  if (!Number.isFinite(nowMs)) {
    throw new TypeError(
      `shouldSendChargebackAlert: nowIso unparseable (${JSON.stringify(nowIso)})`,
    )
  }
  const window = tier === 'red' ? redWindow : yellowWindow
  if (!Number.isFinite(window) || window < 0) {
    throw new TypeError(
      `shouldSendChargebackAlert: window must be a non-negative finite number of hours; got ${window}`,
    )
  }
  // Find the most recent alert at THIS tier. A red alert does not
  // reset the yellow rate-limit and vice versa: each tier rate-limits
  // independently so a fresh red still fires even when yellow is
  // suppressed.
  let mostRecentMs: number | null = null
  for (const row of history) {
    if (row.tier !== tier) continue
    const ms = Date.parse(row.emittedAtIso)
    if (!Number.isFinite(ms)) continue
    if (mostRecentMs === null || ms > mostRecentMs) mostRecentMs = ms
  }
  if (mostRecentMs === null) {
    return { open: true, reason: `no prior ${tier} alert recorded` }
  }
  const elapsedHours = (nowMs - mostRecentMs) / (1000 * 60 * 60)
  if (elapsedHours < window) {
    return {
      open: false,
      reason:
        `rate-limited: last ${tier} alert ${elapsedHours.toFixed(2)}h ago ` +
        `(window=${window}h)`,
    }
  }
  return { open: true, reason: `${elapsedHours.toFixed(2)}h since last ${tier} alert` }
}
