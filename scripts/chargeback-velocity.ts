#!/usr/bin/env tsx
/**
 * P3.RAIL3 — Chargeback velocity monitoring (daily).
 *
 * Runs daily via `.github/workflows/chargeback-velocity.yml` (08:30
 * UTC, just after the reconciliation cron) and:
 *
 *   1. Loads every developer with an active Stripe Connect ID.
 *   2. For each, queries Stripe over the rolling 30-day window:
 *      - charges count + volume
 *      - disputes (chargebacks) count + volume
 *   3. Calls `classifyChargebackVelocity()` from @settlegrid/rails to
 *      tier the developer green / yellow / red, with the low-sample-
 *      size guard (hostile (b)).
 *   4. Looks up the developer's recent yellow/red alert history and
 *      runs `shouldSendChargebackAlert()` to decide whether to email
 *      THIS run (yellow once / 7d, red once / 24h — hostile (d)).
 *   5. Inserts a row into `chargeback_alerts` whenever a developer is
 *      in yellow/red, regardless of the email decision; the
 *      email_status field records what the email branch did.
 *   6. Flips `developers.onboarding_paused = true` for new red-tier
 *      classifications.
 *
 * Hostile contracts:
 *   - (b) low-sample-size guard: classifier requires
 *     ≥ MIN_CHARGES_FOR_VELOCITY_ALERT (10) charges over the window
 *     before any non-green tier can fire. A developer with 1
 *     chargeback out of 2 charges stays green.
 *   - (c) auto-pause is reversible via the founder admin UI
 *     (POST /api/admin/chargeback-watch/unpause).
 *   - (d) emails are rate-limited per (developer, tier) pair using
 *     the chargeback_alerts table itself as the idempotency log.
 *
 * NOTE: This file is import-safe — it does not run anything at module
 * load. Tests under `scripts/__tests__/chargeback-velocity.test.ts`
 * import + mock the exported helpers.
 */

import {
  ALERT_WINDOW_HOURS_YELLOW,
  classifyChargebackVelocity,
  shouldSendChargebackAlert,
  type ChargebackTier,
  type ChargebackAlertHistoryRow,
  type VelocityClassification,
  type VelocityInputs,
} from '@settlegrid/rails'

// ─── Stripe API surface (the minimum we need) ────────────────────────

interface StripeCharge {
  id: string
  amount: number
  status: string // 'succeeded' | 'failed' | ...
  created: number
  paid: boolean
  refunded: boolean
}

interface StripeDispute {
  id: string
  amount: number
  charge: string | { id: string }
  created: number
  status: string
}

export interface StripeChargebackClient {
  charges: {
    list: (params: {
      limit?: number
      starting_after?: string
      created?: { gte?: number; lt?: number }
      transfer_data?: { destination: string }
    }) => Promise<{ data: StripeCharge[]; has_more: boolean }>
  }
  disputes: {
    list: (params: {
      limit?: number
      starting_after?: string
      created?: { gte?: number; lt?: number }
    }) => Promise<{ data: StripeDispute[]; has_more: boolean }>
  }
}

// ─── CLI args ────────────────────────────────────────────────────────

export interface CliArgs {
  /** When set: skip DB writes and email sends; print the plan only. */
  dryRun: boolean
  /** Override the default 30-day window. */
  windowDays: number
  /** Override the default 10-charge sample-size minimum. */
  minCharges: number
  /** Run for a single developer id only (for backfills / debugging). */
  developerId: string | null
  /** Print help and exit (handled in `main`, not `parseArgs`). */
  help: boolean
}

const DEFAULT_WINDOW_DAYS = 30
/** Default minimum charges before a non-green tier can fire. */
const DEFAULT_MIN_CHARGES = 10

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    windowDays: DEFAULT_WINDOW_DAYS,
    minCharges: DEFAULT_MIN_CHARGES,
    developerId: null,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--window-days') {
      const v = argv[++i]
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 365) {
        throw new Error(
          `--window-days requires an integer in [1, 365]; got ${v}`,
        )
      }
      args.windowDays = n
    } else if (arg === '--min-charges') {
      const v = argv[++i]
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0) {
        throw new Error(`--min-charges requires a non-negative integer; got ${v}`)
      }
      args.minCharges = n
    } else if (arg === '--developer-id') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) {
        throw new Error('--developer-id requires a UUID value')
      }
      // H8 hostile fix — `^[0-9a-f-]{36}$` accepts e.g. 36 dashes.
      // Tighten to require the canonical 8-4-4-4-12 layout.
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
      ) {
        throw new Error(`--developer-id must be a UUID; got ${v}`)
      }
      args.developerId = v
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return args
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage: npx tsx scripts/chargeback-velocity.ts [flags]',
      '',
      'Flags:',
      '  --dry-run                 Skip DB / Stripe / email side effects',
      '  --window-days N           Rolling window length (default 30)',
      '  --min-charges N           Sample-size minimum (default 10)',
      '  --developer-id <uuid>     Run for a single developer only',
      '  -h, --help                Show this help',
    ].join('\n'),
  )
}

// ─── Stripe data fetching ────────────────────────────────────────────

const PAGE_SIZE = 100
const MAX_PAGES = 200

/**
 * Fetch all charges for a connected account in the time window.
 * Stripe scopes via `transfer_data: { destination: acctId }` because
 * platform-mode API queries require the destination filter.
 *
 * Pagination is bounded — same MAX_PAGES guard as stripe-reconcile.
 */
export async function fetchChargesFor(
  client: StripeChargebackClient,
  destinationAccount: string,
  startSec: number,
  endSec: number,
): Promise<readonly StripeCharge[]> {
  return paginate<StripeCharge>(
    (params) =>
      client.charges.list({
        ...params,
        transfer_data: { destination: destinationAccount },
      }),
    { created: { gte: startSec, lt: endSec } },
  )
}

/**
 * Fetch all disputes in the window. Disputes don't carry destination
 * directly — we filter caller-side by joining `dispute.charge` against
 * the per-account charge ids.
 */
export async function fetchDisputesIn(
  client: StripeChargebackClient,
  startSec: number,
  endSec: number,
): Promise<readonly StripeDispute[]> {
  return paginate<StripeDispute>(
    (params) => client.disputes.list(params),
    { created: { gte: startSec, lt: endSec } },
  )
}

interface ListParams {
  limit?: number
  starting_after?: string
  created?: { gte?: number; lt?: number }
}

async function paginate<T extends { id: string }>(
  list: (params: ListParams) => Promise<{ data: T[]; has_more: boolean }>,
  baseParams: ListParams,
): Promise<readonly T[]> {
  const out: T[] = []
  const seen = new Set<string>()
  let starting_after: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await list({
      ...baseParams,
      limit: PAGE_SIZE,
      ...(starting_after !== undefined ? { starting_after } : {}),
    })
    if (!res || !Array.isArray(res.data) || typeof res.has_more !== 'boolean') {
      throw new Error('Stripe pagination returned malformed response')
    }
    for (const item of res.data) {
      if (typeof item.id !== 'string' || item.id.length === 0) {
        throw new Error('Stripe pagination: response item missing string `id`')
      }
      if (seen.has(item.id)) {
        throw new Error(
          `Stripe pagination: duplicate id ${item.id} — cursor not advancing`,
        )
      }
      seen.add(item.id)
      out.push(item)
    }
    if (!res.has_more) return Object.freeze(out)
    if (res.data.length === 0) {
      throw new Error(
        'Stripe pagination: has_more=true with empty data (cursor stalled)',
      )
    }
    starting_after = res.data[res.data.length - 1].id
  }
  throw new Error(
    `Stripe pagination exceeded ${MAX_PAGES} pages — refusing to continue`,
  )
}

// ─── Per-developer evaluation ────────────────────────────────────────

export interface DeveloperContext {
  id: string
  email: string
  name: string | null
  stripeConnectId: string
  alreadyPaused: boolean
}

export interface EvalResult {
  developerId: string
  classification: VelocityClassification
  inputs: VelocityInputs
  alertSent: 'sent' | 'rate_limited' | 'skipped' | 'failed'
  alertSendReason: string
  paused: boolean
  pauseAlreadyInPlace: boolean
}

export interface EvaluateOptions {
  windowSec: { startSec: number; endSec: number }
  minCharges: number
  history: readonly ChargebackAlertHistoryRow[]
  nowIso: string
  /** Optional override of the email sender for tests. Falls back to a no-op. */
  sendEmail?: (
    tier: 'yellow' | 'red',
    dev: DeveloperContext,
    inputs: VelocityInputs,
  ) => Promise<{ sent: boolean }>
}

/**
 * Evaluate one developer against Stripe's data for the rolling window
 * and decide whether to email + pause. Pure-ish — Stripe is injected,
 * email is injected, and the rails-package classifier is pure. The
 * caller persists the result + flips `developers.onboarding_paused`.
 */
export async function evaluateDeveloper(
  client: StripeChargebackClient,
  dev: DeveloperContext,
  options: EvaluateOptions,
): Promise<EvalResult> {
  const charges = await fetchChargesFor(
    client,
    dev.stripeConnectId,
    options.windowSec.startSec,
    options.windowSec.endSec,
  )

  const disputes = await fetchDisputesIn(
    client,
    options.windowSec.startSec,
    options.windowSec.endSec,
  )

  // Stripe's per-account dispute filter is post-hoc: we list disputes
  // in the window then keep only those whose `charge` id appears in
  // THIS developer's charges. (Stripe doesn't expose a
  // `transfer_data.destination` filter on /v1/disputes.)
  //
  // Hostile-review boundary (H9): this under-counts disputes filed
  // in the window against charges from > windowDays ago. Stripe
  // disputes can land up to ~120 days post-charge. A wider charge
  // fetch would close the gap but costs significantly more API
  // calls per cron run. Acceptable given:
  //   (1) the metric applies symmetrically (both num + denom use
  //       the same window so the rate stays a meaningful 30-day
  //       velocity);
  //   (2) the per-tier thresholds (0.3% / 0.5%) are well below
  //       Stripe's own 1% intervention threshold, so even an
  //       under-count tolerates some signal loss before we'd miss
  //       a genuinely-bad account.
  const chargeIds = new Set<string>()
  for (const c of charges) chargeIds.add(c.id)

  let chargesCount = 0
  let chargesVolumeCents = 0
  for (const c of charges) {
    if (c.status === 'succeeded' && c.paid && !c.refunded) {
      chargesCount++
      chargesVolumeCents += c.amount
    }
  }

  let chargebacksCount = 0
  let chargebacksVolumeCents = 0
  for (const d of disputes) {
    const chargeId = typeof d.charge === 'string' ? d.charge : d.charge?.id
    if (!chargeId) continue
    if (!chargeIds.has(chargeId)) continue
    chargebacksCount++
    chargebacksVolumeCents += d.amount
  }

  const inputs: VelocityInputs = {
    chargesCount,
    chargebacksCount,
    chargesVolumeCents,
    chargebacksVolumeCents,
  }

  const classification = classifyChargebackVelocity(inputs, {
    minChargesForAlert: options.minCharges,
  })

  let alertSent: EvalResult['alertSent'] = 'skipped'
  let alertSendReason = classification.reason

  // Hostile (d) — rate-limit at the per-tier level.
  const tier = classification.tier
  if (tier !== 'green') {
    const decision = shouldSendChargebackAlert(tier, options.history, {
      nowIso: options.nowIso,
    })
    if (!decision.open) {
      alertSent = 'rate_limited'
      alertSendReason = decision.reason
    } else if (options.sendEmail) {
      try {
        const r = await options.sendEmail(tier, dev, inputs)
        alertSent = r.sent ? 'sent' : 'failed'
        alertSendReason = r.sent ? `email sent (${tier})` : 'email send returned false'
      } catch (err) {
        alertSent = 'failed'
        alertSendReason = err instanceof Error ? err.message : 'email send threw'
      }
    } else {
      alertSent = 'skipped'
      alertSendReason = 'no email sender configured (dry-run or test)'
    }
  }

  const shouldPause = tier === 'red'
  return {
    developerId: dev.id,
    classification,
    inputs,
    alertSent,
    alertSendReason,
    paused: shouldPause,
    pauseAlreadyInPlace: dev.alreadyPaused,
  }
}

// ─── Orchestration entry-points (DB + email injected) ────────────────

export type LoadDevelopersFn = (developerId: string | null) => Promise<readonly DeveloperContext[]>
export type LoadAlertHistoryFn = (
  developerId: string,
  windowHours: number,
) => Promise<readonly ChargebackAlertHistoryRow[]>
export type PersistAlertFn = (params: {
  developerId: string
  tier: ChargebackTier
  classification: VelocityClassification
  inputs: VelocityInputs
  emailStatus: EvalResult['alertSent']
  pauseApplied: boolean
}) => Promise<void>
export type FlipPauseFn = (
  developerId: string,
  reason: string,
) => Promise<void>
export type SendAlertEmailFn = NonNullable<EvaluateOptions['sendEmail']>

export interface RunDeps {
  loadDevelopers?: LoadDevelopersFn
  loadAlertHistory?: LoadAlertHistoryFn
  persistAlert?: PersistAlertFn
  flipPause?: FlipPauseFn
  sendEmail?: SendAlertEmailFn
  stripeClient?: () => StripeChargebackClient | Promise<StripeChargebackClient>
  nowIso?: string
  log?: (msg: string) => void
}

export interface RunResult {
  evaluated: number
  yellow: number
  red: number
  paused: number
  errors: number
  details: ReadonlyArray<EvalResult & { error?: string }>
}

export async function runChargebackVelocity(
  args: CliArgs,
  deps: RunDeps = {},
): Promise<RunResult> {
  const log = deps.log ?? ((m: string) => console.log(m))
  const nowIso = deps.nowIso ?? new Date().toISOString()
  const nowMs = Date.parse(nowIso)
  if (!Number.isFinite(nowMs)) {
    throw new Error(`runChargebackVelocity: nowIso unparseable: ${nowIso}`)
  }
  const endSec = Math.floor(nowMs / 1000)
  const startSec = endSec - args.windowDays * 24 * 60 * 60

  if (!deps.loadDevelopers && !args.dryRun) {
    throw new Error(
      'runChargebackVelocity: loadDevelopers must be provided for non-dry-run mode',
    )
  }

  const loadDevs = deps.loadDevelopers ?? (async () => [])
  const developers = await loadDevs(args.developerId)
  log(`evaluating ${developers.length} developer(s) over the last ${args.windowDays}d UTC`)

  if (args.dryRun) {
    log('[dry-run] no Stripe / DB / email side effects')
    return {
      evaluated: 0,
      yellow: 0,
      red: 0,
      paused: 0,
      errors: 0,
      details: [],
    }
  }

  const stripe = deps.stripeClient
    ? await deps.stripeClient()
    : await defaultStripeClient()

  const details: (EvalResult & { error?: string })[] = []
  let yellow = 0
  let red = 0
  let paused = 0
  let errors = 0

  for (const dev of developers) {
    try {
      const history = deps.loadAlertHistory
        ? await deps.loadAlertHistory(dev.id, 24 * 7)
        : []
      const result = await evaluateDeveloper(stripe, dev, {
        windowSec: { startSec, endSec },
        minCharges: args.minCharges,
        history,
        nowIso,
        sendEmail: deps.sendEmail,
      })
      const tier = result.classification.tier
      if (tier === 'yellow') yellow++
      if (tier === 'red') red++

      if (tier !== 'green' && deps.persistAlert) {
        await deps.persistAlert({
          developerId: dev.id,
          tier,
          classification: result.classification,
          inputs: result.inputs,
          emailStatus: result.alertSent,
          pauseApplied: tier === 'red' && !dev.alreadyPaused,
        })
      }

      if (tier === 'red' && !dev.alreadyPaused && deps.flipPause) {
        await deps.flipPause(
          dev.id,
          `chargeback velocity at red tier (rateByCount=${result.classification.rateByCount.toFixed(4)}, rateByVolume=${result.classification.rateByVolume.toFixed(4)})`,
        )
        paused++
      }

      details.push(result)
      log(
        `dev=${dev.id} tier=${tier} ` +
          `charges=${result.inputs.chargesCount} chargebacks=${result.inputs.chargebacksCount} ` +
          `email=${result.alertSent}`,
      )
    } catch (err) {
      errors++
      const message = err instanceof Error ? err.message : String(err)
      log(`dev=${dev.id} ERROR ${message}`)
      details.push({
        developerId: dev.id,
        classification: {
          tier: 'green',
          rateByCount: 0,
          rateByVolume: 0,
          suppressedByLowSampleSize: false,
          reason: 'error during evaluation',
        },
        inputs: {
          chargesCount: 0,
          chargebacksCount: 0,
          chargesVolumeCents: 0,
          chargebacksVolumeCents: 0,
        },
        alertSent: 'failed',
        alertSendReason: message,
        paused: false,
        pauseAlreadyInPlace: dev.alreadyPaused,
        error: message,
      })
    }
  }

  log(
    `summary: evaluated=${developers.length} yellow=${yellow} red=${red} ` +
      `paused=${paused} errors=${errors}`,
  )
  return {
    evaluated: developers.length,
    yellow,
    red,
    paused,
    errors,
    details,
  }
}

// ─── Default Stripe client (lazy SDK init) ───────────────────────────

async function defaultStripeClient(): Promise<StripeChargebackClient> {
  // Prefer a restricted key with rak_charge_read + rak_dispute_read.
  const secret =
    process.env.STRIPE_RECONCILE_KEY ?? process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error(
      'STRIPE_RECONCILE_KEY (or STRIPE_SECRET_KEY) is required (or pass --dry-run)',
    )
  }
  const StripeMod = (await import('stripe')) as typeof import('stripe')
  const Stripe = StripeMod.default
  const stripe = new Stripe(
    secret,
    { apiVersion: '2025-02-24.acacia' } as ConstructorParameters<typeof Stripe>[1],
  )
  return {
    charges: stripe.charges as unknown as StripeChargebackClient['charges'],
    disputes: stripe.disputes as unknown as StripeChargebackClient['disputes'],
  }
}

// ─── Default DB / Resend wiring (used by main, overridable in tests) ─

/**
 * Founder address that gets cc'd on red-tier alerts. Spec: "Red (>
 * 0.5%): log a critical entry, **email founder + developer**, pause
 * new onboarding..." We cc rather than send a separate founder-only
 * email so the founder sees the same content the developer sees and
 * can act on the same Stripe-disputes link.
 */
const FOUNDER_EMAIL_FALLBACK = 'lexwhiting365@gmail.com'

export interface PostgresLikeClient {
  // The narrow surface we need from postgres-js. The full SDK satisfies
  // this naturally — declared here so the script doesn't statically
  // depend on the postgres-js types at module-load time.
  <T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>
  end: (opts?: { timeout?: number }) => Promise<void>
}

async function openPostgres(): Promise<PostgresLikeClient> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL is required (or pass --dry-run)')
  const postgresMod = await import('postgres')
  const postgres =
    (postgresMod as unknown as { default: typeof import('postgres') }).default ??
    postgresMod
  return postgres(dbUrl, {
    max: 2,
    ssl: { rejectUnauthorized: false },
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 10,
  }) as unknown as PostgresLikeClient
}

/**
 * Default loader: every developer with a non-null Stripe Connect ID,
 * not soft-deleted. When `developerId` is non-null, restrict to that
 * one (used by the workflow_dispatch single-developer ad-hoc path).
 */
export function makeDefaultLoadDevelopers(sql: PostgresLikeClient): LoadDevelopersFn {
  // H3 hostile fix — `developers` table has no `deleted_at` column.
  // The schema doesn't soft-delete; cascading FK deletes handle
  // tear-down. Filter only on `stripe_connect_id IS NOT NULL` so we
  // skip developers who haven't completed onboarding (and therefore
  // have no Connect account to evaluate).
  return async (developerId: string | null) => {
    type Row = {
      id: string
      email: string
      name: string | null
      stripe_connect_id: string
      onboarding_paused: boolean | null
    }
    const rows = developerId
      ? await sql<readonly Row[]>`
          SELECT id::text AS id, email, name, stripe_connect_id, onboarding_paused
          FROM developers
          WHERE stripe_connect_id IS NOT NULL
            AND id = ${developerId}::uuid
        `
      : await sql<readonly Row[]>`
          SELECT id::text AS id, email, name, stripe_connect_id, onboarding_paused
          FROM developers
          WHERE stripe_connect_id IS NOT NULL
        `
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      stripeConnectId: r.stripe_connect_id,
      alreadyPaused: Boolean(r.onboarding_paused),
    }))
  }
}

/**
 * Default alert-history loader: returns prior alerts for this
 * developer within the rolling rate-limit window so
 * `shouldSendChargebackAlert` has the data to make a decision.
 */
export function makeDefaultLoadAlertHistory(sql: PostgresLikeClient): LoadAlertHistoryFn {
  // H2 + H4 hostile fixes:
  //   - schema has `created_at` not `emitted_at`
  //   - rate-limit must only count SUCCESSFUL sends. A `rate_limited`
  //     or `failed` row recorded today would otherwise extend the
  //     rate-limit window indefinitely (a permanently-broken Resend
  //     key would silently freeze all future sends).
  //   - LIMIT 500 caps an unbounded read in the pathological case of
  //     a developer with thousands of alerts in 7 days.
  return async (developerId, windowHours) => {
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
    type Row = { tier: string; created_at: string | Date }
    const rows = await sql<readonly Row[]>`
      SELECT tier, created_at
      FROM chargeback_alerts
      WHERE developer_id = ${developerId}::uuid
        AND created_at >= ${cutoff}
        AND email_status = 'sent'
      ORDER BY created_at DESC
      LIMIT 500
    `
    return rows.map((r) => ({
      tier: r.tier as ChargebackTier,
      emittedAtIso:
        r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }))
  }
}

/**
 * Default persister: writes a row to chargeback_alerts capturing the
 * tier, rates, sample sizes, email status, and pause flag. The
 * orchestrator decides which alerts cross the rate-limit threshold; we
 * record the alert row regardless so the founder dashboard surfaces
 * every yellow/red event (rate-limited rows are still visible).
 */
export function makeDefaultPersistAlert(sql: PostgresLikeClient): PersistAlertFn {
  // H1 + H6 hostile fixes:
  //   - The schema has neither `reason` nor `emitted_at` columns; both
  //     concepts live in `details` jsonb (forensic replay payload) +
  //     `created_at`.
  //   - rate_by_count/rate_by_volume are stored as text in the schema
  //     (decimal-as-text for portability — see schema.ts comment), so
  //     we serialize the JS numbers explicitly.
  return async (params) => {
    const details = JSON.stringify({
      reason: params.classification.reason,
      suppressedByLowSampleSize: params.classification.suppressedByLowSampleSize,
      // Replay payload — the inputs that produced this classification.
      inputs: params.inputs,
      // Threshold metadata so historical alerts stay interpretable
      // even if we later change the green/yellow/red boundaries.
      thresholdsAtRunTime: {
        rateByCount: params.classification.rateByCount,
        rateByVolume: params.classification.rateByVolume,
      },
    })
    await sql`
      INSERT INTO chargeback_alerts (
        developer_id, tier, rate_by_count, rate_by_volume,
        charges_count, chargebacks_count, charges_volume_cents,
        chargebacks_volume_cents, paused_onboarding, details,
        email_status, created_at
      )
      VALUES (
        ${params.developerId}::uuid,
        ${params.tier},
        ${params.classification.rateByCount.toString()},
        ${params.classification.rateByVolume.toString()},
        ${params.inputs.chargesCount},
        ${params.inputs.chargebacksCount},
        ${params.inputs.chargesVolumeCents},
        ${params.inputs.chargebacksVolumeCents},
        ${params.pauseApplied},
        ${details}::jsonb,
        ${params.emailStatus},
        NOW()
      )
    `
  }
}

/**
 * Default pause flipper: sets developers.onboarding_paused = true and
 * stamps the reason. Hostile (c) — reversible via the founder admin
 * UI (POST /api/admin/chargeback-watch/unpause), which sets it back to
 * false. We deliberately don't suspend or hard-delete — only NEW tool
 * onboarding is gated by this flag.
 */
export function makeDefaultFlipPause(sql: PostgresLikeClient): FlipPauseFn {
  return async (developerId, reason) => {
    await sql`
      UPDATE developers
      SET onboarding_paused = true,
          onboarding_paused_at = NOW(),
          onboarding_paused_reason = ${reason},
          updated_at = NOW()
      WHERE id = ${developerId}::uuid
    `
  }
}

/**
 * Default email sender: posts directly to the Resend HTTP API. The
 * cron runs in a Node script outside the Next.js bundle (we can't
 * import apps/web/src/lib/email.ts without dragging in the env-validation
 * + Drizzle graph), so we render the template here with a slim copy of
 * the same formatter outputs.
 *
 * Spec hostile (d): rate-limit decisions are made BEFORE this is
 * called — `shouldSendChargebackAlert` returns `open=false` and the
 * orchestrator records `alertSent='rate_limited'` without invoking
 * sendEmail.
 *
 * Spec: red-tier emails the developer AND the founder. We send a
 * single email with founder cc'd; founder sees identical body.
 */
export async function defaultSendEmail(
  tier: 'yellow' | 'red',
  dev: DeveloperContext,
  inputs: VelocityInputs,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Fail-soft: in environments without Resend (dry-run, CI without
    // the secret), record the alert but don't pretend we emailed.
    console.warn('RESEND_API_KEY missing — skipping email send')
    return { sent: false }
  }

  const tpl = renderChargebackAlertTemplate(tier, dev, inputs)
  const founderEmail = process.env.FOUNDER_EMAIL ?? FOUNDER_EMAIL_FALLBACK
  // Spec: red-tier emails the developer AND the founder. We send a
  // single Resend message with both addresses so the founder sees the
  // identical body and Stripe disputes link.
  const recipients =
    tier === 'red' ? [dev.email, founderEmail] : [dev.email]

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SettleGrid <notifications@settlegrid.ai>',
      to: recipients,
      subject: tpl.subject,
      html: tpl.html,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown')
    console.error(`Resend send failed (${res.status}): ${body}`)
    return { sent: false }
  }
  return { sent: true }
}

function safeRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0
  if (denominator === 0) return 0
  return numerator / denominator
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtCents(cents: number): string {
  if (!Number.isFinite(cents)) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  )
}

/**
 * Render the chargeback alert email body inline. We deliberately do
 * NOT import apps/web/src/lib/email.ts (which uses Next-style `@/`
 * alias paths and would not resolve in a script context). The body is
 * a plain semantic HTML payload that Resend renders fine; visual
 * polish lives in the apps/web templates and is out-of-scope for the
 * cron's transactional alert.
 *
 * Subject + body wording mirror the apps/web equivalents
 * (chargebackYellowAlertEmail / chargebackRedAlertEmail) so that
 * recipients see consistent language regardless of channel.
 */
export function renderChargebackAlertTemplate(
  tier: 'yellow' | 'red',
  dev: DeveloperContext,
  inputs: VelocityInputs,
): { subject: string; html: string } {
  const rateByCount = safeRate(inputs.chargebacksCount, inputs.chargesCount)
  const rateByVolume = safeRate(
    inputs.chargebacksVolumeCents,
    inputs.chargesVolumeCents,
  )
  const ratePct = (Math.max(rateByCount, rateByVolume) * 100).toFixed(2)
  const greeting = dev.name ? escapeHtml(dev.name) : 'there'
  const summaryRows = [
    `<tr><td>Rate by count</td><td>${(rateByCount * 100).toFixed(2)}%</td></tr>`,
    `<tr><td>Rate by volume</td><td>${(rateByVolume * 100).toFixed(2)}%</td></tr>`,
    `<tr><td>Charges (30d)</td><td>${inputs.chargesCount} (${fmtCents(inputs.chargesVolumeCents)})</td></tr>`,
    `<tr><td>Disputes (30d)</td><td>${inputs.chargebacksCount} (${fmtCents(inputs.chargebacksVolumeCents)})</td></tr>`,
  ].join('\n')

  if (tier === 'yellow') {
    return {
      subject: 'Chargeback rate above 0.3% — heads-up',
      html:
        `<p>Hi ${greeting},</p>` +
        `<p>Your account's chargeback rate has crossed the 0.3% watch line over the last 30 days. ` +
        `Stripe begins flagging accounts at 1%, so there's plenty of room to course-correct.</p>` +
        `<p><strong>Current rate: ${ratePct}%</strong> — Yellow tier (informational only; no action taken).</p>` +
        `<table style="border-collapse:collapse">${summaryRows}</table>` +
        `<p>Common causes worth ruling out: stale subscription cards, vague descriptors on the ` +
        `consumer's statement, and tools that consumers forgot they enabled.</p>` +
        `<p><a href="https://settlegrid.ai/dashboard">Review your dashboard</a></p>` +
        `<p style="font-size:11px;color:#9ca3af">You will not receive another yellow alert from us within 7 days.</p>`,
    }
  }
  // red tier
  return {
    subject: 'Chargeback rate above 0.5% — onboarding paused',
    html:
      `<p>Hi ${greeting},</p>` +
      `<p>Your account has crossed the 0.5% chargeback rate over the last 30 days. ` +
      `To stay below Stripe's 1% intervention threshold, we have paused new tool onboarding for your account. ` +
      `Existing tools and payouts are not affected.</p>` +
      `<p><strong>Current rate: ${ratePct}%</strong> — Red tier (new tool onboarding paused).</p>` +
      `<table style="border-collapse:collapse">${summaryRows}</table>` +
      `<p><strong>What to do next:</strong></p>` +
      `<ol>` +
      `<li>Review the disputed charges in your <a href="https://dashboard.stripe.com/disputes">Stripe dispute dashboard</a>.</li>` +
      `<li>Submit evidence for any disputes you believe are unfounded.</li>` +
      `<li>Reply to this email with a remediation plan; we'll lift the pause once the rate drops back to 0.3% or after a one-on-one.</li>` +
      `</ol>` +
      `<p><a href="mailto:luther@mail.settlegrid.ai?subject=Chargeback%20remediation%20plan">Reply to discuss</a></p>` +
      `<p style="font-size:11px;color:#9ca3af">You will not receive another red alert from us within 24 hours.</p>`,
  }
}

// ─── CLI entry-point ─────────────────────────────────────────────────

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  depsOverride?: RunDeps,
): Promise<number> {
  let args: CliArgs
  try {
    args = parseArgs(argv)
  } catch (err) {
    console.error(`Argument error: ${(err as Error).message}`)
    printHelp()
    return 2
  }
  if (args.help) {
    printHelp()
    return 0
  }

  // Build production deps lazily — dry-run + tests skip the DB open.
  let deps: RunDeps = depsOverride ?? {}
  let sql: PostgresLikeClient | null = null
  if (!depsOverride && !args.dryRun) {
    try {
      sql = await openPostgres()
    } catch (err) {
      console.error(`Database open failed: ${(err as Error).message}`)
      return 1
    }
    deps = {
      loadDevelopers: makeDefaultLoadDevelopers(sql),
      loadAlertHistory: makeDefaultLoadAlertHistory(sql),
      persistAlert: makeDefaultPersistAlert(sql),
      flipPause: makeDefaultFlipPause(sql),
      sendEmail: defaultSendEmail,
    }
  }

  try {
    await runChargebackVelocity(args, deps)
    return 0
  } catch (err) {
    console.error(`Chargeback velocity run failed: ${(err as Error).message}`)
    if ((err as Error).stack) console.error((err as Error).stack)
    return 1
  } finally {
    if (sql) {
      await sql.end({ timeout: 5 }).catch(() => {})
    }
  }
}

const isDirectInvocation =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith('chargeback-velocity.ts'))
if (isDirectInvocation) {
  main().then((code) => process.exit(code))
}

// Re-export the rate-limit window constant so callers (and the README
// snapshot in HANDOFF docs) can confirm the per-tier cadence.
export { ALERT_WINDOW_HOURS_YELLOW }
