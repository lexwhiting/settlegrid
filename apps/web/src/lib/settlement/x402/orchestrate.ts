/**
 * x402 (exact scheme) — on-chain settlement ORCHESTRATOR ("A2 for x402").
 *
 * x402-exact IS the same EIP-3009 `transferWithAuthorization` as circle-nano, so
 * this reuses the SHARED, audited on-chain engine (circle-nano/settle-engine.ts)
 * and offline verifier (circle-nano/verify.ts → verifyEip3009Authorization). It
 * is a close mirror of executeCircleNanoSettlement; the only rail differences are
 * the `exact` amount rule (value === cost, the canonical x402 V2 facilitator
 * behavior) and x402-flavored error codes.
 *
 * Flow: offline verify (recover signer + payee-bind + EXACT amount + Base-only,
 * RPC-free → rejects a bad sig WITHOUT burning gas) → idempotency on
 * (network,from,nonce) → write-ahead 'pending' INTENT row → per-auth Redis lock →
 * submit on-chain + CONFIRMED-receipt wait → guarded flip.
 *
 * Funds-safety invariants (mirror circle-nano A2, verified by the audit panel):
 *   - a reverted/unconfirmed tx is NEVER recorded 'settled';
 *   - idempotency keyed on (network,from,nonce) — NEVER signature bytes (EIP-3009
 *     sigs are malleable; USDC enforces (from,nonce)-once on-chain);
 *   - 'settled' is terminal: every flip guarded WHERE settlement_status='pending'.
 */
import type { Hex } from 'viem'
import type { X402ExactPayload } from './types'
import type { Eip3009SettleProof } from '../eip3009/types'
import { getRedis, tryRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { verifyEip3009Authorization } from '../circle-nano/verify'
import {
  recordSettlementEntry,
  findSettlementRow,
  markSettlementSettled,
  markSettlementFailed,
  markSettlementBroadcast,
} from '../ledger'
import {
  submitCircleNanoOnChain,
  confirmCircleNanoTx,
  type CircleNanoOnChainResult,
} from '../circle-nano/settle-engine'

const RAIL = 'x402'
/** 1 US cent = 10,000 USDC base units (6 decimals). */
const USDC_BASE_UNITS_PER_CENT = 10_000n
/** Redis settle-lock TTL (s) — exceeds the route's maxDuration so it can't expire mid-request; released in finally. */
const SETTLE_LOCK_TTL_SECONDS = 70

export interface ExecuteX402SettlementParams {
  /** The decoded, structurally-valid exact payload (from parseX402ExactPayload). */
  payload: X402ExactPayload
  costCents: number
  /** Owning developer id (A1 stand-in for accountId — parity with circle-nano). */
  accountId: string
  toolSlug: string
  method: string
  /** Platform payee (SETTLEGRID_PAYMENT_ADDRESS) — caller has validated it is set + a valid address. */
  recipient: string
}

/**
 * Route-facing outcome.
 *   - settled → forward + bill (HTTP 200 from the proxy).
 *   - failed  → terminal reject; HTTP error, NO forward, NO bill (payment did NOT happen).
 *   - pending → broadcast/in-progress/unconfirmed; HTTP error, NO forward, NO bill
 *               (NEVER claim settled). Safe to retry — idempotency + on-chain nonce
 *               prevent a double-charge; the B1.4 reconciler confirms it later.
 */
export type X402SettlementOutcome =
  | { status: 'settled'; txHash: string }
  | { status: 'failed'; code: string; httpStatus: number; reason: string }
  | { status: 'pending'; code: string; httpStatus: number; reason: string; txHash?: string }

/** Eip3009 proof view of the x402 exact payload (the shared engine/verifier shape). */
function toProof(payload: X402ExactPayload): Eip3009SettleProof {
  return {
    network: payload.network,
    authorization: payload.payload.authorization,
    signature: payload.payload.signature,
  }
}

/** Stable per-authorization key → the `operation_id` column. Parity with circle-nano. */
export function x402OperationId(proof: Eip3009SettleProof): string {
  return `${RAIL}:${proof.network}:${proof.authorization.from.toLowerCase()}:${proof.authorization.nonce.toLowerCase()}`
}

function settleLockKey(operationId: string): string {
  return `x402:settle:lock:${operationId}`
}

/** Map an offline-verify failure (CircleNanoErrorCode from the shared verifier) → an x402 outcome. */
function verifyFailureOutcome(
  errorCode: string | undefined,
  reason: string | undefined,
): X402SettlementOutcome {
  const map: Record<string, { code: string; httpStatus: number }> = {
    CIRCLE_NANO_NETWORK_UNSUPPORTED: { code: 'X402_NETWORK_UNSUPPORTED', httpStatus: 400 },
    CIRCLE_NANO_WRONG_RECIPIENT: { code: 'X402_WRONG_RECIPIENT', httpStatus: 402 },
    CIRCLE_NANO_NOT_YET_VALID: { code: 'X402_EXPIRED', httpStatus: 402 },
    CIRCLE_NANO_EXPIRED: { code: 'X402_EXPIRED', httpStatus: 402 },
    CIRCLE_NANO_AMOUNT_MISMATCH: { code: 'X402_AMOUNT_MISMATCH', httpStatus: 402 },
    CIRCLE_NANO_AUTH_INVALID: { code: 'X402_SIGNATURE_INVALID', httpStatus: 402 },
  }
  const mapped = (errorCode && map[errorCode]) || { code: 'X402_SETTLEMENT_FAILED', httpStatus: 402 }
  return {
    status: 'failed',
    code: mapped.code,
    httpStatus: mapped.httpStatus,
    reason: reason ?? 'x402 payment verification failed.',
  }
}

/** Write-ahead INTENT: ensure the 'pending' ledger row exists BEFORE we submit. */
async function ensurePendingRow(
  proof: Eip3009SettleProof,
  params: ExecuteX402SettlementParams & { operationId: string },
): Promise<void> {
  const { operationId, costCents, accountId, toolSlug, method } = params
  // Idempotent (deterministic id from operationId + ON CONFLICT DO NOTHING): a
  // pre-existing pending row is left intact (incl. any broadcast txHash).
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
      settlementType: 'on-chain',
      scheme: 'exact',
      network: proof.network,
      payer: proof.authorization.from,
      // For the x402 exact scheme this equals the tool cost (verifier enforces
      // value === required), but recorded explicitly for audit parity.
      authorizedValueBaseUnits: proof.authorization.value,
    },
    description: `x402 settlement for tool ${toolSlug} (${method})`,
  })
}

/** Map an on-chain engine result → a ledger flip + route outcome (mirrors circle-nano applyOutcome). */
async function applyOutcome(
  operationId: string,
  result: CircleNanoOnChainResult,
): Promise<X402SettlementOutcome> {
  switch (result.kind) {
    case 'settled': {
      const flipped = await markSettlementSettled(operationId, RAIL, result.txHash)
      if (!flipped) {
        // A concurrent winner already settled it; return the recorded txHash.
        const row = await findSettlementRow(operationId, RAIL)
        return { status: 'settled', txHash: row?.externalRef ?? result.txHash }
      }
      logger.info('x402.settle_onchain_success', { operationId, txHash: result.txHash })
      return { status: 'settled', txHash: result.txHash }
    }
    case 'reverted': {
      if (result.nonceConsumed) {
        // Our tx reverted but the (from,nonce) is spent → a concurrent tx settled
        // the authorization (USDC reached the bound recipient). NOT a failure.
        await markSettlementBroadcast(operationId, RAIL, result.txHash)
        logger.warn('x402.settle_reverted_nonce_consumed', { operationId, txHash: result.txHash })
        return {
          status: 'pending',
          code: 'X402_SETTLEMENT_PENDING_CONFIRMATION',
          httpStatus: 502,
          reason: 'Authorization settled by a concurrent transaction; confirmation reconciling.',
          txHash: result.txHash,
        }
      }
      await markSettlementFailed(operationId, RAIL, result.txHash)
      logger.warn('x402.settle_reverted', { operationId, txHash: result.txHash })
      return {
        status: 'failed',
        code: 'X402_SETTLEMENT_REVERTED',
        httpStatus: 402,
        reason: 'The settlement transaction reverted on-chain; the payment did not complete.',
      }
    }
    case 'broadcast-unconfirmed': {
      await markSettlementBroadcast(operationId, RAIL, result.txHash)
      logger.warn('x402.settle_unconfirmed', { operationId, txHash: result.txHash, reason: result.reason })
      return {
        status: 'pending',
        code: 'X402_SETTLEMENT_PENDING_CONFIRMATION',
        httpStatus: 502,
        reason: 'Settlement broadcast on-chain but not yet confirmed; treat as pending and retry to confirm.',
        txHash: result.txHash,
      }
    }
    case 'nonce-already-used': {
      logger.warn('x402.settle_nonce_used_unrecorded', { operationId })
      return {
        status: 'pending',
        code: 'X402_SETTLEMENT_PENDING_CONFIRMATION',
        httpStatus: 502,
        reason: 'The authorization nonce is already spent on-chain; confirmation reconciling.',
      }
    }
    case 'insufficient-balance': {
      // Pre-check, no tx sent (nonce still free). Insufficient PAYER balance is
      // transient (they can top up + retry the same authorization), so this is a
      // 402 reject, not a 'failed' flip that would brick a valid authorization.
      logger.warn('x402.settle_insufficient_balance', {
        operationId,
        have: result.haveBaseUnits,
        need: result.needBaseUnits,
      })
      return {
        status: 'failed',
        code: 'X402_INSUFFICIENT_BALANCE',
        httpStatus: 402,
        reason: `Payer USDC balance (${result.haveBaseUnits} base units) is below the authorized ${result.needBaseUnits}.`,
      }
    }
    case 'submit-error': {
      // No broadcast (nonce free, no money moved). Leave the row 'pending' (the
      // error may be transient) and surface it; do NOT mark 'failed'.
      const httpStatus =
        result.code === 'GAS_WALLET_INSUFFICIENT' || result.code === 'GAS_WALLET_NOT_CONFIGURED'
          ? 503
          : 502
      logger.error('x402.settle_submit_error', { operationId, code: result.code, reason: result.reason })
      return {
        status: 'pending',
        code: `X402_${result.code}`,
        httpStatus,
        reason: `Settlement could not be submitted on-chain: ${result.reason}`,
      }
    }
  }
}

/**
 * Settle a structurally-valid x402 EXACT authorization on-chain and record it.
 * Caller resolves a positive `costCents`, the owning `accountId`, and the
 * platform `recipient` (validated set). Returns a route-facing outcome; the
 * proxy forwards + bills ONLY on `settled`.
 */
export async function executeX402Settlement(
  params: ExecuteX402SettlementParams,
): Promise<X402SettlementOutcome> {
  const proof = toProof(params.payload)
  const operationId = x402OperationId(proof)
  const requiredBaseUnits =
    BigInt(Math.max(0, Math.floor(params.costCents))) * USDC_BASE_UNITS_PER_CENT

  // 1. Offline verify FIRST — recover the EIP-712 signer + payee-bind + EXACT
  //    amount + Base-only. RPC-free, so a bad signature / wrong payee / wrong
  //    amount / unsupported network is rejected WITHOUT burning gas on a
  //    guaranteed-revert submit. exactAmount=true enforces the x402 exact rule.
  const verification = await verifyEip3009Authorization(proof, {
    recipient: params.recipient,
    requiredBaseUnits,
    exactAmount: true,
  })
  if (!verification.valid) {
    logger.info('x402.settle_verify_rejected', { operationId, code: verification.errorCode })
    return verifyFailureOutcome(verification.errorCode, verification.invalidReason)
  }

  // 2. Idempotency — a prior settle for this exact authorization already landed.
  const existing = await findSettlementRow(operationId, RAIL)
  if (existing?.settlementStatus === 'settled') {
    logger.info('x402.settle_idempotent_hit', { operationId, txHash: existing.externalRef })
    return { status: 'settled', txHash: existing.externalRef ?? '' }
  }
  if (existing?.settlementStatus === 'failed') {
    return {
      status: 'failed',
      code: 'X402_SETTLEMENT_PREVIOUSLY_FAILED',
      httpStatus: 402,
      reason: 'This authorization previously failed to settle on-chain. Re-issue a fresh authorization.',
    }
  }

  // 3. Serialize concurrent settles of the SAME authorization (best-effort; if
  //    Redis is down we proceed unlocked — the on-chain nonce is the backstop).
  const lockKey = settleLockKey(operationId)
  const lockAcquired = await tryRedis(async () => {
    const res = await getRedis().set(lockKey, '1', { nx: true, ex: SETTLE_LOCK_TTL_SECONDS })
    return res === 'OK'
  })
  if (lockAcquired === false) {
    return {
      status: 'pending',
      code: 'X402_SETTLEMENT_IN_PROGRESS',
      httpStatus: 409,
      reason: 'A settlement for this authorization is already in progress. Retry shortly.',
    }
  }

  try {
    // 4. Write-ahead INTENT row (so a crash post-broadcast is recoverable + the flip has a row to match).
    await ensurePendingRow(proof, { ...params, operationId })

    // 5. Recovery — a prior attempt already broadcast a tx (stored in external_ref):
    //    re-wait on THAT tx instead of blindly re-submitting (re-broadcast would
    //    duplicate). Only fall through to a fresh submit when the stored tx is a
    //    CLEAN revert with the nonce still free.
    if (existing?.settlementStatus === 'pending' && existing.externalRef) {
      const confirmed = await confirmCircleNanoTx(proof, existing.externalRef as Hex)
      const storedTxDefinitivelyFailed = confirmed.kind === 'reverted' && !confirmed.nonceConsumed
      if (!storedTxDefinitivelyFailed) {
        return applyOutcome(operationId, confirmed)
      }
      logger.info('x402.settle_recovery_resubmit', { operationId, priorTx: existing.externalRef })
    }

    // 6. Submit on-chain + wait for a CONFIRMED receipt, then flip. onBroadcast
    //    persists the hash the instant it broadcasts (write-ahead), so a mid-wait
    //    process kill leaves a re-waitable tx.
    const onBroadcast = async (txHash: Hex): Promise<void> => {
      await markSettlementBroadcast(operationId, RAIL, txHash)
    }
    const result = await submitCircleNanoOnChain(proof, { onBroadcast })
    return applyOutcome(operationId, result)
  } finally {
    await tryRedis(async () => {
      await getRedis().del(lockKey)
    })
  }
}
