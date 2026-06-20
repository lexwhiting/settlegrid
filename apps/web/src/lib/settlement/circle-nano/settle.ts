/**
 * Circle Nanopayments — settlement ORCHESTRATOR (P3.K4 A2), Layer 2.
 *
 * A2 is the FIRST circle-nano code that MOVES REAL MONEY. This layer owns the
 * stateful, funds-safety-critical orchestration around the pure on-chain engine
 * (settle-engine.ts):
 *   - idempotency (an already-'settled' row short-circuits — no re-submit);
 *   - a write-ahead 'pending' INTENT row written BEFORE we submit (so a crash
 *     post-broadcast is recoverable and the flip has a row to match);
 *   - a best-effort Redis lock per authorization (serializes concurrent settles);
 *   - re-wait recovery on a previously-broadcast tx (no double-submit on retry);
 *   - the ledger flip to the terminal state.
 *
 * Funds-safety invariants (audited):
 *   - A reverted or unconfirmed tx is NEVER recorded 'settled'.
 *   - Idempotency is keyed on (network, from, nonce) — NEVER signature bytes
 *     (EIP-3009 sigs are malleable); USDC enforces (from, nonce)-once on-chain.
 *   - 'settled' is terminal: every flip is guarded WHERE settlement_status =
 *     'pending', so a concurrent loser can't clobber a winner.
 */

import type { Hex } from 'viem'
import type { CircleNanoProof } from '@settlegrid/mcp'
import { getRedis, tryRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import {
  recordSettlementEntry,
  findSettlementRow,
  markSettlementSettled,
  markSettlementFailed,
  markSettlementBroadcast,
  refreshPendingValidBefore,
  settlementEntryId,
} from '../ledger'
import {
  submitCircleNanoOnChain,
  confirmCircleNanoTx,
  type CircleNanoOnChainResult,
} from './settle-engine'
// (V-N2) — the broadcast-seam settled-value divergence detector.
// (V-N2b) — the in-request credit-or-defer resolver (the live-credit twin of the
// reconciler tail's recorded-value credit).
import { detectSettledValueDivergence, resolveInRequestCreditCents } from '../settled-value'

const RAIL = 'circle-nano'

/**
 * Redis settle-lock TTL (s) — must exceed EVERY caller route's maxDuration so a
 * lock can't expire mid-request; released in finally. Callers: the kernel
 * /settle route (maxDuration 60) AND the proxy route (maxDuration 90) — the
 * (T) ③ deep audit caught the prior 70s value sitting BELOW the proxy's 90s,
 * which let the lock expire mid-settle under degraded RPC and re-open the
 * sibling-concurrency window the P2-mirror machinery treats as lock-rare.
 * 100 = 90 + margin. If any caller's maxDuration ever rises above 90, raise
 * this with it (preflight probe I9 in .audit/t-deep/preflight.mjs pins it).
 */
const SETTLE_LOCK_TTL_SECONDS = 100

export interface ExecuteCircleNanoSettlementParams {
  proof: CircleNanoProof
  costCents: number
  accountId: string
  toolId: string
  toolSlug: string
  method: string
  latencyMs: number
}

/**
 * Route-facing outcome.
 *   - settled → return a 'settled' SettlementResult with txHash (HTTP 200).
 *   - failed  → terminal reject; HTTP error (the payment did NOT happen).
 *   - pending → broadcast/in-progress/unconfirmed; HTTP error (NEVER claim settled);
 *               safe to retry — idempotency + on-chain nonce prevent a double-charge.
 */
export type CircleNanoSettlementOutcome =
  // `alreadySettled` marks a settled outcome this call did NOT freshly flip
  // pending→settled (an idempotent-hit or a concurrent-flip-loser) → the caller
  // must NOT credit (the flip winner already did). Mirrors x402's orchestrator.
  // `creditCents` (V-N2b, flip-winner only) — the ACTUALLY-collected value the
  // in-request credit must pay (fresh-submit = this proof's value == costCents;
  // recovery-confirm = the prior broadcast's recorded value, possibly ≠ costCents).
  // `null` ⇒ DEFER (absent/unconvertible) — credit nothing, leave credited_at NULL;
  // the uncredited-sweep enumerates + alerts the row → an operator credits it via the
  // runbook (the reconciler tail does NOT re-credit an already-settled row). Mirrors x402.
  | { status: 'settled'; txHash: string; alreadySettled?: true; creditCents?: number | null }
  | { status: 'failed'; code: string; httpStatus: number; reason: string }
  | { status: 'pending'; code: string; httpStatus: number; reason: string; txHash?: string }

/** The stable per-authorization key A1 writes into the `operation_id` column. */
export function circleNanoOperationId(proof: CircleNanoProof): string {
  return `${RAIL}:${proof.network}:${proof.authorization.from.toLowerCase()}:${proof.authorization.nonce.toLowerCase()}`
}

function settleLockKey(operationId: string): string {
  return `circle-nano:settle:lock:${operationId}`
}

/** Write-ahead INTENT: ensure the 'pending' ledger row exists BEFORE we submit. */
async function ensurePendingRow(
  params: ExecuteCircleNanoSettlementParams & { operationId: string },
): Promise<void> {
  const { proof, operationId, costCents, accountId, toolId, toolSlug, method, latencyMs } = params
  // Idempotent (deterministic id from operationId + ON CONFLICT DO NOTHING): a
  // pre-existing pending row is left intact.
  await recordSettlementEntry({
    invocationId: operationId, // → operation_id column (the stable key)
    rail: RAIL,
    protocol: RAIL,
    amountCents: costCents,
    currency: 'USDC',
    takeBps: 0,
    status: 'pending',
    externalRef: null,
    accountId,
    metadata: {
      method,
      latencyMs,
      // A2: real on-chain settlement, no longer a deferred 'batched' record.
      settlementType: 'real-time',
      network: proof.network,
      payer: proof.authorization.from,
      // The owning tool — read by the reconciler tail to credit
      // tools.totalRevenueCents on an async-confirmed flip (mirrors x402's F4
      // toolId-in-metadata; JSONB, no schema migration).
      toolId,
      // Honesty: the FULL authorized value that moves on-chain (may exceed the
      // tool cost the verifier requires it to cover).
      authorizedValueBaseUnits: proof.authorization.value,
      // (V) P5-i — the expiry pass's terminalization evidence: the CANONICAL
      // decimal-seconds bound. BigInt normalizes the hex/octal forms the
      // verifier accepts — a raw hex string would brick the pass's integer
      // guard and the refresh's ::numeric cast. First-write-wins (the INSERT
      // is idempotent); re-signs raise it via refreshPendingValidBefore.
      validBefore: BigInt(proof.authorization.validBefore).toString(10),
    },
    description: `circle-nano settlement for tool ${toolSlug} (${method})`,
  })
}

/** Map an on-chain result to a ledger flip + route outcome.
 * (V) P8-e — `expectedPriorRef` is the external_ref this request READ at step 1
 * (null when none existed): threaded into every markSettlementBroadcast so a
 * lock-less loser can never clobber a DIFFERENT live ref while the same-actor
 * T1→T2 recovery re-point stays legal (the no-clobber CAS in ledger.ts). */
async function applyOutcome(
  operationId: string,
  result: CircleNanoOnChainResult,
  expectedPriorRef: string | null,
  // (V-N2) — the settled value of THIS request's tx, supplied ONLY on the
  // fresh-submit path (result.txHash is the tx whose value this is). UNDEFINED on
  // the recovery path (result is a confirm of the PRIOR broadcast — its value was
  // recorded at its own broadcast and must not be re-pointed to this proof's value).
  settledValueBaseUnits?: string,
): Promise<CircleNanoSettlementOutcome> {
  switch (result.kind) {
    case 'settled': {
      const flipped = await markSettlementSettled(operationId, RAIL, result.txHash, settledValueBaseUnits)
      if (!flipped) {
        // Row wasn't 'pending' — a concurrent winner already settled it. Return
        // the recorded txHash so the response is consistent.
        const row = await findSettlementRow(operationId, RAIL)
        if (row && row.settlementStatus !== 'settled') {
          // (T) ② seal HIGH — the P2 MIRROR window: we hold a SUCCESS receipt
          // (USDC MOVED via result.txHash) but the row is terminally
          // non-settled — a reconciler/sibling legitimately flipped 'failed'
          // on the prior tx's CURRENT-ref revert evidence during our resubmit
          // gap (post-confirm, pre-onBroadcast re-point). The settled-only
          // uncredited sweep can NEVER see a failed row, and the caller skips
          // the credit on alreadySettled — so THIS branch, the only actor
          // holding the receipt, is the loss class's sole detector. Alert →
          // operator repairs the row + credits manually (runbook). No
          // auto-credit/auto-repair here: a new money path needs its own audit.
          logger.error('settlement.settled_evidence_on_terminal_failed_row', {
            operationId: settlementEntryId(operationId),
            rowStatus: row.settlementStatus,
            winningTxHash: result.txHash,
            storedRef: row.externalRef,
          })
        }
        // Concurrent-flip-loser: a winner already flipped + credited this row → mark
        // alreadySettled so the caller does NOT re-credit.
        // (V) P8-f — in the MIRROR case (row terminally non-settled) return the
        // WINNING hash we hold the receipt for (runbook §3's authoritative hash),
        // not the row's reverted stored ref; a SETTLED row keeps its recorded ref.
        return {
          status: 'settled',
          txHash:
            row && row.settlementStatus !== 'settled'
              ? result.txHash
              : (row?.externalRef ?? result.txHash),
          alreadySettled: true,
        }
      }
      logger.info('circle_nano.settle_onchain_success', { operationId: settlementEntryId(operationId), txHash: result.txHash })
      // (V-N2b) — resolve the value the in-request credit pays, OR DEFER (mirror of
      // x402's orchestrate.ts). fresh-submit: settledValueBaseUnits is THIS proof's
      // value (== costCents under exactAmount) — resolve directly, NO re-read.
      // recovery-confirm: arg undefined (the settling tx is the PRIOR broadcast) →
      // re-read the now-terminal/frozen row for its recorded value. null ⇒ DEFER.
      let creditCents: number | null
      if (settledValueBaseUnits !== undefined) {
        creditCents = resolveInRequestCreditCents({
          operationId,
          rail: RAIL,
          settledValueBaseUnits,
          amountCents: null,
        })
      } else {
        const settledRow = await findSettlementRow(operationId, RAIL)
        creditCents = resolveInRequestCreditCents({
          operationId,
          rail: RAIL,
          settledValueBaseUnits: settledRow?.settledValueBaseUnits,
          amountCents: settledRow?.amountCents ?? null,
        })
      }
      return { status: 'settled', txHash: result.txHash, creditCents }
    }
    case 'reverted': {
      if (result.nonceConsumed) {
        // Our tx reverted but the (from,nonce) is spent — a concurrent tx settled
        // the authorization (the USDC reached the platform recipient). NOT a
        // failure: keep 'pending' + store our hash for reconciliation. (V): the
        // no-clobber CAS makes a lock-less loser's write here lose against a
        // DIFFERENT live winner ref instead of overwriting it (③-(U) addendum (e)).
        await markSettlementBroadcast(operationId, RAIL, result.txHash, expectedPriorRef)
        logger.warn('circle_nano.settle_reverted_nonce_consumed', { operationId: settlementEntryId(operationId), txHash: result.txHash })
        return { status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502, reason: 'Authorization settled by a concurrent transaction; confirmation reconciling.', txHash: result.txHash }
      }
      const flipped = await markSettlementFailed(operationId, RAIL, result.txHash)
      if (!flipped) {
        // (V) 3e — the ③-(U) F2 fold (fold-on-open trigger discharged): the (T)
        // CAS result was previously DISCARDED — a CAS-rejected flip on a
        // still-pending row meant the row was re-pointed mid-request (a live
        // sibling's resubmit), yet the buyer was told terminal 'failed' while
        // the row's CURRENT tx may settle. Disambiguate exactly like the
        // reconciler's pending-stale-ref.
        const current = await findSettlementRow(operationId, RAIL)
        if (current?.settlementStatus === 'pending') {
          logger.warn('circle_nano.settle_reverted_stale_ref', { operationId: settlementEntryId(operationId), staleTxHash: result.txHash, currentRef: current.externalRef })
          return { status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502, reason: 'Settlement evidence was superseded by a concurrent re-point; confirmation reconciling.', txHash: current.externalRef ?? result.txHash }
        }
        if (current?.settlementStatus === 'settled') {
          // A concurrent winner settled + credited — never re-credit.
          return { status: 'settled', txHash: current.externalRef ?? result.txHash, alreadySettled: true }
        }
        // Terminal 'failed' (or row absent): the truthful terminal response below.
      }
      logger.warn('circle_nano.settle_reverted', { operationId: settlementEntryId(operationId), txHash: result.txHash })
      return { status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_REVERTED', httpStatus: 402, reason: 'The settlement transaction reverted on-chain; the payment did not complete.' }
    }
    case 'broadcast-unconfirmed': {
      // (V-N2 ③ DC-20) BACKSTOP the settled value here, not only in onBroadcast:
      // onBroadcast's markSettlementBroadcast is best-effort (the engine swallows a
      // throw), so a DB blip at the broadcast instant could leave this still-pending
      // tx with external_ref-but-no-settledValueBaseUnits, which the reconciler would
      // later credit at the stale frozen amountCents (the vector V-N2 closes). result.txHash
      // is THIS request's broadcast tx, so settledValueBaseUnits (fresh-submit = its proof
      // value; recovery = undefined, leaving the prior tx's recorded value intact) is the
      // correct value to pair with it. Consumed for a credit only if this tx later confirms
      // settled (then it collected exactly that value); a later revert never credits.
      await markSettlementBroadcast(operationId, RAIL, result.txHash, expectedPriorRef, settledValueBaseUnits)
      logger.warn('circle_nano.settle_unconfirmed', { operationId: settlementEntryId(operationId), txHash: result.txHash, reason: result.reason })
      return { status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502, reason: 'Settlement broadcast on-chain but not yet confirmed; treat as pending and retry to confirm.', txHash: result.txHash }
    }
    case 'nonce-already-used': {
      // Nonce consumed on-chain but our row isn't 'settled'. Either our own
      // earlier broadcast confirmed or a third party settled it; we can't attribute
      // a txHash safely → leave 'pending' for reconciliation.
      logger.warn('circle_nano.settle_nonce_used_unrecorded', { operationId: settlementEntryId(operationId) })
      return { status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502, reason: 'The authorization nonce is already spent on-chain; confirmation reconciling.' }
    }
    case 'insufficient-balance': {
      // Pre-check, no tx sent (the nonce is still free). Insufficient PAYER
      // balance is TRANSIENT — the payer can top up and the SAME (unconsumed)
      // authorization is still settleable. So leave the row 'pending' (retryable)
      // and surface a 402; do NOT mark 'failed', which would terminally brick a
      // valid authorization on a momentary balance dip.
      logger.warn('circle_nano.settle_insufficient_balance', { operationId: settlementEntryId(operationId), have: result.haveBaseUnits, need: result.needBaseUnits })
      return { status: 'failed', code: 'CIRCLE_NANO_INSUFFICIENT_FUNDS', httpStatus: 402, reason: `Payer USDC balance (${result.haveBaseUnits} base units) is below the authorized ${result.needBaseUnits}.` }
    }
    case 'submit-error': {
      // No broadcast (nonce free, no money moved). Leave the row 'pending' (the
      // error may be transient) and surface it; do NOT mark 'failed'.
      const httpStatus = result.code === 'GAS_WALLET_INSUFFICIENT' || result.code === 'GAS_WALLET_NOT_CONFIGURED' ? 503 : 502
      logger.error('circle_nano.settle_submit_error', { operationId: settlementEntryId(operationId), code: result.code, reason: result.reason })
      return { status: 'pending', code: `CIRCLE_NANO_${result.code}`, httpStatus, reason: `Settlement could not be submitted on-chain: ${result.reason}` }
    }
  }
}

/**
 * Settle a verified circle-nano authorization on-chain and record the result.
 * Caller MUST have already verified the proof (signature, payee, window, amount)
 * and resolved a positive `costCents` + the owning `accountId`.
 */
export async function executeCircleNanoSettlement(
  params: ExecuteCircleNanoSettlementParams,
): Promise<CircleNanoSettlementOutcome> {
  const { proof } = params
  const operationId = circleNanoOperationId(proof)

  // 1. Idempotency — a prior settle for this exact authorization already landed.
  const existing = await findSettlementRow(operationId, RAIL)
  if (existing?.settlementStatus === 'settled') {
    if (!existing.externalRef) {
      // Anomaly: a row this code settles ALWAYS carries its on-chain txHash
      // (markSettlementSettled sets it). An empty ref means a corrupted/legacy
      // row — surface it for reconciliation rather than silently returning ''.
      logger.warn('circle_nano.settle_settled_missing_txhash', { operationId: settlementEntryId(operationId) })
    }
    logger.info('circle_nano.settle_idempotent_hit', { operationId: settlementEntryId(operationId), txHash: existing.externalRef })
    // Idempotent-hit: a prior settle already flipped + credited this authorization
    // → mark alreadySettled so the caller does NOT re-credit.
    return { status: 'settled', txHash: existing.externalRef ?? '', alreadySettled: true }
  }
  if (existing?.settlementStatus === 'failed') {
    return { status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_PREVIOUSLY_FAILED', httpStatus: 402, reason: 'This authorization previously failed to settle on-chain. Re-issue a fresh authorization.' }
  }

  // 2. Serialize concurrent settles of the SAME authorization (best-effort). If
  //    Redis is down, tryRedis → null and we proceed unlocked (the on-chain nonce
  //    is the ultimate backstop).
  const lockKey = settleLockKey(operationId)
  const lockAcquired = await tryRedis(async () => {
    const res = await getRedis().set(lockKey, '1', { nx: true, ex: SETTLE_LOCK_TTL_SECONDS })
    return res === 'OK'
  })
  if (lockAcquired === false) {
    return { status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_IN_PROGRESS', httpStatus: 409, reason: 'A settlement for this authorization is already in progress. Retry shortly.' }
  }

  try {
    // 3. Write-ahead INTENT row (so a crash post-broadcast is recoverable and the
    //    flip has a row to match).
    await ensurePendingRow({ ...params, operationId })

    // 3.5 (V) — raise the stored validBefore bound to cover THIS authorization
    //     (re-signs share the (from,nonce) row; the INSERT is first-write-wins,
    //     so the refresh is the only writer that can raise a stale bound — the
    //     expiry pass proves expiry against the stored value). RAISE-only: a
    //     legacy row without a bound keeps none. `false` ⇒ the row went
    //     TERMINAL between the step-1 read and now (incl. the expiry pass's
    //     flip landing in that sliver) — abort before ANY broadcast onto a
    //     terminal row (R2-B5b: this closes the flip-first ordering; the
    //     writer's validBefore CAS closes the refresh-first ordering).
    const refreshed = await refreshPendingValidBefore(
      operationId,
      RAIL,
      BigInt(proof.authorization.validBefore).toString(10),
    )
    if (!refreshed) {
      const current = await findSettlementRow(operationId, RAIL)
      if (current?.settlementStatus === 'settled') {
        return { status: 'settled', txHash: current.externalRef ?? '', alreadySettled: true }
      }
      return { status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_PREVIOUSLY_FAILED', httpStatus: 402, reason: 'This authorization previously failed to settle on-chain. Re-issue a fresh authorization.' }
    }

    // 4. Recovery — a prior attempt already broadcast a tx (stored in external_ref
    //    on the pending row): re-wait on THAT tx instead of blindly re-submitting.
    //    Re-broadcasting while the stored tx may still be in the mempool would
    //    DUPLICATE it (wasted gas + a clobbered recorded hash). So we ONLY fall
    //    through to a fresh submit when the stored tx is a CLEAN revert with the
    //    nonce still free (it definitively failed); for settled / still-in-flight /
    //    reverted-but-nonce-consumed we apply the stored tx's outcome and return.
    const onBroadcast = async (txHash: Hex): Promise<void> => {
      // (V-N2) — record the ACTUALLY-collected value (EIP-3009 moves exactly
      // authorization.value) in the SAME UPDATE that pins external_ref, keyed to
      // this broadcasting tx. The reconciler tail later credits THIS recorded
      // value, not the frozen first-write amountCents.
      const settledValueBaseUnits = proof.authorization.value
      // (V) P8-e — expectedPrior = the ref this request read at step 1 (the
      // legal same-actor T1→T2 re-point); a DIFFERENT live ref (a sibling's
      // winner) is never clobbered.
      const persisted = await markSettlementBroadcast(operationId, RAIL, txHash, existing?.externalRef ?? null, settledValueBaseUnits)
      // (V-N2 detect) — at the broadcast seam the broadcasting value (P2) and the
      // row's frozen amountCents (P1) coexist; flag a loss-direction divergence.
      detectSettledValueDivergence({
        operationId,
        rail: RAIL,
        settledValueBaseUnits,
        frozenAmountCents: existing?.amountCents ?? params.costCents,
      })
      if (!persisted) {
        // (T) ② seal — sibling of settled_evidence_on_terminal_failed_row,
        // fired at BROADCAST time: the write-ahead no-opped (WHERE pending)
        // because the row went terminal mid-request. If it is FAILED, a live
        // tx that may move USDC is now in flight against a terminally-failed
        // row — and if this process dies before observing the receipt, no
        // later actor can detect the loss (buyer retries exit at
        // PREVIOUSLY_FAILED; the reconciler and the sweep never look at
        // failed rows). Logging the candidate hash HERE puts the evidence on
        // the record before the receipt window; the receipt-time alert
        // remains the confirmation. Irreducible residual: a kill between
        // writeContract and this callback (no DB write possible).
        const row = await findSettlementRow(operationId, RAIL)
        if (row && row.settlementStatus === 'failed') {
          logger.error('settlement.broadcast_evidence_on_terminal_failed_row', {
            operationId: settlementEntryId(operationId),
            rowStatus: row.settlementStatus,
            broadcastTxHash: txHash,
            storedRef: row.externalRef,
          })
        }
      }
    }
    if (existing?.settlementStatus === 'pending' && existing.externalRef) {
      const confirmed = await confirmCircleNanoTx(proof, existing.externalRef as Hex)
      const storedTxDefinitivelyFailed = confirmed.kind === 'reverted' && !confirmed.nonceConsumed
      if (!storedTxDefinitivelyFailed) {
        return applyOutcome(operationId, confirmed, existing.externalRef)
      }
      // (V) P8-a — re-read terminality IMMEDIATELY before the fresh submit: a
      // reconciler/sibling flip can land during the confirm above (the P2-mirror
      // window). Aborting here means no resubmitted tx can settle onto a
      // terminally-failed row through THIS gap; the surviving race (a flip
      // landing after this read) stays DETECTED by the (T) evidence alerts.
      const current = await findSettlementRow(operationId, RAIL)
      if (current && current.settlementStatus !== 'pending') {
        if (current.settlementStatus === 'settled') {
          return { status: 'settled', txHash: current.externalRef ?? '', alreadySettled: true }
        }
        return { status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_PREVIOUSLY_FAILED', httpStatus: 402, reason: 'This authorization previously failed to settle on-chain. Re-issue a fresh authorization.' }
      }
      logger.info('circle_nano.settle_recovery_resubmit', { operationId: settlementEntryId(operationId), priorTx: existing.externalRef })
    }

    // 5. Submit on-chain + wait for a confirmed receipt, then flip the ledger row.
    //    onBroadcast persists the hash the instant it broadcasts (write-ahead),
    //    so a mid-wait process kill still leaves a re-waitable tx.
    const result = await submitCircleNanoOnChain(proof, { onBroadcast })
    // (V-N2) — fresh submit: result.txHash IS the tx this request broadcast, so
    // its value is this proof's value (pass it so a settled flip that re-points
    // the ref carries the value with it; the recovery call at step 4 does NOT).
    return applyOutcome(operationId, result, existing?.externalRef ?? null, proof.authorization.value)
  } finally {
    await tryRedis(async () => {
      await getRedis().del(lockKey)
    })
  }
}
