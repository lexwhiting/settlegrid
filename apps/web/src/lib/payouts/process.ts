/**
 * P5.PAYOUTS-3 — `processPayout` helper.
 *
 * Single source of truth for "trigger one developer's payout end-to-end".
 *
 * Three callers consume this helper:
 *   1. POST /api/payouts/trigger          (UI button + curl)
 *   2. Daily cron /api/cron/process-payouts (Phase 4)
 *   3. (future) admin tool / reconcile job
 *
 * Why a helper instead of letting each caller hit the route:
 *   - The cron must process N developers in one invocation; calling
 *     /api/payouts/trigger N times over the wire would multiply
 *     authentication, rate-limit checks, and HTTP overhead.
 *   - Each caller has a different auth posture (developer cookie vs.
 *     bearer cron secret). Auth + rate-limit live at the route layer;
 *     the helper does the actual work.
 *   - Tests verify ONE codepath, not three near-duplicates.
 *
 * The helper is non-throwing: it returns a typed `ProcessPayoutResult`
 * with `ok: true` (success) or `ok: false` + an `errorCode`. Callers
 * decide how to translate result → HTTP/log/alert.
 *
 * Concurrency hardening from Phase 1 (P5.PAYOUTS-1) is preserved:
 *   - SELECT FOR UPDATE on the developer row inside db.transaction()
 *   - Stripe idempotency key = `payout:${payoutRecord.id}`
 *   - Partial unique index `payouts_one_processing_per_dev` (migration
 *     0009) → 23505 → PAYOUT_IN_PROGRESS
 *   - Transactional rollback on Stripe failure (restore balance + mark
 *     payout failed in a single tx)
 *   - account_invalid / insufficient_capabilities → flip
 *     stripeConnectStatus to 'needs_reconnect' so the cron stops
 *     retrying daily on a dead account
 *
 * Take-rate normalization from Phase 2 (P5.PAYOUTS-2) is preserved:
 *   - Developer balance is credited GROSS at invocation time; the
 *     progressive platform take (lib/pricing.ts) is applied here at
 *     payout time, exactly once.
 */

import Stripe from 'stripe'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, payouts } from '@/lib/db/schema'
import { getStripeSecretKey } from '@/lib/env'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { payoutNotificationEmail, sendEmail } from '@/lib/email'
import { calculateTakeCents } from '@/lib/pricing'

export type ProcessPayoutErrorCode =
  | 'NOT_FOUND'
  | 'STRIPE_NOT_ACTIVE'
  | 'NO_STRIPE_ACCOUNT'
  | 'BELOW_MINIMUM'
  | 'PAYOUT_IN_PROGRESS'
  | 'STRIPE_TRANSFER_FAILED'
  | 'NEEDS_RECONNECT'
  | 'PAYOUT_PARTIAL_SUCCESS'
  | 'PAYOUT_UNKNOWN'
  | 'PAYOUT_RECONCILE_REQUIRED'
  | 'INTERNAL'

export interface ProcessPayoutSuccess {
  ok: true
  payoutId: string
  amountCents: number
  platformFeeCents: number
  grossCents: number
  stripeTransferId: string
  createdAt: Date
}

export interface ProcessPayoutFailure {
  ok: false
  errorCode: ProcessPayoutErrorCode
  errorMessage: string
  /** HTTP status the route layer should map this to. */
  httpStatus: number
}

export type ProcessPayoutResult = ProcessPayoutSuccess | ProcessPayoutFailure

export interface ProcessPayoutParams {
  developerId: string
  trigger: 'manual' | 'cron'
  /** For audit-log correlation; optional for cron triggers. */
  ipAddress?: string
}

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  })
}

/**
 * Postgres unique-constraint-violation detector for the partial
 * unique index `payouts_one_processing_per_dev` (migration 0009;
 * extended to cover 'unknown' status in migration 0010).
 */
function isConcurrentPayoutCollision(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: string; constraint_name?: string }
  return (
    e.code === '23505' &&
    e.constraint_name === 'payouts_one_processing_per_dev'
  )
}

type StripeErrorClass = 'definitive' | 'indeterminate' | 'terminal-account'

/**
 * Classify a thrown Stripe error to decide rollback strategy.
 *
 * Stripe's Node SDK sets `err.type` on every typed error class
 * (StripeConnectionError, StripeAPIError, etc. — see
 * `node_modules/stripe/types/Errors.d.ts`).
 *
 *   'terminal-account'  the dev's connected account is dead. Roll
 *                       back balance, mark 'failed', flip
 *                       stripeConnectStatus to 'needs_reconnect'.
 *
 *   'indeterminate'     Stripe MAY have created the transfer; we
 *                       cannot know without a webhook to confirm.
 *                       DO NOT roll back balance — that would silently
 *                       lose money on a successful-but-network-failed
 *                       transfer. Mark 'unknown', wait for webhook.
 *                       Cases:
 *                       - StripeConnectionError (network/timeout)
 *                       - StripeAPIError (Stripe-side 5xx)
 *                       - StripeIdempotencyError — the previous
 *                         request likely succeeded; treating as
 *                         'definitive' would double-pay if the user
 *                         retries.
 *
 *   'definitive'        Stripe rejected the request before processing
 *                       a transfer. Safe to roll back balance and
 *                       mark 'failed'. Cases:
 *                       - StripeInvalidRequestError (bad params)
 *                       - StripeAuthenticationError (bad API key)
 *                       - StripePermissionError (account caps)
 *                       - StripeRateLimitError (429 — Stripe rate-
 *                         limited at the edge before transfer engine)
 *                       - StripeCardError (irrelevant for transfers
 *                         but defaults safely)
 *                       - StripeInvalidGrantError, StripeSignature
 *                         VerificationError — also default here.
 *                       Anything we can't classify defaults to
 *                       'definitive' since rolling back is the
 *                       conservative choice for unknown error shapes
 *                       — but we only reach this when none of the
 *                       indeterminate cases match.
 */
function classifyStripeError(err: unknown): StripeErrorClass {
  if (typeof err !== 'object' || err === null) return 'definitive'
  const e = err as { type?: string; code?: string }

  if (e.code === 'account_invalid' || e.code === 'insufficient_capabilities') {
    return 'terminal-account'
  }

  if (
    e.type === 'StripeConnectionError' ||
    e.type === 'StripeAPIError' ||
    e.type === 'StripeIdempotencyError'
  ) {
    return 'indeterminate'
  }

  return 'definitive'
}

interface PreflightOk {
  ok: true
  payoutRecord: {
    id: string
    amountCents: number
    platformFeeCents: number
    createdAt: Date
  }
  payoutAmountCents: number
  platformFeeCents: number
  grossCents: number
  developerEmail: string
  developerName: string | null
  stripeConnectId: string
}

interface PreflightFail {
  ok: false
  errorCode: 'NOT_FOUND' | 'STRIPE_NOT_ACTIVE' | 'NO_STRIPE_ACCOUNT' | 'BELOW_MINIMUM'
  errorMessage: string
  httpStatus: number
}

export async function processPayout(
  params: ProcessPayoutParams,
): Promise<ProcessPayoutResult> {
  const { developerId, trigger, ipAddress } = params

  // ── Phase 1: serialized preflight ──────────────────────────────────────
  let preflight: PreflightOk | PreflightFail
  try {
    preflight = await db.transaction(async (tx) => {
      const [developer] = await tx
        .select({
          id: developers.id,
          email: developers.email,
          name: developers.name,
          balanceCents: developers.balanceCents,
          stripeConnectId: developers.stripeConnectId,
          stripeConnectStatus: developers.stripeConnectStatus,
          payoutMinimumCents: developers.payoutMinimumCents,
          createdAt: developers.createdAt,
        })
        .from(developers)
        .where(eq(developers.id, developerId))
        .for('update')
        .limit(1)

      if (!developer) {
        return {
          ok: false as const,
          errorCode: 'NOT_FOUND' as const,
          errorMessage: 'Developer not found.',
          httpStatus: 404,
        }
      }

      if (developer.stripeConnectStatus !== 'active') {
        return {
          ok: false as const,
          errorCode: 'STRIPE_NOT_ACTIVE' as const,
          errorMessage:
            'Stripe Connect account must be active to trigger payouts. Complete onboarding first.',
          httpStatus: 400,
        }
      }

      if (!developer.stripeConnectId) {
        return {
          ok: false as const,
          errorCode: 'NO_STRIPE_ACCOUNT' as const,
          errorMessage: 'No Stripe Connect account found. Complete onboarding first.',
          httpStatus: 400,
        }
      }

      if (developer.balanceCents < developer.payoutMinimumCents) {
        return {
          ok: false as const,
          errorCode: 'BELOW_MINIMUM' as const,
          errorMessage: `Balance ($${(developer.balanceCents / 100).toFixed(2)}) is below the minimum payout threshold ($${(developer.payoutMinimumCents / 100).toFixed(2)}).`,
          httpStatus: 400,
        }
      }

      const grossCents = developer.balanceCents
      const platformFeeCents = calculateTakeCents(grossCents)
      const payoutAmountCents = grossCents - platformFeeCents

      // Derive periodStart from the previous COMPLETED payout's periodEnd.
      // This eliminates overlap between consecutive payouts that the old
      // now-30d fabrication produced. Falls back to the developer's
      // account creation date for the very first payout. Failed/unknown
      // payouts are intentionally excluded — they don't represent paid
      // periods.
      const [previousPayout] = await tx
        .select({ periodEnd: payouts.periodEnd })
        .from(payouts)
        .where(
          and(
            eq(payouts.developerId, developer.id),
            eq(payouts.status, 'completed'),
          ),
        )
        .orderBy(desc(payouts.periodEnd))
        .limit(1)

      const now = new Date()
      const periodStart = previousPayout?.periodEnd ?? developer.createdAt

      const [payoutRecord] = await tx
        .insert(payouts)
        .values({
          developerId: developer.id,
          amountCents: payoutAmountCents,
          platformFeeCents,
          periodStart,
          periodEnd: now,
          status: 'processing',
        })
        .returning({
          id: payouts.id,
          amountCents: payouts.amountCents,
          platformFeeCents: payouts.platformFeeCents,
          createdAt: payouts.createdAt,
        })

      await tx
        .update(developers)
        .set({ balanceCents: 0, updatedAt: now })
        .where(eq(developers.id, developer.id))

      return {
        ok: true as const,
        payoutRecord,
        payoutAmountCents,
        platformFeeCents,
        grossCents,
        developerEmail: developer.email,
        developerName: developer.name,
        stripeConnectId: developer.stripeConnectId,
      }
    })
  } catch (txErr) {
    if (isConcurrentPayoutCollision(txErr)) {
      return {
        ok: false,
        errorCode: 'PAYOUT_IN_PROGRESS',
        errorMessage:
          'A payout is already in progress for this account. Wait for it to complete and try again.',
        httpStatus: 409,
      }
    }
    logger.error('payout.preflight_failed', { developerId, trigger }, txErr as Error)
    return {
      ok: false,
      errorCode: 'INTERNAL',
      errorMessage: 'Payout preflight failed.',
      httpStatus: 500,
    }
  }

  if (!preflight.ok) {
    return {
      ok: false,
      errorCode: preflight.errorCode,
      errorMessage: preflight.errorMessage,
      httpStatus: preflight.httpStatus,
    }
  }

  const {
    payoutRecord,
    payoutAmountCents,
    platformFeeCents,
    grossCents,
    developerEmail,
    developerName,
    stripeConnectId,
  } = preflight

  // ── Phase 2: Stripe transfer with idempotency key ────────────────────
  let transfer: Stripe.Transfer
  try {
    const stripe = getStripe()
    transfer = await stripe.transfers.create(
      {
        amount: payoutAmountCents,
        currency: 'usd',
        destination: stripeConnectId,
        metadata: {
          developerId,
          payoutId: payoutRecord.id,
          payoutAmountCents: payoutAmountCents.toString(),
          trigger,
        },
      },
      { idempotencyKey: `payout:${payoutRecord.id}` },
    )
  } catch (stripeError) {
    const errorMsg =
      stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error'
    const stripeErrorCode = (stripeError as { code?: string })?.code
    const stripeErrorType = (stripeError as { type?: string })?.type
    const errorClass = classifyStripeError(stripeError)

    if (errorClass === 'indeterminate') {
      // Stripe may have actually created the transfer; we can't know
      // without a webhook reconciling. Mark 'unknown', do NOT restore
      // balance, do NOT trigger any developer-facing email. The
      // partial unique index (migration 0010) blocks user retries on
      // 'unknown' rows the same way it blocks 'processing'.
      //
      // Retry the UPDATE with backoff (matches the completion-UPDATE
      // pattern in Phase 3). If all attempts fail, write a durable
      // audit-log entry so the orphan-cleanup path can see this
      // payoutId hit an indeterminate Stripe error and SKIP the
      // shape-A refund (which would silently double-pay if Stripe
      // really did complete the transfer).
      const UNKNOWN_RETRY_BACKOFF_MS = [100, 500, 2000]
      let unknownMarkErr: Error | null = null
      for (let i = 0; i < 1 + UNKNOWN_RETRY_BACKOFF_MS.length; i++) {
        try {
          await db
            .update(payouts)
            .set({
              status: 'unknown',
              errorMessage: `indeterminate stripe error (${stripeErrorType ?? 'unknown'}): ${errorMsg}`,
            })
            .where(eq(payouts.id, payoutRecord.id))
          unknownMarkErr = null
          break
        } catch (markErr) {
          unknownMarkErr = markErr as Error
          if (i < UNKNOWN_RETRY_BACKOFF_MS.length) {
            await new Promise((resolve) => setTimeout(resolve, UNKNOWN_RETRY_BACKOFF_MS[i]))
          }
        }
      }

      if (unknownMarkErr) {
        // Best-effort durable signal so orphan-cleanup can find this
        // row and refuse to auto-refund. writeAuditLog swallows its
        // own errors; if it ALSO fails, we've exhausted in-band
        // recovery and the row genuinely needs operator attention.
        await writeAuditLog({
          developerId,
          action: 'payout.indeterminate_unmarked',
          resourceType: 'payout',
          resourceId: payoutRecord.id,
          details: {
            grossCents,
            stripeErrorType,
            stripeErrorCode,
            errorMessage: errorMsg,
            reason: 'unknown_mark_failed_after_retries',
          },
        })
        logger.error(
          'payout.unknown_mark_failed',
          {
            developerId,
            payoutId: payoutRecord.id,
            grossCents,
            stripeErrorType,
            stripeErrorCode,
          },
          unknownMarkErr,
        )
      }

      logger.error(
        'payout.unknown_status_pending_reconcile',
        {
          developerId,
          payoutId: payoutRecord.id,
          amountCents: payoutAmountCents,
          stripeErrorType,
          stripeErrorCode,
          trigger,
        },
        stripeError as Error,
      )

      return {
        ok: false,
        errorCode: 'PAYOUT_UNKNOWN',
        errorMessage:
          'Payout submitted but Stripe response was inconclusive. We will reconcile via Stripe webhook within 24 hours; further payout attempts are blocked until the state is confirmed.',
        // 202 Accepted — request received, outcome pending.
        httpStatus: 202,
      }
    }

    // 'definitive' or 'terminal-account': Stripe truly didn't process
    // the transfer. Safe to restore balance + mark 'failed'.
    const isTerminal = errorClass === 'terminal-account'
    let rollbackFailed = false
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(developers)
          .set({
            balanceCents: sql`${developers.balanceCents} + ${grossCents}`,
            updatedAt: new Date(),
            ...(isTerminal
              ? { stripeConnectStatus: 'needs_reconnect' as const }
              : {}),
          })
          .where(eq(developers.id, developerId))

        await tx
          .update(payouts)
          .set({ status: 'failed', errorMessage: errorMsg })
          .where(eq(payouts.id, payoutRecord.id))
      })
    } catch (rollbackErr) {
      rollbackFailed = true
      logger.error(
        'payout.rollback_failed',
        {
          developerId,
          payoutId: payoutRecord.id,
          grossCents,
          originalStripeError: errorMsg,
        },
        rollbackErr as Error,
      )
    }

    logger.error(
      'payout.stripe_transfer_failed',
      {
        developerId,
        payoutId: payoutRecord.id,
        amountCents: payoutAmountCents,
        stripeErrorCode,
        stripeErrorType,
        terminal: isTerminal,
        rollbackFailed,
        trigger,
      },
      stripeError as Error,
    )

    if (rollbackFailed) {
      // Distinct error code so the operator knows the row is stuck in
      // 'processing' with balance=0 — the dev is forever-blocked from
      // new payouts via the partial unique index until either (a) the
      // daily cron's orphan-cleanup fires 24h later (refunds balance,
      // marks 'failed' — see Step 0 in process-payouts/route.ts), or
      // (b) the founder manually reconciles. The 500 is honest about
      // the immediate inconsistent state.
      return {
        ok: false,
        errorCode: 'PAYOUT_RECONCILE_REQUIRED',
        errorMessage:
          'Payout failed and automatic rollback also failed. Your balance and payout record are temporarily out of sync. Reconciliation will run within 24 hours; contact support if it does not resolve.',
        httpStatus: 500,
      }
    }

    return {
      ok: false,
      errorCode: isTerminal ? 'NEEDS_RECONNECT' : 'STRIPE_TRANSFER_FAILED',
      errorMessage: isTerminal
        ? 'Stripe Connect account is no longer accepting payouts. Reconnect required.'
        : `Payout failed: ${errorMsg}`,
      httpStatus: 502,
    }
  }

  // ── Phase 3: mark completed (with retry, CAS-conditional) ──────────
  //
  // The Stripe transfer succeeded; our DB needs to record it. Up to
  // four attempts: an initial try plus three retries with 100/500/
  // 2000ms backoff between successive failures. If all four full
  // UPDATEs fail (DB outage), we make one last single-column attempt
  // to write at least `stripeTransferId` — enough for the orphan-
  // cleanup path in `/api/cron/process-payouts` to recognize the row
  // as "Stripe paid, we just lost the result" and recover correctly
  // up to 24h later. If even the single-column attempt fails, we log
  // critical and return PAYOUT_PARTIAL_SUCCESS.
  //
  // CAS guard: the UPDATE is conditional on status='processing'. If
  // a Stripe `transfer.reversed` webhook fires between our preflight
  // commit and Stripe's transfers.create resolving (Stripe ships
  // webhooks in parallel with the SDK return), the webhook handler
  // may have already flipped the row to 'failed' + refunded balance.
  // Without the CAS guard we'd unconditionally write 'completed' on
  // top, blasting the refund and producing a silent double-pay. The
  // guard makes the UPDATE a no-op in that race; we detect via empty
  // .returning() and log the lost-race for ops visibility.
  const RETRY_BACKOFF_MS = [100, 500, 2000]
  const MAX_COMPLETION_ATTEMPTS = 1 + RETRY_BACKOFF_MS.length
  let completionErr: Error | null = null
  let casLost = false
  for (let i = 0; i < MAX_COMPLETION_ATTEMPTS; i++) {
    try {
      const updated = await db
        .update(payouts)
        .set({ status: 'completed', stripeTransferId: transfer.id })
        .where(
          and(
            eq(payouts.id, payoutRecord.id),
            eq(payouts.status, 'processing'),
          ),
        )
        .returning({ id: payouts.id })
      if (updated.length === 0) {
        // Race-lost: a webhook (transfer.reversed) or another path
        // already moved the row out of 'processing'. The webhook
        // handler is the authoritative state writer in that case;
        // we DO NOT overwrite. Log loudly so ops see the timeline.
        casLost = true
        logger.warn('payout.completion_update_cas_lost', {
          developerId,
          payoutId: payoutRecord.id,
          stripeTransferId: transfer.id,
          message: 'webhook (likely transfer.reversed) flipped status before our completion UPDATE; honoring webhook state',
        })
      }
      completionErr = null
      break
    } catch (err) {
      completionErr = err as Error
      // Sleep BEFORE the next retry, never after the final attempt.
      if (i < RETRY_BACKOFF_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS[i]))
      }
    }
  }

  if (casLost) {
    // The webhook already transitioned the row. Return success at the
    // helper level — the dev's outcome is captured in the webhook
    // path. The trigger button / cron will see the final status on
    // their next refresh.
    return {
      ok: true,
      payoutId: payoutRecord.id,
      amountCents: payoutAmountCents,
      platformFeeCents,
      grossCents,
      stripeTransferId: transfer.id,
      createdAt: payoutRecord.createdAt,
    }
  }

  if (completionErr) {
    // Fallback: try to at least stamp `stripeTransferId` so orphan
    // cleanup can route this row to 'completed' rather than 'failed'
    // (which would silently lose a real Stripe payment). Same CAS
    // guard so we don't overwrite a webhook-set 'failed' state.
    try {
      await db
        .update(payouts)
        .set({ stripeTransferId: transfer.id })
        .where(
          and(
            eq(payouts.id, payoutRecord.id),
            eq(payouts.status, 'processing'),
          ),
        )
      logger.error(
        'payout.completion_update_exhausted_partial_recovery',
        {
          developerId,
          payoutId: payoutRecord.id,
          stripeTransferId: transfer.id,
          amountCents: payoutAmountCents,
          trigger,
        },
        completionErr,
      )
    } catch (fallbackErr) {
      // Worst case: row stays 'processing' with no stripeTransferId.
      // Operator must reconcile via Stripe's transfer log + payoutId
      // metadata. Orphan cleanup will eventually mark this row 'failed'
      // and restore balance — which is WRONG given Stripe paid out, so
      // we surface this loudly enough that ops can intervene first.
      logger.error(
        'payout.completion_update_exhausted_fully',
        {
          developerId,
          payoutId: payoutRecord.id,
          stripeTransferId: transfer.id,
          amountCents: payoutAmountCents,
          trigger,
          fallbackErr: (fallbackErr as Error).message,
        },
        completionErr,
      )
    }

    return {
      ok: false,
      errorCode: 'PAYOUT_PARTIAL_SUCCESS',
      errorMessage: `Payout transferred (Stripe id ${transfer.id}) but our records are out of sync. Reconciliation will run within 24 hours; further payout attempts are blocked until then.`,
      // 200 because the money DID move; this is a database-sync issue,
      // not a payment failure. Caller (UI) treats this as a success
      // toast with a reconciliation note.
      httpStatus: 200,
    }
  }

  // Fire-and-forget audit + email — observability/notification, must
  // not affect transactional correctness. `writeAuditLog` swallows its
  // own errors internally (lib/audit.ts), so no .catch() is needed
  // here. `sendEmail` propagates errors, so its .catch() is real.
  writeAuditLog({
    developerId,
    action: 'payout.triggered',
    resourceType: 'payout',
    resourceId: payoutRecord.id,
    details: {
      amountCents: payoutAmountCents,
      platformFeeCents,
      grossCents,
      stripeTransferId: transfer.id,
      trigger,
    },
    ipAddress,
  })

  if (developerEmail) {
    const displayName = developerName ?? developerEmail
    const template = payoutNotificationEmail(displayName, payoutAmountCents)
    sendEmail({
      to: developerEmail,
      subject: template.subject,
      html: template.html,
    }).catch((err) =>
      logger.error('payout.email_failed', { developerId }, err),
    )
  }

  return {
    ok: true,
    payoutId: payoutRecord.id,
    amountCents: payoutAmountCents,
    platformFeeCents,
    grossCents,
    stripeTransferId: transfer.id,
    createdAt: payoutRecord.createdAt,
  }
}
