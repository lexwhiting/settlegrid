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

/** Rails that settle on-chain (broadcast→confirm) and so can be reconciled by txHash. */
const RECONCILABLE_RAILS = ['circle-nano', 'x402'] as const

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
      // F4: an async-confirmed settlement was NOT billed in-request (the proxy
      // returned 'pending', skipping forwardAndBill), so the dev is still
      // uncredited despite USDC collected. Credit EXACTLY ONCE — only the actor
      // that flips the row (flipped===true, guarded WHERE settlement_status=
      // 'pending') credits it, the same invariant the live proxy path uses, so
      // the two can never both credit. x402-scoped — see the helper.
      if (flipped && rail === 'x402') {
        await creditReconciledX402Settlement(row)
      }
      return 'settled'
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
      return 'failed'
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
 * F4 — credit the developer balance + tool revenue for an x402 settlement the
 * reconciler just confirmed (flipped pending→settled). The live proxy path
 * credits via forwardAndBill ONLY when it reaches a 'settled' outcome in-request;
 * a broadcast-then-timeout settle this reconciler later confirms skipped that,
 * leaving USDC collected but the dev uncredited (the F4 finding). Mirrors
 * forwardAndBill's credit (developers.balanceCents + tools.totalRevenueCents),
 * atomic across the two updates.
 *
 * Exactly-once: the caller gates on flipped===true (the WHERE pending guard), so
 * the single actor that flips the row credits it — never both the live path AND
 * the reconciler.
 *
 * Delivery: the buyer's original request returned 'pending' (NOT delivered).
 * Delivery is available via an idempotent retry — F1 forwards a now-settled
 * replay WITHOUT re-charging. If the buyer never retries, the on-chain payment is
 * final (F3 settle-final tradeoff); we do NOT auto-refund (a new irreversible
 * money path needs its own audit).
 *
 * x402-scoped deliberately: circle-nano shares this reconciler but stores no
 * toolId in its pending rows and its F4 credit is deferred to its own
 * mainnet-cutover re-review (handoff §9); crediting it here would be incomplete
 * + unaudited.
 *
 * Residual (accepted, alertable): the flip is already committed when we credit,
 * so a DB error here leaves THIS row's dev uncredited (the row is now 'settled',
 * so a later run won't re-select it). Same non-atomicity the live path has
 * (forwardAndBill credits after the orchestrator flip). reconcile.x402_credit_failed
 * is the operator signal to credit manually (keyed by operationId + txHash).
 */
async function creditReconciledX402Settlement(row: ReconcilableRow): Promise<void> {
  const developerId = row.accountId
  const amountCents = row.amountCents
  if (!developerId || typeof amountCents !== 'number' || amountCents <= 0) {
    // No data to credit (a pre-F4 row, or a non-positive amount). The dev balance
    // is the payout source of truth — flag loudly rather than silently lose it.
    logger.error('reconcile.x402_credit_skipped_no_data', {
      operationId: row.operationId,
      hasDeveloperId: !!developerId,
      amountCents: amountCents ?? null,
    })
    return
  }
  const rawToolId =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>).toolId
      : undefined
  const toolId = typeof rawToolId === 'string' && rawToolId.length > 0 ? rawToolId : null

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(developers)
        .set({ balanceCents: sql`${developers.balanceCents} + ${amountCents}`, updatedAt: new Date() })
        .where(eq(developers.id, developerId))
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
      logger.error('reconcile.x402_credit_missing_toolid', { operationId: row.operationId, developerId, amountCents })
    }
    logger.info('reconcile.x402_credited', { operationId: row.operationId, developerId, amountCents, toolId })
  } catch (err) {
    logger.error('reconcile.x402_credit_failed', { operationId: row.operationId, developerId, amountCents }, err)
  }
}

export interface ReconcileSummary {
  scanned: number
  settled: number
  failed: number
  pending: number
  skipped: number
  outcomes: Record<ReconcileOutcome, number>
}

function emptyOutcomes(): Record<ReconcileOutcome, number> {
  return {
    settled: 0,
    failed: 0,
    'pending-unconfirmed': 0,
    'pending-nonce-consumed': 0,
    'skipped-no-txhash': 0,
    'skipped-unparseable': 0,
    'skipped-unsupported': 0,
  }
}

/**
 * Find stuck 'pending' on-chain-rail settlement rows older than `olderThanMs`
 * and reconcile up to `limit` of them, oldest first. Bounded per run; a large
 * backlog clears over successive runs (the immediate, non-blocking confirm means
 * one stuck tx never starves the batch).
 */
export async function reconcilePendingSettlements(opts?: {
  olderThanMs?: number
  limit?: number
}): Promise<ReconcileSummary> {
  const olderThanMs = opts?.olderThanMs ?? 5 * 60_000 // past the live settle's own confirm window
  const limit = opts?.limit ?? 25
  const cutoff = new Date(Date.now() - olderThanMs)

  const rows = await db
    .select({
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
    .orderBy(asc(ledgerEntries.createdAt))
    .limit(limit)

  const outcomes = emptyOutcomes()
  for (const row of rows) {
    try {
      outcomes[await reconcileOneRow(row)]++
    } catch (err) {
      // One bad row must not abort the batch; leave it pending, retry next run.
      logger.error('reconcile.row_error', { operationId: row.operationId, rail: row.rail }, err)
    }
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
    outcomes,
  }
}
