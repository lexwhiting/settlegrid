/**
 * V-N3-invocations-min — `invocations.metadata` EVM-payer DATA-MINIMIZATION
 * (DARK by default).
 *
 * The SECOND DC-16 census surface (the first — settlement-log + Sentry redaction —
 * shipped at `bc7abc3e`). The proxy persists, on a protocol-paid invocation row
 * (`recordProtocolInvocation`, route.ts), the raw EVM on-chain payer SettleGrid
 * CAPTURES while settling an x402 / circle-nano / drain payment, in
 * `invocations.metadata` (jsonb). This module is the shared, pure transform that
 * removes that payer from the metadata object, used by BOTH:
 *   - the write-path (route.ts `recordProtocolInvocation`, flag-gated — minimizes
 *     the fully-MERGED metadata before the insert), and
 *   - the one-time backfill (`cron/invocations-payer-min` + `admin/
 *     invocations-payer-min-backfill`, which use the SQL surgical-subtraction form
 *     derived from the SAME key constants).
 *
 * Three coverage arms (handoff §5#1/§5#2 + §6; arm 3 added by the ③ deep audit):
 *   1. UNCONDITIONAL key removal (by NAME) of {@link INVOCATIONS_EVM_PAYER_KEYS}
 *      `{payer, payerAddress, drainNonce, drainChannelId}`. These are EVM-only
 *      metadata keys (circle-nano writes `payer`/`payerAddress`; drain writes
 *      `drainChannelId` [a per-channel EVM contract address] + `drainNonce` [a
 *      channel counter — a JS **number** at runtime, so a value-shape test would
 *      mishandle it: removal is by NAME]). No non-EVM rail writes any of them.
 *   2. RAIL-GATED removal of {@link RAIL_GATED_PAYER_KEY} `payerIdentifier` IFF
 *      `paymentMethod ∈` {@link EVM_PAYER_RAILS} `{x402, circle-nano, drain}`.
 *      `payerIdentifier` is a UNION key — a raw EVM address for those three rails
 *      and an opaque non-EVM id (ap2 consumerId, ucp paymentHandler, kyapay
 *      principalId, …) for every other rail. We gate on the RAIL, never a
 *      value-shape `isAddress` test: strict EIP-55 would EVADE an attacker-cased
 *      (verbatim-stored, un-normalized) EVM payer → leak with the flag ON; loose
 *      `{strict:false}` would OVER-minimize a live 40-hex non-EVM id (kyapay JWT
 *      sub / visa-tap token) → break attribution. `paymentMethod` is written on
 *      100% of protocol rows and that set is EXACTLY the EVM-address rails. x402
 *      writes NO fixed `payer` key, so its entire EVM-payer coverage rests on
 *      this arm — it is NOT optional.
 *   3. DRAIN-GATED removal of {@link DRAIN_EVM_PAYER_KEYS} `paymentId` IFF
 *      `paymentMethod ===` {@link DRAIN_RAIL}. For drain ONLY, the proxy routes the
 *      raw EVM channel contract address into the generic `paymentId` key (the SAME
 *      value as `drainChannelId`; route.ts:2465 `paymentId = result.channelId`), so
 *      removing `drainChannelId` alone left the identical address in `paymentId`. On
 *      every NON-drain rail `paymentId` is a settlement tx-hash / opaque ref and is
 *      RETAINED — hence drain-gated, never unconditional. (Found by the ③ post-seal
 *      deep audit: a VALUE-PROVENANCE leak the NAME-shape census guard could not see.)
 *
 * This is MINIMIZATION, not erasure: the payer stays permanently public on-chain
 * (the settlement tx / the EIP-3009 authorization). We only remove the address
 * from SettleGrid's queryable column.
 *
 * Ships behind the disabled `INVOCATIONS_PAYER_MINIMIZE_ENABLED` flag
 * ({@link isInvocationsPayerMinimizeEnabled}). Flipping it on + running the
 * backfill + amending the `compliance.ts` disclosure are SEPARATE counsel-gated
 * acts (the V-N3-erasure ENABLE-RUNBOOK — handoff §11). OFF ⇒ both the write-path
 * and the routes are byte-for-byte no-ops.
 */
import { and, asc, eq, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invocations } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { isInvocationsPayerMinimizeEnabled } from '@/lib/env'

/**
 * The protocol-invocation sentinel consumer id (route.ts:1538
 * `recordProtocolInvocation`). The backfill is scoped to exactly these rows — it
 * EXCLUDES the mpp sentinel (`…0001`, which carries the deliberately-retained
 * Stripe `mppPayerCustomerId`, R2) AND every real-consumer / developer-metering
 * row (`sdk/meter-with-metadata`), so the developer's own free-form metadata is
 * never touched. Mirrors route.ts:1538. EXPORTED so the census guard asserts it
 * stays in sync with the proxy literal — a silent drift would scope the backfill
 * to the wrong consumer id while reporting success (③ deep-audit drift guard).
 */
export const PROTOCOL_SENTINEL_ID = '00000000-0000-0000-0000-000000000002'

/**
 * The metadata keys removed UNCONDITIONALLY (by NAME) — the SINGLE source of
 * truth, consumed by the JS minimizer below, the SQL backfill subtraction, and
 * the census guard (`invocations-payer-census.test.ts`). Each is an EVM-only
 * metadata key (no non-EVM rail writes any of them — see the module header).
 *
 * NOTE: this is intentionally a DIFFERENT set from
 * `sanitizing-adapter-logger.ts`'s `PAYER_META_KEYS` (whose drain key is
 * `channelId`; here the DB-metadata key is `drainChannelId`). The divergence is
 * correct — they are different surfaces — so the two constants are NOT shared.
 */
export const INVOCATIONS_EVM_PAYER_KEYS = [
  'payer',
  'payerAddress',
  'drainNonce',
  'drainChannelId',
] as const

/** The payment rails whose `payerIdentifier` metadata value is a raw EVM address
 *  (verified against the `PaymentMethod` union, route.ts:1478). For every OTHER
 *  rail `payerIdentifier` is an opaque non-EVM id and is RETAINED (R2). */
export const EVM_PAYER_RAILS = ['x402', 'circle-nano', 'drain'] as const

/** The union key removed ONLY on an {@link EVM_PAYER_RAILS} row (the rail-gated arm). */
export const RAIL_GATED_PAYER_KEY = 'payerIdentifier'

/** The drain rail — a sub-case of {@link EVM_PAYER_RAILS} where the proxy ALSO routes
 *  the raw EVM channel contract address (`voucher.channelAddress`) into the otherwise
 *  generic `paymentId` key (route.ts:2465 `paymentId = result.channelId`, the SAME
 *  value it writes to `drainChannelId`). */
export const DRAIN_RAIL = 'drain'

/** Keys whose VALUE is a raw EVM address ONLY on the {@link DRAIN_RAIL} — removed
 *  DRAIN-GATED, never unconditionally (on every other rail `paymentId` is a non-EVM
 *  settlement tx-hash / opaque ref and is RETAINED). Added by the ③ post-seal deep
 *  audit: a value-provenance leak the name-shape census guard could not detect. */
export const DRAIN_EVM_PAYER_KEYS = ['paymentId'] as const

/**
 * Minimize a protocol-invocation metadata object: remove the raw EVM payer
 * SettleGrid captured. PURE + idempotent; returns a SHALLOW COPY and NEVER
 * mutates its argument (the write-path owns the fresh merged object, but the
 * no-mutation contract keeps it safe to call anywhere).
 *
 *   - removes {@link INVOCATIONS_EVM_PAYER_KEYS} unconditionally (by name),
 *   - removes {@link RAIL_GATED_PAYER_KEY} IFF `meta.paymentMethod` is one of
 *     {@link EVM_PAYER_RAILS}, and
 *   - removes {@link DRAIN_EVM_PAYER_KEYS} (`paymentId`) IFF `meta.paymentMethod`
 *     is the {@link DRAIN_RAIL} (where `paymentId` == the EVM channel address).
 *
 * Every other key (`proxy`, `paymentMethod`, `toolSlug`, `upstreamStatus`,
 * `network`, `amountUsdc`, `drainAmountUsdc`, a NON-drain `paymentId` (tx-hash /
 * opaque ref), the non-EVM rails' own-prefixed ids, …) is preserved — correlation
 * is retained.
 */
export function minimizeInvocationMetadata(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...meta }
  for (const key of INVOCATIONS_EVM_PAYER_KEYS) delete out[key]
  const paymentMethod =
    typeof meta.paymentMethod === 'string' ? meta.paymentMethod : undefined
  if (paymentMethod && (EVM_PAYER_RAILS as readonly string[]).includes(paymentMethod)) {
    delete out[RAIL_GATED_PAYER_KEY]
  }
  // drain ALSO routes the EVM channel address into `paymentId` (== the already-
  // removed drainChannelId), so strip the drain-only EVM keys too. Drain-gated:
  // every other rail's `paymentId` is a non-EVM ref and must be retained.
  if (paymentMethod === DRAIN_RAIL) {
    for (const key of DRAIN_EVM_PAYER_KEYS) delete out[key]
  }
  return out
}

// ─── Backfill (DARK) ─────────────────────────────────────────────────────────

/** Minimal row shape the candidate SELECT reads. NEVER the metadata VALUE — only
 *  the PK `id` + the keyset anchor — so no payer ever enters process memory. */
interface CandidateRow {
  id: string
  // Full microsecond-precision keyset anchor (Postgres `::text`) — see the
  // millisecond-truncation caveat in {@link rowKeysetCursor}.
  cursorCreatedAt: string
}

const BATCH_SIZE = 1000
// Hard backstop on per-invocation batches (the wall-clock budget is the real
// limiter). A backlog larger than one run drains across subsequent runs: each
// invocation restarts at the oldest STILL-candidate row (minimized rows drop out
// of the key-presence pre-filter), so progress is monotone and idempotent.
const MAX_BATCHES = 1000
// Leave headroom under the routes' maxDuration (300s) for request/response + the
// completion log.
const DEFAULT_BUDGET_MS = 250_000

/**
 * The candidate condition (handoff §5#3, refined for true convergence). A row is
 * a candidate IFF it still carries a payer key the minimizer would REMOVE:
 *   - it has any {@link INVOCATIONS_EVM_PAYER_KEYS} key (`metadata ? 'key'`), OR
 *   - it is an {@link EVM_PAYER_RAILS} row AND still has `payerIdentifier`.
 *
 * This is value-shape independent (rail-gated, §5#1) and CONVERGENT: after the
 * surgical UPDATE the row has none of those → it drops out → an idempotent re-run
 * scans zero. (Including `payerIdentifier` UNCONDITIONALLY in the presence test
 * would NOT converge — every protocol row always carries the `payerIdentifier`
 * KEY, written `?? null` at route.ts:1545, so its existence is true on every row
 * forever AND non-EVM rows would be needlessly rewritten; gating `payerIdentifier`
 * presence on the RAIL is what makes the scan terminate and leaves the non-EVM
 * rails' retained `payerIdentifier` untouched.)
 */
function candidateMetaCondition(): SQL {
  const railList = sql.join(
    EVM_PAYER_RAILS.map((r) => sql`${r}::text`),
    sql`, `,
  )
  // Each unconditional key via the `?` key-existence operator. The operator TOKEN is
  // the one the codebase already exercises at ledger.ts:817; the bound-`$N` RHS
  // variant used here (`metadata ? $1::text`) was verified live against this driver
  // in the ② seal + ③ deep audit. OR-ed rather than `?|` to stay on the single-key
  // operator.
  const unconditional = INVOCATIONS_EVM_PAYER_KEYS.map(
    (k) => sql`${invocations.metadata} ? ${k}::text`,
  )
  const railGated = sql`(${invocations.metadata} ->> 'paymentMethod' IN (${railList}) AND ${invocations.metadata} ? ${RAIL_GATED_PAYER_KEY}::text)`
  // drain-only: `paymentId` carries the EVM channel address ({@link DRAIN_EVM_PAYER_KEYS}).
  // Gated on the rail (not unconditional) so non-drain rows — which always carry a
  // RETAINED `paymentId` — never become perpetual candidates; a minimized drain row
  // (paymentId removed) drops out, so the scan still converges to zero.
  const drainGated = sql`(${invocations.metadata} ->> 'paymentMethod' = ${DRAIN_RAIL}::text AND (${sql.join(
    DRAIN_EVM_PAYER_KEYS.map((k) => sql`${invocations.metadata} ? ${k}::text`),
    sql` OR `,
  )}))`
  return sql`(${sql.join([...unconditional, railGated, drainGated], sql` OR `)})`
}

/** The sentinel-scope + object-shape + candidate-key guard shared by the SELECT
 *  pre-filter and the UPDATE WHERE. `jsonb_typeof = 'object'` defends the surgical
 *  `metadata - 'key'` operator against a (developer-influenced) scalar/null
 *  metadata that would otherwise raise 22023 "cannot delete from scalar". */
function backfillRowGuard(): SQL {
  return and(
    eq(invocations.consumerId, PROTOCOL_SENTINEL_ID),
    sql`jsonb_typeof(${invocations.metadata}) = 'object'`,
    candidateMetaCondition(),
  ) as SQL
}

/**
 * Select one keyset-paginated batch of candidate rows. Keyset cursor on
 * `(created_at, id)` so the loop terminates regardless of the UPDATE removing a
 * row from the filter. Reads ONLY the PK + the full-precision `::text` anchor —
 * never the metadata value.
 */
async function selectCandidateBatch(opts: {
  cursor: { createdAt: string; id: string } | null
  limit: number
}): Promise<CandidateRow[]> {
  const { cursor, limit } = opts
  return db
    .select({
      id: invocations.id,
      // Full-precision keyset anchor (microseconds preserved) — the postgres.js
      // JS-Date is only millisecond-precise (see rowKeysetCursor).
      cursorCreatedAt: sql<string>`${invocations.createdAt}::text`,
    })
    .from(invocations)
    .where(
      and(
        backfillRowGuard(),
        cursor
          ? sql`(${invocations.createdAt}, ${invocations.id}) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(asc(invocations.createdAt), asc(invocations.id))
    .limit(limit)
}

/**
 * Build the keyset cursor anchor — `cursorCreatedAt` (Postgres `::text`, full
 * microsecond precision), NOT `createdAt.toISOString()`. The postgres.js driver
 * parses `timestamptz` to a millisecond-precise JS Date, so a truncated anchor
 * compares strictly less than a row carrying sub-millisecond microseconds →
 * the keyset re-qualifies that row on `created_at` alone (the `id` tiebreaker
 * never engages) → the cursor stalls (bounded by the caps) AND silently skips
 * later rows. Carrying the lossless `::text` anchor removes that dependency.
 */
export function rowKeysetCursor(row: CandidateRow): { createdAt: string; id: string } {
  return { createdAt: row.cursorCreatedAt, id: row.id }
}

/**
 * Surgically minimize ONE row in a single atomic UPDATE: subtract the
 * unconditional keys (`metadata - 'payer' - …`, NEVER an object-overwrite — F5,
 * which would clobber every retained key) plus a rail-gated `- 'payerIdentifier'`.
 * The WHERE re-asserts {@link backfillRowGuard} so a concurrently-minimized row
 * matches 0 (idempotent). Built from the SAME key constants as the JS minimizer.
 * Returns whether the row was updated.
 */
async function minimizeRow(id: string): Promise<boolean> {
  // metadata - 'payer' - 'payerAddress' - 'drainNonce' - 'drainChannelId'
  let stripped: SQL = sql`${invocations.metadata}`
  for (const key of INVOCATIONS_EVM_PAYER_KEYS) stripped = sql`(${stripped} - ${key}::text)`
  const railList = sql.join(
    EVM_PAYER_RAILS.map((r) => sql`${r}::text`),
    sql`, `,
  )
  // Rail-gated extra subtraction for the union key (value-shape independent).
  const evmStripped = sql`(${stripped} - ${RAIL_GATED_PAYER_KEY}::text)`
  // drain ALSO strips DRAIN_EVM_PAYER_KEYS (paymentId == the EVM channel address).
  let drainStripped: SQL = evmStripped
  for (const key of DRAIN_EVM_PAYER_KEYS) drainStripped = sql`(${drainStripped} - ${key}::text)`
  // Most-specific branch (drain) first, then the general EVM rails, then retain.
  // This CASE removes the SAME key-set as the JS minimizeInvocationMetadata for
  // every rail (the JS-minimizer ≡ SQL-backfill system invariant).
  const setExpr = sql`CASE WHEN ${invocations.metadata} ->> 'paymentMethod' = ${DRAIN_RAIL}::text THEN ${drainStripped} WHEN ${invocations.metadata} ->> 'paymentMethod' IN (${railList}) THEN ${evmStripped} ELSE ${stripped} END`

  const updated = await db
    .update(invocations)
    .set({ metadata: setExpr })
    .where(and(eq(invocations.id, id), backfillRowGuard()))
    .returning({ id: invocations.id })
  return updated.length > 0
}

export interface InvocationsPayerMinResult {
  /** false ⇒ the DARK flag is off; ZERO rows were touched. */
  enabled: boolean
  /** rows whose metadata was surgically rewritten this run. */
  minimized: number
  /** candidate rows examined. */
  scanned: number
  /** candidates whose UPDATE matched 0 (concurrently minimized — TOCTOU-safe). */
  skipped: number
  /** batches selected. */
  batches: number
  /** true ⇒ the candidate set drained; false ⇒ stopped on budget/batch cap. */
  completed: boolean
}

/**
 * Run the invocations.metadata payer minimization. DARK-GATED: a ZERO no-op while
 * the flag is off (never touches the DB). When enabled, minimizes candidate rows
 * in keyset-paginated batches within a wall-clock budget. Logs COUNTS ONLY — the
 * payer value never enters process memory (the SELECT projects only the PK + the
 * keyset anchor; the rewrite is server-side jsonb subtraction).
 *
 * Idempotent + re-runnable: each invocation restarts at the oldest still-candidate
 * row; `completed:false` ⇒ re-invoke to continue.
 */
export async function runInvocationsPayerMinimization(opts?: {
  label?: string
  batchSize?: number
  maxBatches?: number
  budgetMs?: number
}): Promise<InvocationsPayerMinResult> {
  const label = opts?.label ?? 'invocations-payer-min'

  if (!isInvocationsPayerMinimizeEnabled()) {
    return { enabled: false, minimized: 0, scanned: 0, skipped: 0, batches: 0, completed: true }
  }

  const batchSize = opts?.batchSize ?? BATCH_SIZE
  const maxBatches = opts?.maxBatches ?? MAX_BATCHES
  const budgetMs = opts?.budgetMs ?? DEFAULT_BUDGET_MS
  const startedAt = Date.now()

  let minimized = 0
  let scanned = 0
  let skipped = 0
  let batches = 0
  let completed = true
  let cursor: { createdAt: string; id: string } | null = null

  while (batches < maxBatches) {
    if (Date.now() - startedAt >= budgetMs) {
      completed = false
      break
    }
    const candidates = await selectCandidateBatch({ cursor, limit: batchSize })
    if (candidates.length === 0) break
    batches++
    for (const row of candidates) {
      scanned++
      cursor = rowKeysetCursor(row)
      if (await minimizeRow(row.id)) minimized++
      else skipped++
    }
    if (candidates.length < batchSize) break
    if (batches >= maxBatches) completed = false
  }

  // Counts only — NEVER a payer address or metadata value (no-PII-in-logs).
  logger.info('invocations.payer_minimize.completed', {
    label,
    minimized,
    scanned,
    skipped,
    batches,
    completed,
  })

  return { enabled: true, minimized, scanned, skipped, batches, completed }
}
