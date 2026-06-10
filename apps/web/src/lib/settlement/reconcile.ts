/**
 * P3.K4 — B1.4: pending-settlement reconciler.
 *
 * On-chain settlement is broadcast-then-confirmed. A2 (circle-nano) + B1.2
 * (x402) write a 'pending' ledger row carrying the broadcast txHash in
 * external_ref and flip it to terminal ONLY on a confirmed receipt. But a
 * settle that times out, crashes mid-wait, or is broadcast during a gas outage
 * leaves the row stuck 'pending' with nothing to flip it afterward. This
 * reconciler re-checks those rows on-chain and flips them — the SAME funds-safety
 * mapping the live settle path uses (settle.ts `applyOutcome`), via explicit
 * `WHERE settlement_status='pending'`-guarded UPDATEs.
 *
 * Funds-safety invariants (mirror A2):
 *   - A reverted/unconfirmed tx is NEVER recorded 'settled'.
 *   - A circle-nano revert WHERE the EIP-3009 nonce is nonetheless consumed (a
 *     concurrent tx settled it) is NOT a failure → left 'pending'.
 *   - Every flip is guarded WHERE settlement_status='pending' (terminal-safe;
 *     a race with the live settle path or another run resolves to one winner).
 */
import { and, eq, inArray, lt, asc, isNotNull, sql } from 'drizzle-orm'
import type { Hex } from 'viem'
import { db } from '@/lib/db'
import { ledgerEntries, developers, tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { markSettlementSettled, markSettlementFailed } from './ledger'
import { confirmSettlementTx } from './circle-nano/settle-engine'
// Single source of truth shared with the (H) hop rail-enum guard (rails.ts) so the
// reconciler's selection set and the guard's exclusion set can never drift.
import { RECONCILABLE_RAILS } from './rails'

export interface ReconcilableRow {
  operationId: string | null
  rail: string | null
  externalRef: string | null
  /**
   * F4 — the fields needed to credit a confirmed x402 settlement the in-request
   * proxy path never billed (it returned 'pending'). reconcilePendingSettlements
   * always selects these; optional only so the unit tests can pass minimal rows
   * for the non-crediting paths.
   *   - amountCents → the credit amount (the row's recorded cost).
   *   - accountId   → the owning developer id (credits developers.balanceCents).
   *   - metadata.toolId → the owning tool (credits tools.totalRevenueCents).
   */
  amountCents?: number | null
  accountId?: string | null
  metadata?: unknown
}

export type ReconcileOutcome =
  | 'settled'
  | 'failed'
  /**
   * (S) — the on-chain outcome was settled/failed but the row was ALREADY
   * terminal when we tried to flip it (a concurrent winner: the live settle
   * path or an overlapping run). THIS run performed no transition, so these
   * are tallied separately and the summary's settled/failed report only TRUE
   * transitions (B1.4 item 3 — the flipped:false over-report).
   */
  | 'settled-noop'
  | 'failed-noop'
  | 'pending-unconfirmed'
  | 'pending-nonce-consumed'
  | 'skipped-no-txhash'
  | 'skipped-unparseable'
  | 'skipped-unsupported'

interface ParsedOpId {
  network: string
  /** circle-nano only — enables the reverted-nonce recheck. */
  eip3009?: { from: `0x${string}`; nonce: `0x${string}` }
}

// operation_id shapes: `circle-nano:<network>:<from>:<nonce>` and
// `x402:<network>:<from>:<nonce>` — BOTH key on the EIP-3009 (from,nonce) now
// (x402 settles on-chain in-process, so the proxy has them). <network> is CAIP-2
// `eip155:<id>` (embedded colon — hence the explicit grouping, not a naive split).
const CIRCLE_NANO_OPID = /^circle-nano:(eip155:\d+):(0x[0-9a-fA-F]{40}):(0x[0-9a-fA-F]{64})$/
const X402_OPID = /^x402:(eip155:\d+):(0x[0-9a-fA-F]{40}):(0x[0-9a-fA-F]{64})$/

/**
 * Parse the network (+ circle-nano from/nonce) out of a settlement operation_id.
 * Pure. Returns null for an unrecognized shape (the reconciler leaves it untouched).
 */
export function parseSettlementOperationId(operationId: string, rail: string): ParsedOpId | null {
  if (rail === 'circle-nano') {
    const m = CIRCLE_NANO_OPID.exec(operationId)
    if (!m) return null
    return { network: m[1], eip3009: { from: m[2] as `0x${string}`, nonce: m[3] as `0x${string}` } }
  }
  if (rail === 'x402') {
    const m = X402_OPID.exec(operationId)
    if (!m) return null
    // x402 now keys on (from,nonce) like circle-nano (the proxy settles on-chain
    // itself, so it surfaces them), enabling the SAME reverted-but-nonce-consumed
    // recheck: a concurrent tx that spent the nonce settled the authorization.
    return { network: m[1], eip3009: { from: m[2] as `0x${string}`, nonce: m[3] as `0x${string}` } }
  }
  return null
}

/**
 * Reconcile ONE pending row: confirm its broadcast tx on-chain and flip the
 * ledger row to the terminal state. All flips are guarded WHERE pending.
 */
export async function reconcileOneRow(row: ReconcilableRow): Promise<ReconcileOutcome> {
  const { operationId, rail, externalRef } = row
  if (!operationId || !rail) return 'skipped-unparseable'
  // No broadcast tx to confirm (e.g. a circle-nano row whose settle errored
  // pre-broadcast). Re-submitting is the live settle path's job, not ours.
  if (!externalRef) return 'skipped-no-txhash'

  const parsed = parseSettlementOperationId(operationId, rail)
  if (!parsed) {
    logger.warn('reconcile.unparseable_operation_id', { operationId, rail })
    return 'skipped-unparseable'
  }

  const confirmation = await confirmSettlementTx(parsed.network, externalRef as Hex, parsed.eip3009)

  switch (confirmation.kind) {
    case 'settled': {
      const flipped = await markSettlementSettled(operationId, rail, confirmation.txHash)
      logger.info('reconcile.settled', { operationId, rail, txHash: confirmation.txHash, flipped })
      // F4: an async-confirmed settlement was NOT billed in-request (a settle that
      // broadcast then timed out/crashed returned 'pending', skipping the in-request
      // credit), so the dev is still uncredited despite USDC collected. Credit
      // EXACTLY ONCE — only the actor that flips the row (flipped===true, guarded
      // WHERE settlement_status='pending') credits it, the same invariant the live
      // settle paths use, so they can never both credit. Both on-chain rails
      // (x402 + circle-nano) now store the data to credit in metadata.toolId.
      if (flipped && (rail === 'x402' || rail === 'circle-nano')) {
        const rawToolId =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>).toolId
            : undefined
        const toolId = typeof rawToolId === 'string' && rawToolId.length > 0 ? rawToolId : null
        await creditSettlement({
          developerId: row.accountId,
          toolId,
          amountCents: row.amountCents,
          operationId: row.operationId,
        })
      }
      return flipped ? 'settled' : 'settled-noop'
    }
    case 'reverted': {
      if (confirmation.nonceConsumed) {
        // circle-nano: a concurrent tx spent the (from,nonce) → the USDC settled.
        // NOT a failure; leave 'pending' (we can't attribute the winning txHash).
        logger.warn('reconcile.reverted_nonce_consumed', {
          operationId,
          rail,
          txHash: confirmation.txHash,
        })
        return 'pending-nonce-consumed'
      }
      const flipped = await markSettlementFailed(operationId, rail, confirmation.txHash)
      logger.warn('reconcile.failed', { operationId, rail, txHash: confirmation.txHash, flipped })
      return flipped ? 'failed' : 'failed-noop'
    }
    case 'unconfirmed':
      // Still in mempool / dropped / RPC blip — leave pending, retry next run.
      logger.info('reconcile.unconfirmed', { operationId, rail, txHash: confirmation.txHash })
      return 'pending-unconfirmed'
    case 'unsupported-network':
      // A network the confirm engine doesn't support (e.g. a facilitator-mode
      // x402 settle on a non-Base chain — latent today, facilitator is off in
      // prod). Never flip a row we can't confirm. warn (not error) so it doesn't
      // alarm-spam every run; see the DEBT note in the B1.4 tech-debt doc.
      logger.warn('reconcile.unsupported_network', { operationId, rail })
      return 'skipped-unsupported'
  }
}

/**
 * Credit the developer balance + tool revenue for an on-chain settlement that was
 * confirmed AFTER the in-request path (the reconciler tail) — or in-request by the
 * kernel /settle route. The live proxy path credits via forwardAndBill ONLY when
 * it reaches a 'settled' outcome in-request; a broadcast-then-timeout settle this
 * reconciler later confirms skipped that, leaving USDC collected but the dev
 * uncredited (the F4 finding). Mirrors forwardAndBill's credit
 * (developers.balanceCents + tools.totalRevenueCents), atomic across the two updates.
 *
 * Exactly-once: every caller gates on the single WHERE-pending flip — the
 * reconciler on flipped===true; kernel /settle on a fresh (non-alreadySettled)
 * outcome — so the one actor that flips a row credits it, never two surfaces for
 * one payment.
 *
 * Rail-agnostic: used by BOTH on-chain rails (x402 + circle-nano). Callers pass
 * the row's toolId (from metadata) / accountId / amountCents / operationId, or pass
 * them directly. A row missing toolId still credits the dev (the payout source of
 * truth) and only skips the per-tool stat (alerted via settlement.credit_missing_toolid).
 *
 * Delivery: a buyer whose request returned 'pending' was NOT delivered; delivery is
 * available via an idempotent retry (F1 forwards a now-settled replay WITHOUT
 * re-charging). We do NOT auto-refund (a new irreversible money path needs its own
 * audit).
 *
 * Residual (accepted, alertable): the flip is already committed when we credit, so
 * a DB error here leaves THIS row's dev uncredited (the row is now 'settled', so a
 * later run won't re-select it) — the same non-atomicity the live path has.
 * settlement.credit_failed is the operator signal to credit manually (by operationId).
 *
 * B4 (2026-06-04): a developers UPDATE that matches ZERO rows (dangling developer
 * id — a deleted developer, or a mis-attributed account_id) now throws inside the
 * transaction → rollback → the catch logs settlement.credit_failed. Previously the
 * empty txn committed and 'settlement.credited' logged a FALSE success. Settlement-row
 * account_id IS the owning developer's id — the permanent semantic; see
 * docs/tech-debt/b4-account-attribution-resolution-2026-06-04.md.
 */
export async function creditSettlement(params: {
  developerId: string | null | undefined
  toolId: string | null
  amountCents: number | null | undefined
  operationId: string | null
}): Promise<void> {
  const { developerId, toolId, amountCents, operationId } = params
  if (!developerId || typeof amountCents !== 'number' || amountCents <= 0) {
    // No data to credit (a pre-F4 row, or a non-positive amount). The dev balance
    // is the payout source of truth — flag loudly rather than silently lose it.
    logger.error('settlement.credit_skipped_no_data', {
      operationId,
      hasDeveloperId: !!developerId,
      amountCents: amountCents ?? null,
    })
    return
  }

  try {
    await db.transaction(async (tx) => {
      const credited = await tx
        .update(developers)
        .set({ balanceCents: sql`${developers.balanceCents} + ${amountCents}`, updatedAt: new Date() })
        .where(eq(developers.id, developerId))
        .returning({ id: developers.id })
      if (credited.length === 0) {
        // B4: zero rows matched ⇒ the credit DID NOT HAPPEN (dangling
        // developer id — a deleted developer, or a mis-attributed
        // account_id). Without this check the txn commits empty and the
        // 'settlement.credited' log below LIES. Throw → rollback (the
        // tools update never runs) → the catch below logs
        // settlement.credit_failed, the documented operator signal to
        // credit manually by operationId.
        throw new Error(`settlement credit matched no developer row (developerId=${developerId})`)
      }
      if (toolId) {
        await tx
          .update(tools)
          .set({ totalRevenueCents: sql`${tools.totalRevenueCents} + ${amountCents}`, updatedAt: new Date() })
          .where(eq(tools.id, toolId))
      }
    })
    if (!toolId) {
      // Dev (the payout source) WAS credited; only the per-tool revenue stat is
      // missed because the row lacks a toolId. Alert so it can be reconciled.
      logger.error('settlement.credit_missing_toolid', { operationId, developerId, amountCents })
    }
    logger.info('settlement.credited', { operationId, developerId, amountCents, toolId })
  } catch (err) {
    logger.error('settlement.credit_failed', { operationId, developerId, amountCents }, err)
  }
}

/**
 * (S) — truthful run telemetry invariant:
 *   scanned === settled + failed + pending + skipped + noop + errored + deferred
 * `settled`/`failed` count TRUE transitions this run performed; raced no-op
 * flips land in `noop`; rows whose examination threw land in `errored`
 * (previously they vanished from every bucket); rows the per-run time budget
 * skipped land in `deferred` (③ post-seal hardening).
 */
export interface ReconcileSummary {
  scanned: number
  settled: number
  failed: number
  pending: number
  skipped: number
  /** (S) raced no-op flips (settled-noop + failed-noop) — already terminal via a concurrent winner. */
  noop: number
  /** (S) rows whose examination threw (left pending; re-examined after one rotation). */
  errored: number
  /**
   * (③) rows selected but NOT examined because the per-run time budget ran
   * out (`runBudgetMs`, default 40s of the route's 60s maxDuration). Deferred
   * rows are NOT watermarked, so they keep their queue position and are
   * examined first next run. The budget guarantees the overdue aggregate, the
   * pending-age alert, and this summary always emit — previously a degraded
   * RPC (viem default ~10s × 3 retries per row) could blow the 60s budget and
   * Vercel killed the run BEFORE the alert, going dark exactly during the
   * outages the alert exists to surface.
   */
  deferred: number
  /**
   * (S) pending-age alert count: pending rows on reconcilable rails older
   * than `overdueAfterMs` at run time (INCLUDING null-external_ref rows the
   * window deliberately excludes — they are classified, not hidden).
   * null ⇒ the overdue check itself failed (reconcile.overdue_check_failed).
   */
  overdue: number | null
  outcomes: Record<ReconcileOutcome, number>
}

function emptyOutcomes(): Record<ReconcileOutcome, number> {
  return {
    settled: 0,
    failed: 0,
    'settled-noop': 0,
    'failed-noop': 0,
    'pending-unconfirmed': 0,
    'pending-nonce-consumed': 0,
    'skipped-no-txhash': 0,
    'skipped-unparseable': 0,
    'skipped-unsupported': 0,
  }
}

/**
 * Find stuck 'pending' on-chain-rail settlement rows older than `olderThanMs`
 * and reconcile up to `limit` of them. Bounded per run; a large backlog clears
 * over successive runs (the immediate, non-blocking confirm means one stuck tx
 * never starves the batch).
 *
 * (S) ROTATION GUARANTEE — deferral, never exclusion: the window orders by
 * `COALESCE(last_reconciled_at, created_at) ASC` — a FIFO queue where each
 * row's position is the last time the reconciler examined it (or its creation
 * time if never examined) — and each row's watermark is set immediately
 * BEFORE that row is examined. Rare never-terminal rows (dropped-tx
 * 'unconfirmed' forever; reverted+nonce-consumed) therefore go to the back of
 * the queue after each examination instead of permanently starving newer
 * confirmable rows of their credit. Deferral is BOUNDED for every arrival
 * pattern: a row examined at time T can only be preempted by rows whose queue
 * position predates T — a fixed, draining set — never by rows arriving after
 * T (the seal-review fix for the NULLS FIRST ordering, whose absolute
 * new-row priority let sustained inflow >= limit/run defer a watermarked
 * row's re-examination indefinitely; see the (S) resolution doc). A plain
 * `asc(lastReconciledAt)` would be WRONG here (PG ASC = NULLS LAST: every
 * never-examined row would sort last and starve). Per-row mark-BEFORE-examine
 * is load-bearing too — a row whose examination kills the whole run is
 * already watermarked (rotates out), while unexamined tail rows are not (keep
 * their place). Pinned by __tests__/reconcile-starvation.test.ts, which
 * executes the emitted query against a stateful in-memory table.
 */
export async function reconcilePendingSettlements(opts?: {
  olderThanMs?: number
  limit?: number
  overdueAfterMs?: number
  runBudgetMs?: number
}): Promise<ReconcileSummary> {
  const olderThanMs = opts?.olderThanMs ?? 5 * 60_000 // past the live settle's own confirm window
  const limit = opts?.limit ?? 25
  // (S) pending-age alert threshold. 6h = 24 cron runs: Base txs confirm in
  // seconds, so 6h pending is unambiguously anomalous, yet the threshold is
  // immune to transient RPC outages.
  const overdueAfterMs = opts?.overdueAfterMs ?? 6 * 3_600_000
  // (③) per-run examination budget — leaves headroom inside the route's 60s
  // maxDuration for the overdue aggregate + alert + summary, so they ALWAYS
  // emit even when degraded RPC makes per-row confirms slow. A single row's
  // in-flight RPC can still overrun (the engine transport is frozen spine);
  // the registered follow-up is a reconciler-specific transport timeout.
  const runBudgetMs = opts?.runBudgetMs ?? 40_000
  const cutoff = new Date(Date.now() - olderThanMs)
  const overdueCutoff = new Date(Date.now() - overdueAfterMs)
  const examinationDeadline = Date.now() + runBudgetMs

  const rows = await db
    .select({
      // (S) — id keys the per-row watermark UPDATE; createdAt feeds the
      // overdue classification.
      id: ledgerEntries.id,
      createdAt: ledgerEntries.createdAt,
      operationId: ledgerEntries.operationId,
      rail: ledgerEntries.rail,
      externalRef: ledgerEntries.externalRef,
      // F4 — needed to credit a confirmed x402 settlement (see reconcileOneRow).
      amountCents: ledgerEntries.amountCents,
      accountId: ledgerEntries.accountId,
      metadata: ledgerEntries.metadata,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.settlementStatus, 'pending'),
        inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS]),
        // Only rows with a broadcast tx to confirm. EXCLUDING null-external_ref
        // rows is also an anti-starvation guard: the live circle-nano path
        // legitimately leaves rows pending with NO external_ref (submit-error /
        // insufficient-balance / nonce-already-used) — those are the settle
        // path's to retry, not ours, and including them would let the oldest
        // permanently-unconfirmable rows re-occupy the bounded batch every run.
        isNotNull(ledgerEntries.externalRef),
        lt(ledgerEntries.createdAt, cutoff),
      ),
    )
    // (S) rotation ordering — see the function doc. Raw sql (no drizzle
    // helper composes COALESCE in ORDER BY); createdAt tiebreaks equal keys.
    .orderBy(
      sql`COALESCE(${ledgerEntries.lastReconciledAt}, ${ledgerEntries.createdAt}) ASC`,
      asc(ledgerEntries.createdAt),
    )
    .limit(limit)

  const outcomes = emptyOutcomes()
  let errored = 0
  let watermarkFailures = 0
  // (S) seal fix S10/S13 — identify WHICH rows lost their rotation slot and
  // carry the last underlying error (bounded by `limit`, so <= 25 entries).
  const watermarkFailedOps: Array<string | null> = []
  let lastWatermarkErr: unknown
  // (S) classified tallies of THIS run's examined-and-still-stuck OVERDUE rows
  // (feeds the pending-age alert; item 4 — sticky classes named, never lumped).
  // Terminal outcomes (settled/failed and both noops) resolved — not stuck.
  const examinedOverdue = { nonceConsumed: 0, unconfirmed: 0, unparseable: 0, unsupported: 0, errored: 0 }
  const OVERDUE_CLASS: Partial<Record<ReconcileOutcome, keyof typeof examinedOverdue>> = {
    'pending-nonce-consumed': 'nonceConsumed',
    'pending-unconfirmed': 'unconfirmed',
    'skipped-unparseable': 'unparseable',
    'skipped-unsupported': 'unsupported',
  }
  let deferred = 0
  for (const [i, row] of rows.entries()) {
    // (③) budget check BEFORE the watermark, so deferred rows keep their
    // queue position (mark-before-examine semantics preserved).
    if (Date.now() >= examinationDeadline) {
      deferred = rows.length - i
      break
    }
    // (S) rotation watermark — PER-ROW, immediately BEFORE examination (see
    // the function doc for why this exact timing is load-bearing). Touches
    // ONLY the watermark column, so it can never race the WHERE-pending flips
    // into a wrong state; setting it on a concurrently-flipped row is harmless.
    try {
      await db
        .update(ledgerEntries)
        .set({ lastReconciledAt: new Date() })
        .where(eq(ledgerEntries.id, row.id))
    } catch (err) {
      // Rotation degrades for THIS row this run only; examination proceeds.
      watermarkFailures++
      watermarkFailedOps.push(row.operationId)
      lastWatermarkErr = err
    }
    const isOverdue = row.createdAt < overdueCutoff
    try {
      const outcome = await reconcileOneRow(row)
      outcomes[outcome]++
      const overdueClass = OVERDUE_CLASS[outcome]
      if (isOverdue && overdueClass) examinedOverdue[overdueClass]++
    } catch (err) {
      // One bad row must not abort the batch; leave it pending (re-examined
      // after one rotation — it was already watermarked above).
      errored++
      if (isOverdue) examinedOverdue.errored++
      logger.error('reconcile.row_error', { operationId: row.operationId, rail: row.rail }, err)
    }
  }
  if (watermarkFailures > 0) {
    logger.error(
      'reconcile.watermark_update_failed',
      { count: watermarkFailures, operationIds: watermarkFailedOps },
      lastWatermarkErr,
    )
  }

  // (S) pending-age alert — ONE structured error line per run while the
  // condition persists (the settlement.credit_failed posture; never per-row).
  // Deliberately NO isNotNull(external_ref) here: every genuinely-overdue
  // pending row is alerted and classified — null-external_ref rows are the
  // settle path's to retry (outside the window BY DESIGN) and surface as
  // noTxhashCount, not silently hidden. Driver types: count() comes back as a
  // STRING from postgres-js; min(timestamptz) may come back as a string OR a
  // Date depending on driver parsing — Number()/new Date() normalize both
  // (DC-18; the conversions are load-bearing).
  let overdue: number | null = null
  try {
    const [agg] = await db
      .select({
        total: sql<string>`count(*)`,
        noTxhash: sql<string>`count(*) filter (where ${ledgerEntries.externalRef} is null)`,
        oldestCreatedAt: sql<string | Date | null>`min(${ledgerEntries.createdAt})`,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.settlementStatus, 'pending'),
          inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS]),
          lt(ledgerEntries.createdAt, overdueCutoff),
        ),
      )
    overdue = Number(agg.total)
    if (overdue > 0) {
      logger.error('reconcile.pending_overdue', {
        overdueCount: overdue,
        noTxhashCount: Number(agg.noTxhash),
        oldestPendingAgeMs:
          agg.oldestCreatedAt !== null
            ? Date.now() - new Date(agg.oldestCreatedAt).getTime()
            : null,
        overdueAfterMs,
        examinedThisRun: examinedOverdue,
      })
    }
  } catch (err) {
    // The alert is best-effort: its failure must never abort the run. The
    // classification already computed from THIS run's window still surfaces
    // here (seal fix S11) so the aggregate failing doesn't blind the operator.
    logger.error('reconcile.overdue_check_failed', { examinedThisRun: examinedOverdue }, err)
  }

  return {
    scanned: rows.length,
    settled: outcomes.settled,
    failed: outcomes.failed,
    pending: outcomes['pending-unconfirmed'] + outcomes['pending-nonce-consumed'],
    skipped:
      outcomes['skipped-no-txhash'] +
      outcomes['skipped-unparseable'] +
      outcomes['skipped-unsupported'],
    noop: outcomes['settled-noop'] + outcomes['failed-noop'],
    errored,
    deferred,
    overdue,
    outcomes,
  }
}
