/**
 * V-N3 — ledger payer-PII DATA-MINIMIZATION (DARK by default).
 *
 * The shared transform + predicate used by BOTH the daily cron
 * (`/api/cron/payer-anonymize`) and the one-time admin backfill
 * (`/api/admin/payer-anonymize-backfill`). On a TERMINAL, credit-resolved, aged
 * x402/circle-nano settlement row it, in ONE atomic UPDATE:
 *   - rewrites `operation_id` `{rail}:{network}:{payer}:{nonce}` →
 *     `{rail}:{network}:anon:{id}` — dropping BOTH the raw EVM payer AND the
 *     EIP-3009 nonce, and
 *   - surgically removes `metadata.payer` (`metadata - 'payer'`, NEVER an
 *     object-overwrite — F5).
 *
 * Why drop the nonce too: the PK `id` is a deterministic UUID derived from
 * sha256("settlement:"+operation_id) (ledger.ts:settlementEntryId), and the
 * nonce is stored ONLY inside operation_id (no other column/metadata/table).
 * Keeping the nonce would let an attacker brute-force the (enumerable) payer
 * address and match the PK `id`; removing it leaves the `id` preimage holding an
 * unstored 256-bit nonce → brute-force infeasible → the `id` is de-identified
 * and need not (must not — it is the PK, nothing FKs it) be rewritten. The `id`
 * is already stored on the row, so re-using it as the anon token leaks nothing.
 *
 * This is MINIMIZATION, not erasure: the payer + nonce stay permanently public
 * on-chain (`external_ref` → the settlement tx; the EIP-3009 AuthorizationUsed
 * event). We only remove the address from SettleGrid's queryable columns.
 *
 * Ships behind the disabled `LEDGER_PAYER_ANONYMIZE_ENABLED` flag; flipping it
 * on + running the backfill are SEPARATE counsel-gated acts (handoff §7).
 */
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ledgerEntries } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { RECONCILABLE_RAILS } from './rails'
import { parseSettlementOperationId } from './reconcile'
import { MAX_VALIDBEFORE_WINDOW_SECONDS } from './x402/types'
import { getLedgerPayerAnonymizeAfterDays, isLedgerPayerAnonymizeEnabled } from '@/lib/env'

/** The only terminal states a settlement row is ever WRITTEN to (handoff F12:
 *  'voided'/'reversed' are dead arms — no writer sets them). NEVER 'pending':
 *  every live `eq(operationId)` flip/idempotency reader keys on pending or an
 *  in-replay-window terminal row, so pending + within-window rows stay untouched. */
const TERMINAL_STATUSES = ['settled', 'failed'] as const

/** POSIX-regex mirror of reconcile.ts:107-108 (CIRCLE_NANO_OPID / X402_OPID),
 *  used ONLY as a coarse SQL pre-filter for "operation_id still carries the raw
 *  payer". The authoritative gate is the TS `isAnonymizationEligible` re-check
 *  (which calls the canonical `parseSettlementOperationId`), so a drift here can
 *  only ever anonymize FEWER rows (safe), never more. Keep in sync with
 *  reconcile.ts if those shapes change. */
const PAYER_OPID_SQL_REGEX =
  '^(x402|circle-nano):eip155:[0-9]+:0x[0-9a-fA-F]{40}:0x[0-9a-fA-F]{64}$'

const ONE_DAY_SECONDS = 86_400
// Safety margin above the replay cap: the reconciler's overdue window (6h) + its
// confirm/sweep windows + clock skew. A TERMINAL row older than (replay cap +
// this margin) can no longer be reached by an idempotency reader — its EIP-3009
// authorization is EXPIRED, so the verifier rejects it BEFORE the alreadySettled
// (orchestrate.ts) / PREVIOUSLY_FAILED (circle-nano/settle.ts) / in-request
// findSettlementRow re-read ever runs — and is past every open-reconcile window.
const RECONCILER_SAFETY_MARGIN_SECONDS = 6 * 3600 + 3600

/**
 * HARD FLOOR on the retention window (handoff F2 — load-bearing). Anonymizing a
 * still-replayable terminal row would let a buyer's idempotent retry miss the
 * `alreadySettled` hit → DOUBLE-forward to upstream / double-credit. The window
 * MUST exceed the replay cap + reconciler margin; an absolute 1-day minimum
 * guards against a future shrink of MAX_VALIDBEFORE_WINDOW_SECONDS.
 */
export const ANONYMIZE_WINDOW_FLOOR_SECONDS = Math.max(
  MAX_VALIDBEFORE_WINDOW_SECONDS + RECONCILER_SAFETY_MARGIN_SECONDS,
  ONE_DAY_SECONDS,
)

/**
 * Resolve the configured retention window to seconds, ASSERTING the floor.
 * Throws on a NaN / sub-floor value so a counsel "shorter for PII" choice can
 * never cross into the replay/reconcile window. Default (2555d) is far above.
 */
export function resolveAnonymizeWindowSeconds(): number {
  const days = getLedgerPayerAnonymizeAfterDays()
  const seconds = days * ONE_DAY_SECONDS
  if (!Number.isFinite(seconds) || seconds < ANONYMIZE_WINDOW_FLOOR_SECONDS) {
    throw new Error(
      `LEDGER_PAYER_ANONYMIZE_AFTER_DAYS=${days} → ${seconds}s is below the ` +
        `${ANONYMIZE_WINDOW_FLOOR_SECONDS}s safety floor (replay cap ` +
        `${MAX_VALIDBEFORE_WINDOW_SECONDS}s + reconciler margin, min 1 day). ` +
        `Anonymizing within the replay/reconcile window risks a missed alreadySettled ` +
        `idempotency hit → double-forward/double-credit. Refusing to run.`,
    )
  }
  return seconds
}

/** Minimal row shape the predicate + transform read. NEVER includes the payer
 *  VALUE — `hasPayerMeta` is a boolean (`metadata.payer IS NOT NULL`) so no PII
 *  enters process memory beyond the (about-to-be-removed) operation_id. */
export interface AnonymizeCandidate {
  id: string
  operationId: string | null
  rail: string | null
  settlementStatus: string | null
  creditedAt: Date | null
  createdAt: Date
  hasPayerMeta: boolean
}

/** A selected candidate plus its keyset anchor: `created_at` rendered at FULL
 *  microsecond precision via Postgres `::text` (the postgres.js JS-Date is only
 *  millisecond-precise — see {@link rowKeysetCursor}). */
interface CandidateRow extends AnonymizeCandidate {
  cursorCreatedAt: string
}

/**
 * THE safe-to-anonymize predicate (handoff §6.1 + F1/F2 — load-bearing). The
 * authoritative gate: every row is re-checked here in TS before its UPDATE, so a
 * too-eager SQL pre-filter can NEVER cause an ineligible row to be mutated.
 *
 * A row is eligible IFF:
 *   - rail ∈ {x402, circle-nano} (== RECONCILABLE_RAILS) — the ONLY payer-bearing
 *     rails (F1); excludes ap2/mcp/acp/ucp/mastercard-vi + legacy rail-NULL rows.
 *   - settlement_status ∈ {settled, failed} — TERMINAL only; NEVER pending.
 *   - created_at < cutoff — aged past the floored retention window (F2).
 *   - NOT (settled ∧ credited_at IS NULL) — the uncredited-sweep carve-out: the
 *     reconcile.ts:963 sweep + the reconciler/proxy credit markers key on these
 *     rows' operation_id; anonymizing one destroys the operator's incident key
 *     (rail is always reconcilable here, so §6.1's "rail reconcilable" is implied).
 *   - still carries payer PII in EITHER surface (op_id parseable ⟹ payer+nonce
 *     present; hasPayerMeta ⟹ metadata.payer present) — already-anon rows are
 *     excluded → idempotent re-runs are no-ops.
 */
export function isAnonymizationEligible(
  row: AnonymizeCandidate,
  opts: { cutoff: Date },
): boolean {
  if (!row.rail || !(RECONCILABLE_RAILS as readonly string[]).includes(row.rail)) return false
  if (!row.settlementStatus || !(TERMINAL_STATUSES as readonly string[]).includes(row.settlementStatus)) {
    return false
  }
  if (!(row.createdAt < opts.cutoff)) return false
  // Uncredited-sweep carve-out (NEVER anonymize an open credit-resolution incident).
  if (row.settlementStatus === 'settled' && row.creditedAt == null) return false
  if (row.operationId == null) return false // malformed settlement row — leave untouched
  const opIdHasPayer = parseSettlementOperationId(row.operationId, row.rail) !== null
  if (!opIdHasPayer && !row.hasPayerMeta) return false // already fully anonymized
  return true
}

/**
 * Compute the anonymized operation_id: drop the payer + nonce, keep `{rail}:{network}`,
 * append `:anon:{id}`. For an already-anon / unparseable shape returns the value
 * UNCHANGED (the caller still runs the surgical `metadata - 'payer'` removal — a
 * torn row's stray payer is cleaned without mangling its op_id). The result FAILS
 * X402_OPID / CIRCLE_NANO_OPID (handoff F7) so an anonymized row can never be
 * parsed by the reconciler. Caller guarantees `operationId` is non-null.
 */
export function computeAnonymizedOperationId(row: {
  operationId: string
  rail: string
  id: string
}): string {
  const parsed = parseSettlementOperationId(row.operationId, row.rail)
  if (!parsed) return row.operationId
  return `${row.rail}:${parsed.network}:anon:${row.id}`
}

/**
 * Build the keyset-pagination cursor anchor for a scanned row.
 *
 * Uses `cursorCreatedAt` — the row's `created_at` rendered by Postgres `::text` at
 * FULL microsecond precision — NOT `createdAt.toISOString()`. The postgres.js
 * driver parses `timestamptz` into a JS `Date`, which is MILLISECOND-precision, so
 * `toISOString()` silently truncates sub-millisecond microseconds. A truncated
 * anchor compares strictly LESS than a row whose stored `created_at` carries those
 * microseconds, so the keyset `(created_at, id) > (anchor::timestamptz, anchor.id)`
 * re-qualifies that row on the `created_at` element alone — the `id` tiebreaker
 * never engages → the cursor never advances past it → infinite re-selection of the
 * bucket (bounded by the batch/budget caps) AND a silent skip of later rows. Today
 * every in-scope settlement row is millisecond-precise (recordSettlementEntry
 * stamps `created_at` from a JS ISO string), so this is a latent invariant;
 * carrying the anchor losslessly removes the dependency on that invariant.
 */
export function rowKeysetCursor(row: { cursorCreatedAt: string; id: string }): {
  createdAt: string
  id: string
} {
  return { createdAt: row.cursorCreatedAt, id: row.id }
}

const BATCH_SIZE = 1000
// Hard backstop on per-invocation batches (the wall-clock budget is the real
// limiter). A backlog larger than one run drains across subsequent runs: the
// cron re-runs daily and the backfill is re-runnable — each invocation restarts
// the cursor at the oldest STILL-eligible row (anonymized rows drop out of the
// pre-filter), so progress is monotone and idempotent.
const MAX_BATCHES = 1000
// Leave headroom under the routes' maxDuration (300s) for request/response + the
// completion log.
const DEFAULT_BUDGET_MS = 250_000

export interface PayerAnonymizationResult {
  /** false ⇒ the DARK flag is off; ZERO rows were touched. */
  enabled: boolean
  /** rows whose operation_id + metadata.payer were rewritten this run. */
  anonymized: number
  /** candidate rows examined. */
  scanned: number
  /** candidates skipped (ineligible on TS re-check, or lost an optimistic race). */
  skipped: number
  /** batches selected. */
  batches: number
  /** true ⇒ the eligible set drained; false ⇒ stopped on budget/batch cap (more may remain). */
  completed: boolean
}

/**
 * Select one batch of candidate rows — a coarse SQL mirror of the predicate
 * (the TS re-check is authoritative). Keyset cursor on (created_at, id) so the
 * loop terminates regardless of whether an UPDATE removes a row from the filter.
 * Reads only non-PII columns (a `hasPayerMeta` boolean, never the payer value).
 */
async function selectCandidateBatch(opts: {
  cutoff: Date
  cursor: { createdAt: string; id: string } | null
  limit: number
}): Promise<CandidateRow[]> {
  const { cutoff, cursor, limit } = opts
  return db
    .select({
      id: ledgerEntries.id,
      operationId: ledgerEntries.operationId,
      rail: ledgerEntries.rail,
      settlementStatus: ledgerEntries.settlementStatus,
      creditedAt: ledgerEntries.creditedAt,
      createdAt: ledgerEntries.createdAt,
      // Full-precision keyset anchor (microseconds preserved) — the JS-Date
      // `createdAt` above is only millisecond-precise (rowKeysetCursor).
      cursorCreatedAt: sql<string>`${ledgerEntries.createdAt}::text`,
      hasPayerMeta: sql<boolean>`(${ledgerEntries.metadata} ->> 'payer') IS NOT NULL`,
    })
    .from(ledgerEntries)
    .where(
      and(
        inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS]),
        inArray(ledgerEntries.settlementStatus, [...TERMINAL_STATUSES]),
        lt(ledgerEntries.createdAt, cutoff),
        sql`NOT (${ledgerEntries.settlementStatus} = 'settled' AND ${ledgerEntries.creditedAt} IS NULL)`,
        sql`(${ledgerEntries.operationId} ~ ${PAYER_OPID_SQL_REGEX} OR (${ledgerEntries.metadata} ->> 'payer') IS NOT NULL)`,
        cursor
          ? sql`(${ledgerEntries.createdAt}, ${ledgerEntries.id}) > (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(asc(ledgerEntries.createdAt), asc(ledgerEntries.id))
    .limit(limit)
}

/**
 * Anonymize ONE row in a single atomic UPDATE (handoff F5/F8): op_id rewrite +
 * surgical `metadata - 'payer'` together → no torn row can exist. The WHERE
 * re-asserts terminal status AND optimistic concurrency on the ORIGINAL op_id, so
 * a concurrent run / a row that changed since SELECT matches 0 rows (idempotent,
 * TOCTOU-safe). Returns whether the row was updated.
 */
async function anonymizeRow(row: AnonymizeCandidate, newOperationId: string): Promise<boolean> {
  const updated = await db
    .update(ledgerEntries)
    .set({
      operationId: newOperationId,
      metadata: sql`${ledgerEntries.metadata} - 'payer'`,
    })
    .where(
      and(
        eq(ledgerEntries.id, row.id),
        eq(ledgerEntries.operationId, row.operationId as string),
        inArray(ledgerEntries.settlementStatus, [...TERMINAL_STATUSES]),
      ),
    )
    .returning({ id: ledgerEntries.id })
  return updated.length > 0
}

/**
 * Run the payer-PII minimization. DARK-GATED: returns a ZERO no-op while the flag
 * is off (never resolves the window, never touches a row). When enabled, asserts
 * the window floor (throws on a sub-floor config), then anonymizes eligible rows
 * in keyset-paginated batches within a wall-clock budget. Logs COUNTS ONLY — no
 * payer address, no operation_id ever reaches a log sink.
 */
export async function runPayerAnonymization(opts?: {
  label?: string
  batchSize?: number
  maxBatches?: number
  budgetMs?: number
  now?: Date
}): Promise<PayerAnonymizationResult> {
  const label = opts?.label ?? 'payer-anonymize'

  if (!isLedgerPayerAnonymizeEnabled()) {
    return { enabled: false, anonymized: 0, scanned: 0, skipped: 0, batches: 0, completed: true }
  }

  const windowSeconds = resolveAnonymizeWindowSeconds() // throws on a sub-floor window
  const batchSize = opts?.batchSize ?? BATCH_SIZE
  const maxBatches = opts?.maxBatches ?? MAX_BATCHES
  const budgetMs = opts?.budgetMs ?? DEFAULT_BUDGET_MS
  const now = opts?.now ?? new Date()
  const cutoff = new Date(now.getTime() - windowSeconds * 1000)
  const startedAt = Date.now()

  let anonymized = 0
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
    const candidates = await selectCandidateBatch({ cutoff, cursor, limit: batchSize })
    if (candidates.length === 0) break
    batches++
    for (const row of candidates) {
      scanned++
      cursor = rowKeysetCursor(row)
      if (!isAnonymizationEligible(row, { cutoff })) {
        skipped++
        continue
      }
      const newOperationId = computeAnonymizedOperationId({
        operationId: row.operationId as string,
        rail: row.rail as string,
        id: row.id,
      })
      if (await anonymizeRow(row, newOperationId)) anonymized++
      else skipped++
    }
    if (candidates.length < batchSize) break
    if (batches >= maxBatches) completed = false
  }

  // Counts only — NEVER a payer address or operation_id (no-PII-in-logs pin).
  logger.info('ledger.payer_anonymize.completed', {
    label,
    anonymized,
    scanned,
    skipped,
    batches,
    completed,
    windowSeconds,
  })

  return { enabled: true, anonymized, scanned, skipped, batches, completed }
}
