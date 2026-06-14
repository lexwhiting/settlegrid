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
import { and, eq, inArray, lt, asc, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Hex } from 'viem'
import { db } from '@/lib/db'
import { ledgerEntries, developers, tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import {
  markSettlementSettled,
  markSettlementFailed,
  markSettlementExpiredNoBroadcast,
  findSettlementRow,
} from './ledger'
import {
  confirmSettlementTx,
  readAuthorizationStateBounded,
  readSafeBlockTimestampBounded,
} from './circle-nano/settle-engine'
// (V) — the expiry pass's network gate. CANONICAL (== keys(SUPPORTED_CHAINS), pinned by
// x402-networks.test.ts), NOT USDC_ADDRESSES (a strict superset containing eip155:1 —
// rows on a non-canonical network are UNDECIDABLE by the bounded readers and would loop
// 'unknown' forever without the step-1 quarantine arm).
import { isCanonicalX402Network } from './x402/networks'
// Single source of truth shared with the (H) hop rail-enum guard (rails.ts) so the
// reconciler's selection set and the guard's exclusion set can never drift.
// (T) — isReconcilableRail replaces the credit gate's hardcoded rail pair (P3).
import { RECONCILABLE_RAILS, isReconcilableRail } from './rails'
// (T) — the F2 mainnet pin, the SAME env-pinned predicates the proxy handlers and
// the kernel /settle route use. The reconciler was the ONLY credit-capable
// surface without it (register P3).
import { X402_MAINNET_NETWORK, isX402TestnetSettlementAllowed } from '@/lib/env'

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
  /**
   * (T) — the failed-flip CAS rejected a STALE external_ref: the row was
   * re-pointed (a live-path resubmit via markSettlementBroadcast) after this
   * run's batch SELECT read it, so the revert evidence this run confirmed
   * belongs to a superseded tx. The row REMAINS pending and re-examines next
   * rotation with a fresh ref (pending-* semantics — no transition occurred).
   */
  | 'pending-stale-ref'
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
      if (!flipped) {
        // (V) P8-c — name the divergent-receipt-views case instead of lumping it
        // into settled-noop silence: a settled-noop onto a terminally FAILED row
        // means THIS actor holds a SUCCESS receipt for a tx the ledger recorded
        // as failed (the reconciler-side twin of the live path's (T) ② mirror
        // alert — same key, same runbook §3 repair+credit path). The tally
        // stays settled-noop (the ②-pinned summary identity is unchanged).
        const current = await findSettlementRow(operationId, rail)
        if (current && current.settlementStatus === 'failed') {
          logger.error('settlement.settled_evidence_on_terminal_failed_row', {
            operationId,
            rowStatus: current.settlementStatus,
            winningTxHash: confirmation.txHash,
            storedRef: current.externalRef,
          })
        }
      }
      // F4: an async-confirmed settlement was NOT billed in-request (a settle that
      // broadcast then timed out/crashed returned 'pending', skipping the in-request
      // credit), so the dev is still uncredited despite USDC collected. Credit
      // EXACTLY ONCE — only the actor that flips the row (flipped===true, guarded
      // WHERE settlement_status='pending') credits it, the same invariant the live
      // settle paths use, so they can never both credit. Both on-chain rails
      // (x402 + circle-nano) now store the data to credit in metadata.toolId.
      // (T) P3 — RECONCILABLE_RAILS replaces the hardcoded rail pair (single
      // source of truth; behavior-identical today) and the credit gains the F2
      // mainnet pin (parity with handleX402Proxy / handleCircleNanoProxy / the
      // kernel /settle route — this was the ONLY credit-capable surface
      // without it). The pin gates the CREDIT only, never the flip: a testnet
      // row settled on its own chain is honest bookkeeping, and blocking the
      // flip would mint an immortal pending row (DC-09). A blocked credit
      // leaves the row unmarked, so the uncredited sweep enumerates it — a
      // Sepolia row in a prod DB is a real open incident. Latent in prod
      // today (the (G) allowlist already rejects non-Base admission).
      if (flipped && isReconcilableRail(rail)) {
        if (parsed.network !== X402_MAINNET_NETWORK && !isX402TestnetSettlementAllowed()) {
          logger.error('reconcile.credit_blocked_testnet', {
            operationId,
            rail,
            network: parsed.network,
          })
        } else {
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
            rail,
          })
        }
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
      if (!flipped) {
        // (T) — disambiguate the two flipped:false meanings: a concurrent
        // terminal winner (the (S) noop class) vs the CAS rejecting a STALE
        // external_ref (the row was re-pointed after this run's SELECT — the
        // P2 race, now closed). A still-pending row keeps its place in the
        // rotation and re-examines with a fresh ref next run.
        const current = await findSettlementRow(operationId, rail)
        if (current?.settlementStatus === 'pending') {
          logger.warn('reconcile.failed_flip_stale_ref', {
            operationId,
            rail,
            staleTxHash: confirmation.txHash,
            currentRef: current.externalRef,
          })
          return 'pending-stale-ref'
        }
      }
      logger.warn('reconcile.failed', { operationId, rail, txHash: confirmation.txHash, flipped })
      return flipped ? 'failed' : 'failed-noop'
    }
    case 'unconfirmed':
      // Still in mempool / dropped / RPC blip — leave pending, retry next run.
      // (U): reason distinguishes the LB-2 incomplete-revert-evidence case
      // (revert-nonce-unverifiable) from plain receipt-unavailable.
      logger.info('reconcile.unconfirmed', {
        operationId,
        rail,
        txHash: confirmation.txHash,
        reason: confirmation.reason ?? 'receipt-unavailable',
      })
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
 * (T) credited_at marker — written INSIDE the same transaction as the credit:
 * the marker commits iff the developer-balance credit commits. A settled
 * reconcilable-rail row left unmarked (this txn never ran — the P1 process-kill
 * window; or it rolled back — credit_failed) is enumerated by the uncredited
 * sweep every run until resolved: the silent-lost-credit class is now
 * detectable. A marker UPDATE matching zero rows logs
 * settlement.credit_marker_unmatched and NEVER throws — throwing would roll
 * back a REAL credit to save an accounting marker (the inverted defect); an
 * unmarked-but-credited row merely pages until the operator closes it.
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
  /** (T) — the settlement row's rail; keys the credited_at marker UPDATE. */
  rail: string
}): Promise<void> {
  const { developerId, toolId, amountCents, operationId, rail } = params
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
    let marked = 0
    let toolStatUnmatched = false
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
        const toolRows = await tx
          .update(tools)
          .set({ totalRevenueCents: sql`${tools.totalRevenueCents} + ${amountCents}`, updatedAt: new Date() })
          .where(eq(tools.id, toolId))
          .returning({ id: tools.id })
        if (toolRows.length === 0) {
          // (V) C4 rider — a dangling toolId silently skipped the per-tool stat.
          // FLAG, never throw: a throw would roll back the REAL developer credit
          // to save an accounting stat (the inverted defect — the credited_at
          // marker doc's own rule). ② seal S4: the alert itself is emitted
          // AFTER the transaction commits — a later rollback (e.g. the marker
          // write failing) must not leave an alert standing for a credit that
          // never landed (credit_failed is that path's truthful signal).
          toolStatUnmatched = true
        }
      }
      // (T) — the credit marker, same transaction (see the function doc). The
      // isNull guard makes a hypothetical double-call inert on the marker.
      if (operationId) {
        const rows = await tx
          .update(ledgerEntries)
          .set({ creditedAt: new Date() })
          .where(
            and(
              eq(ledgerEntries.operationId, operationId),
              eq(ledgerEntries.rail, rail),
              eq(ledgerEntries.settlementStatus, 'settled'),
              isNull(ledgerEntries.creditedAt),
            ),
          )
          .returning({ id: ledgerEntries.id })
        marked = rows.length
      }
    })
    if (toolStatUnmatched) {
      // (V) C4 rider, post-commit (② seal S4): the credit IS committed; only
      // the per-tool revenue stat found no row. Alert so it can be reconciled.
      logger.error('settlement.credit_tool_stat_unmatched', { operationId, toolId })
    }
    if (marked === 0) {
      // Anomaly, not a loss: the credit committed but no settled row matched
      // the marker key (null operationId, or a row in an unexpected state).
      // Logged — never thrown (see the function doc).
      logger.error('settlement.credit_marker_unmatched', { operationId, rail, developerId })
    }
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

// ─── (V) P5-ii — the EXPIRY PASS ─────────────────────────────────────────────
// Never-broadcast (external_ref NULL) pending rows are invisible to the
// examination window (isNotNull BY DESIGN — they have no tx to confirm) and
// nothing ever terminalized them: permanent pending_overdue inventory, alarm
// fatigue on the one alert guarding the credit tail. The pass terminalizes a
// row ONLY on the CONJUNCTIVE, CHAIN-ANCHORED proof that its authorization is
// dead, and quarantine-classifies everything it cannot prove:
//   1. opid unparseable / non-canonical network → quarantine (undecidable).
//   2. no stored validBefore (legacy pre-(V) row) → quarantine — NEVER guess
//      (the original bound is unknowable; a minted one cannot cover it).
//   2.5 malformed stored value → quarantine (NaN/zero coercions otherwise
//      fall INTO the expired arm — every comparison must see a canonical int).
//   3. wall-clock pre-filter: now ≤ vb + margin → skip (cheap, NOT the proof).
//   3.5 CHAIN-TIME anchor: safe-head timestamp must EXCEED vb — consensus
//      timestamps strictly increase and USDC mines only block.timestamp < vb,
//      so an observed safeTs > vb means NO future block can consume the nonce
//      (wall-expiry alone is FALSE proof: sequencer-stall catch-up blocks mine
//      queued txs with past timestamps). Read failure → stay pending.
//   4. authorizationState NOW: 'unconsumed' ⇒ terminalize via the evidence-CAS
//      writer (re-proves against the exact bound read at 1); 'consumed' ⇒ THE
//      DETECTION WIN — funds may have moved via an untracked tx (the P8(b)
//      window's first detector) OR the payer canceled (cancelAuthorization
//      also consumes) — quarantine + alert, NEVER 'failed'; 'unknown' ⇒ stay
//      pending (the LB-2 rule: incomplete evidence never terminalizes).
// Quarantined rows stay 'pending' (the status CHECK is frozen; quarantine is a
// metadata class), drop out of the candidate SELECT (anti-starvation), and
// remain visible via pending_overdue/noTxhashCount.
const EXPIRY_MARGIN_SECONDS = 300
const EXPIRY_PASS_LIMIT = 3
const EXPIRY_PASS_BUDGET_MS = 14_000

const CANONICAL_VB = /^\d+$/

interface ExpiryPassStats {
  examined: number
  terminalized: number
  quarantined: number
  unknown: number
}

/** Quarantine-classify: a COALESCE-wrapped jsonb merge (a bare `metadata ||`
 * is NULL-strict in PG and would silently no-op the NULL-metadata legacy-hop
 * class forever — the row would re-enter the LIMIT-3 SELECT every run). The
 * row STAYS 'pending'; the class drops it from the candidate SELECT.
 *
 * ② seal S1 — the truth CAS: the pass's entire predicate domain is ref-NULL
 * rows, so the WHERE carries isNull(external_ref) and the rowcount gates every
 * downstream alert/tally. A row that acquired a LIVE ref mid-pass (a buyer
 * re-sign's onBroadcast committing between the candidate SELECT and this
 * write) matches 0 rows — classifying it would brand a TRACKED tx with the
 * P8(b) 'untracked' class and false-fire the one alert guarding real untracked
 * losses (DC-18). Returns whether the classification actually committed. */
async function quarantineClassify(
  rowId: string,
  operationId: string | null,
  rail: string | null,
  expiryClass: 'unparseable' | 'unsupported-network' | 'legacy-no-validbefore' | 'nonce-consumed-untracked',
): Promise<boolean> {
  const updated = await db
    .update(ledgerEntries)
    .set({
      metadata: sql`COALESCE(${ledgerEntries.metadata}, '{}'::jsonb) || jsonb_build_object('expiryClass', ${expiryClass}::text, 'expiryClassifiedAt', ${new Date().toISOString()}::text)`,
    })
    .where(
      and(
        eq(ledgerEntries.id, rowId),
        eq(ledgerEntries.settlementStatus, 'pending'),
        isNull(ledgerEntries.externalRef),
      ),
    )
    .returning({ id: ledgerEntries.id })
  const classified = updated.length > 0
  if (classified && expiryClass !== 'nonce-consumed-untracked') {
    // One-shot (the class exclusion stops re-selection): the row's expiry is
    // UNPROVABLE — operator/runbook resolves. error level: Sentry mirrors
    // error only (the (U) ② M1 lesson). Gated on the rowcount so a row the
    // truth CAS rejected never alerts (it is live-tracked, not unprovable).
    logger.error('reconcile.expiry_unprovable', { operationId, rail, expiryClass })
  }
  return classified
}

/** The bounded expiry pass. Its OWN try/catch (a failure must never starve the
 * window loop or the summary); per-candidate deadline checks BEFORE the
 * watermark (a stopped candidate keeps its queue position) plus a MID-candidate
 * re-check between the chain and nonce reads (two bounded reads can otherwise
 * stack past the sub-budget). Candidates rotate via the same
 * mark-before-examine watermark as the window — the two row sets are disjoint
 * BY the window's isNotNull(externalRef). */
async function runExpiryPass(opts: {
  cutoff: Date
  examinationDeadline: number
}): Promise<ExpiryPassStats> {
  const stats: ExpiryPassStats = { examined: 0, terminalized: 0, quarantined: 0, unknown: 0 }
  const passDeadline = Date.now() + EXPIRY_PASS_BUDGET_MS
  const deadline = Math.min(passDeadline, opts.examinationDeadline)
  try {
    // Issued UNCONDITIONALLY (only per-candidate work checks deadlines).
    const candidates = await db
      .select({
        id: ledgerEntries.id,
        createdAt: ledgerEntries.createdAt,
        operationId: ledgerEntries.operationId,
        rail: ledgerEntries.rail,
        externalRef: ledgerEntries.externalRef,
        metadata: ledgerEntries.metadata,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.settlementStatus, 'pending'),
          inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS]),
          isNull(ledgerEntries.externalRef),
          lt(ledgerEntries.createdAt, opts.cutoff),
          sql`(${ledgerEntries.metadata}->>'expiryClass') IS NULL`,
        ),
      )
      .orderBy(
        sql`COALESCE(${ledgerEntries.lastReconciledAt}, ${ledgerEntries.createdAt}) ASC`,
        asc(ledgerEntries.createdAt),
      )
      .limit(EXPIRY_PASS_LIMIT)

    // ONE safe-head read per network per pass (cached) — the timestamp AND the
    // block number N it was read at, so the nonce read pins to that same N (V-N4).
    const chainTsByNetwork = new Map<string, { ts: number; blockNumber: bigint } | null>()

    for (const row of candidates) {
      if (Date.now() >= deadline) break
      // mark-before-examine (the (S) rotation discipline — a candidate whose
      // examination kills the pass is already watermarked and rotates out).
      try {
        await db.update(ledgerEntries).set({ lastReconciledAt: new Date() }).where(eq(ledgerEntries.id, row.id))
      } catch {
        /* rotation degrades for this row this pass only */
      }
      stats.examined++

      // 1 — decidability gates (no RPC behind either arm). ② seal S1/S3: the
      // quarantined tally counts only COMMITTED classifications (the truth-CAS
      // rowcount) — never an attempt the row outran or a write that failed.
      const parsed = row.operationId && row.rail ? parseSettlementOperationId(row.operationId, row.rail) : null
      if (!parsed) {
        if (await quarantineClassify(row.id, row.operationId, row.rail, 'unparseable')) stats.quarantined++
        continue
      }
      if (!isCanonicalX402Network(parsed.network) || !parsed.eip3009) {
        if (await quarantineClassify(row.id, row.operationId, row.rail, 'unsupported-network')) stats.quarantined++
        continue
      }

      // 2 — the legacy arm: never guess an unknowable bound.
      const meta = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : null
      const vbRaw = meta?.validBefore
      if (vbRaw === undefined || vbRaw === null) {
        if (await quarantineClassify(row.id, row.operationId, row.rail, 'legacy-no-validbefore')) stats.quarantined++
        continue
      }
      // 2.5 — the canonical-integer guard (R1-B2): Number('')===0 and
      // Number('abc')===NaN both otherwise fall into the expired arm.
      if (typeof vbRaw !== 'string' || !CANONICAL_VB.test(vbRaw) || !Number.isFinite(Number(vbRaw)) || Number(vbRaw) <= 0) {
        if (await quarantineClassify(row.id, row.operationId, row.rail, 'unparseable')) stats.quarantined++
        continue
      }
      const vb = Number(vbRaw)

      // 3 — wall-clock pre-filter (cheap; NOT the proof).
      if (Math.floor(Date.now() / 1000) <= vb + EXPIRY_MARGIN_SECONDS) continue

      // 3.5 — the chain-time anchor (the actual proof of expiry).
      if (!chainTsByNetwork.has(parsed.network)) {
        chainTsByNetwork.set(parsed.network, await readSafeBlockTimestampBounded(parsed.network))
      }
      const chainTs = chainTsByNetwork.get(parsed.network) ?? null
      if (chainTs === null) {
        stats.unknown++
        continue
      }
      if (chainTs.ts <= vb) continue // wall-expired but NOT chain-expired — not provably dead

      // mid-candidate deadline re-check: the chain read may have consumed the
      // budget; never start a second bounded read past the deadline.
      if (Date.now() >= deadline) break

      // 4 — nonce state AS OF the safe block N (chainTs.blockNumber) whose
      // timestamp proved expiry at 3.5 — PINNED so the read is deterministic
      // w.r.t. that anchor across replicas (V-N4; an unpinned 'latest' can lag
      // N and mis-read a consumed nonce). No future block can validly
      // TRANSFER-consume past N (USDC time-gates the value-moving consume on
      // block.timestamp < validBefore and chainTs(N) > vb), so reading at N
      // captures every consume that moved USDC. A cancelAuthorization is NOT
      // time-gated and may consume post-N, but moves no money — terminalizing a
      // chain-expired row stays correct either way (pre-N cancel → 'consumed' →
      // quarantine; see the attributive wording below).
      const nonceState = await readAuthorizationStateBounded(parsed.network, parsed.eip3009.from, parsed.eip3009.nonce, chainTs.blockNumber)
      if (nonceState === 'unknown') {
        stats.unknown++ // the LB-2 rule: incomplete evidence — stay pending
        continue
      }
      if (nonceState === 'consumed') {
        // THE DETECTION WIN — the P8(b) window's first detector. Attributive
        // wording: funds may have moved via an untracked tx OR the payer
        // canceled (EIP-3009 cancelAuthorization also consumes the nonce);
        // the runbook attributes via (from,nonce) on-chain. NEVER 'failed'.
        // ② seal S1 — truth-gated on the classify rowcount: a row that acquired
        // a LIVE ref between the candidate SELECT and this write (a buyer
        // re-sign that broadcast and MINED during the pass's bounded reads) is
        // consumed-but-TRACKED — the live path settles it normally; firing the
        // 'untracked' alert for it would be a false page on the one alert
        // guarding real P8(b) losses.
        if (await quarantineClassify(row.id, row.operationId, row.rail, 'nonce-consumed-untracked')) {
          stats.quarantined++
          logger.error('reconcile.expired_nonce_consumed_quarantined', {
            operationId: row.operationId,
            rail: row.rail,
            from: parsed.eip3009.from,
            nonce: parsed.eip3009.nonce,
            validBefore: vbRaw,
          })
        }
        continue
      }
      // chain-expired AND unconsumed-now ⇒ unconsumed-forever: terminalize via
      // the evidence-CAS writer (CASes on the exact bound read above — a
      // concurrently-raised bound or acquired ref ⇒ 0 rows ⇒ re-proven next run).
      const flipped = await markSettlementExpiredNoBroadcast(row.operationId as string, row.rail as string, vbRaw, {
        chainTs: chainTs.ts, // the SCALAR — the evidence shape stays { chainTs:number, checkedAt } (V-N4: do NOT embed the {ts,blockNumber} object)
        checkedAt: new Date().toISOString(),
      })
      if (flipped) {
        stats.terminalized++
        logger.info('reconcile.expired_terminalized', {
          operationId: row.operationId,
          rail: row.rail,
          validBefore: vbRaw,
          chainTs: chainTs.ts, // scalar (V-N4)
          ageMs: row.createdAt ? Date.now() - new Date(row.createdAt as unknown as string | Date).getTime() : null,
        })
      }
      // flipped === false: the row acquired a ref/terminal state or a raised
      // bound concurrently — do nothing; the next run re-proves.
    }
  } catch (err) {
    // The pass is best-effort: its failure must never abort the run (detector
    // posture parity) — the window loop and summary proceed.
    logger.error('reconcile.expiry_pass_failed', {}, err)
  }
  if (stats.examined > 0) {
    // (V-N4 / DC-18) — the pin-degradation backstop. Pinning the nonce read to
    // block N (V-N4) can raise the 'unknown' rate when the RPC cannot serve N's
    // state (a pruning full node, or — the precise risk the pin targets — a
    // lagging backend whose tip < N). A pass that examined ≥1 candidate yet
    // terminalized AND quarantined NOTHING while ≥1 nonce read came back
    // 'unknown' is that degradation signature. Page on the SAME run: without
    // this, a total terminalization stall is visible only INDIRECTLY up to 6h
    // later via pending_overdue — the very alarm (V) de-fatigued.
    if (stats.terminalized === 0 && stats.quarantined === 0 && stats.unknown > 0) {
      logger.error('reconcile.expiry_anchor_degraded', { ...stats })
    }
    // Truthful pass telemetry (info — a feed, not a page): a persistently
    // failing anchor/nonce read shows up as unknown===examined run after run
    // (the runbook's anchor-degradation cue).
    logger.info('reconcile.expiry_pass', { ...stats })
  }
  return stats
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
   * examined first next run. (U): the detectors (overdue aggregate + uncredited
   * sweep) now emit BEFORE the examination loop and the reconciler's confirm
   * transport is bounded (RECONCILER_RPC_* in settle-engine.ts — worst
   * ~12.3s/row vs the old unbounded ~10s × 3 retries per call), so the budget
   * now protects the SUMMARY's headroom rather than detector delivery.
   */
  deferred: number
  /**
   * (S) pending-age alert count: pending rows on reconcilable rails older
   * than `overdueAfterMs` at run time (INCLUDING null-external_ref rows the
   * window deliberately excludes — they are classified, not hidden).
   * null ⇒ the overdue check itself failed (reconcile.overdue_check_failed).
   */
  overdue: number | null
  /**
   * (T) uncredited-row sweep count: SETTLED reconcilable-rail rows older than
   * `creditGraceMs` whose credited_at marker was never committed — each is an
   * OPEN credit-resolution incident (a silent flip→credit process-kill loss,
   * an F3 upstream-fail no-credit, a credit_failed rollback, or a pin-blocked
   * testnet credit). Alerted via reconcile.uncredited_settled, ONE structured
   * error line per run while any persist (no de-dup BY DESIGN — incidents
   * page until the operator closes them via the runbook UPDATE).
   * null ⇒ the sweep itself failed (reconcile.uncredited_check_failed).
   */
  uncredited: number | null
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
    'pending-stale-ref': 0,
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
  /** (T) uncredited-sweep grace window (default 60min) — see the sweep block. */
  creditGraceMs?: number
}): Promise<ReconcileSummary> {
  const olderThanMs = opts?.olderThanMs ?? 5 * 60_000 // past the live settle's own confirm window
  const limit = opts?.limit ?? 25
  // (S) pending-age alert threshold. 6h = 24 cron runs: Base txs confirm in
  // seconds, so 6h pending is unambiguously anomalous, yet the threshold is
  // immune to transient RPC outages.
  const overdueAfterMs = opts?.overdueAfterMs ?? 6 * 3_600_000
  // (③) per-run examination budget — bounds the loop so the SUMMARY keeps
  // headroom inside the route's 60s maxDuration. (U): the detectors (sweep +
  // overdue) no longer depend on it at all — they emit BEFORE the loop — and
  // the reconciler's confirm transport is bounded (RECONCILER_RPC_* — worst
  // ~12.3s/row nominal; adversarial RPC shapes can exceed it, see the ③
  // caveat on the constants). The detectors are safe either way.
  const runBudgetMs = opts?.runBudgetMs ?? 40_000
  const cutoff = new Date(Date.now() - olderThanMs)
  const overdueCutoff = new Date(Date.now() - overdueAfterMs)
  const examinationDeadline = Date.now() + runBudgetMs

  // ─── (U) DETECTORS-FIRST ─────────────────────────────────────────────────
  // The run's two P1 detectors emit BEFORE the window SELECT and the
  // examination loop: emission happens-before every RPC call and every loop DB
  // write, so no single degraded RPC call (nor the loop itself) can starve
  // them — the P4 ③-escalation's bar. The aggregates report the PRE-run
  // "standing incidents" state (the more honest reading, per the register
  // escalation note). The sweep runs FIRST — it is the P1 silent-loss
  // detector; a kill between the two queries loses the lesser signal. Each
  // block keeps its own best-effort try/catch: a detector's own failure logs
  // *_check_failed and never aborts the run. Pinned by
  // __tests__/reconcile-detector-availability.test.ts.

  // (T) — uncredited-row sweep: enumerate SETTLED reconcilable-rail rows whose
  // credited_at marker never committed. Every credit writer marks in the SAME
  // transaction as the developer-balance credit, so a NULL marker past the
  // grace window is an OPEN credit-resolution incident: the silent P1
  // flip→credit process-kill loss (previously invisible — no log, terminal
  // row never re-selected), an F3 settled-but-upstream-failed no-credit, a
  // credit_failed rollback, or a pin-blocked testnet credit. The grace window
  // absorbs in-flight credits (the proxy credits AFTER its upstream fetch —
  // seconds to ~30s; 60min is unambiguous). One structured error line per run
  // while any persist (the pending_overdue posture; closure = the runbook
  // UPDATE). Best-effort: failure logs and never aborts the run. postgres-js
  // returns count(*) as a STRING (DC-18 — Number() is load-bearing).
  const creditGraceMs = opts?.creditGraceMs ?? 60 * 60_000
  let uncredited: number | null = null
  try {
    const graceCutoff = new Date(Date.now() - creditGraceMs)
    const sweepWhere = and(
      eq(ledgerEntries.settlementStatus, 'settled'),
      inArray(ledgerEntries.rail, [...RECONCILABLE_RAILS]),
      isNull(ledgerEntries.creditedAt),
      lt(ledgerEntries.settledAt, graceCutoff),
    )
    const [agg] = await db
      .select({ total: sql<string>`count(*)` })
      .from(ledgerEntries)
      .where(sweepWhere)
    uncredited = Number(agg.total)
    if (uncredited > 0) {
      // Bounded id sample (≤ 25, oldest first) — operation_id is already
      // rail-prefixed by construction, so the bare ids match the runbook's
      // closure UPDATE keys exactly.
      const sample = await db
        .select({ operationId: ledgerEntries.operationId, settledAt: ledgerEntries.settledAt })
        .from(ledgerEntries)
        .where(sweepWhere)
        .orderBy(asc(ledgerEntries.settledAt))
        .limit(25)
      logger.error('reconcile.uncredited_settled', {
        uncreditedCount: uncredited,
        graceMs: creditGraceMs,
        oldestSettledAt: sample[0]?.settledAt ?? null,
        operationIds: sample.map((s) => s.operationId),
      })
    }
  } catch (err) {
    logger.error('reconcile.uncredited_check_failed', {}, err)
  }

  // (S) pending-age alert — ONE structured error line per run while the
  // condition persists (the settlement.credit_failed posture; never per-row).
  // Deliberately NO isNotNull(external_ref) here: every genuinely-overdue
  // pending row is alerted — null-external_ref rows are the settle path's to
  // retry (outside the window BY DESIGN) and surface as noTxhashCount, not
  // silently hidden. (U): this-run examination classes surface via the
  // post-loop reconcile.overdue_examined carrier (classification can only
  // exist AFTER examination). Driver types: count() comes back as a STRING
  // from postgres-js; min(timestamptz) may come back as a string OR a Date
  // depending on driver parsing — Number()/new Date() normalize both (DC-18;
  // the conversions are load-bearing).
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
      })
    }
  } catch (err) {
    // The alert is best-effort: its failure must never abort the run. (U): the
    // run's examined-overdue classification surfaces via the post-loop
    // reconcile.overdue_examined carrier regardless of this aggregate's outcome
    // (supersedes the S11 fallback payload — pre-loop, nothing is examined yet).
    logger.error('reconcile.overdue_check_failed', {}, err)
  }

  // ─── (V) — the expiry pass: AFTER the detectors (their guarantee undiluted),
  // BEFORE the window SELECT. Its elapsed time debits the shared envelope (the
  // examinationDeadline above is computed ONCE and NOT recomputed — the
  // pass's worst ~20.15s + the loop's tail stay inside maxDuration; deferred
  // rows keep their queue position exactly as under (U)).
  await runExpiryPass({ cutoff, examinationDeadline })

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
  // (T) staleRef — LICENSED EXTENSION of the (S) alert payload (recorded in the
  // build plan Recipe 2a): without it, CAS-rejected stale-ref rows would be
  // silently unclassified in examinedThisRun — the lumping item 4 forbade.
  const examinedOverdue = { nonceConsumed: 0, unconfirmed: 0, unparseable: 0, unsupported: 0, errored: 0, staleRef: 0 }
  const OVERDUE_CLASS: Partial<Record<ReconcileOutcome, keyof typeof examinedOverdue>> = {
    'pending-nonce-consumed': 'nonceConsumed',
    'pending-unconfirmed': 'unconfirmed',
    'pending-stale-ref': 'staleRef',
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

  // (U) — the (S) item-4 classification, displaced from the pre-loop alert
  // payload by the detectors-first reorder: classification can only exist
  // AFTER examination. error level (② seal fix): the (S)-sealed classification
  // rode the error-level pending_overdue payload into the Sentry mirror
  // (logger.ts mirrors ONLY error level) — a warn carrier would silently drop
  // the sticky-class breakdown (incl. the funds-moved nonceConsumed class)
  // from the Sentry surface. NOT a new page: the armed Sentry rule filters on
  // its two message keys, which this is not — it is the preserved delivery of
  // the displaced classification, ≤1 line per run, only when this run
  // examined sticky overdue rows. Emits regardless of the aggregate's own
  // success (supersedes the S11 fallback payload).
  if (Object.values(examinedOverdue).some((n) => n > 0)) {
    logger.error('reconcile.overdue_examined', { examinedThisRun: examinedOverdue, overdueAfterMs })
  }

  return {
    scanned: rows.length,
    settled: outcomes.settled,
    failed: outcomes.failed,
    pending:
      outcomes['pending-unconfirmed'] +
      outcomes['pending-nonce-consumed'] +
      outcomes['pending-stale-ref'],
    skipped:
      outcomes['skipped-no-txhash'] +
      outcomes['skipped-unparseable'] +
      outcomes['skipped-unsupported'],
    noop: outcomes['settled-noop'] + outcomes['failed-noop'],
    errored,
    deferred,
    overdue,
    uncredited,
    outcomes,
  }
}
