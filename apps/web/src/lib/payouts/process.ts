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
 * unique index `payouts_one_processing_per_dev` (migration 0009).
 */
function isConcurrentPayoutCollision(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: string; constraint_name?: string }
  return (
    e.code === '23505' &&
    e.constraint_name === 'payouts_one_processing_per_dev'
  )
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
    const isTerminal =
      stripeErrorCode === 'account_invalid' ||
      stripeErrorCode === 'insufficient_capabilities'

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
        terminal: isTerminal,
        trigger,
      },
      stripeError as Error,
    )

    return {
      ok: false,
      errorCode: isTerminal ? 'NEEDS_RECONNECT' : 'STRIPE_TRANSFER_FAILED',
      errorMessage: isTerminal
        ? 'Stripe Connect account is no longer accepting payouts. Reconnect required.'
        : `Payout failed: ${errorMsg}`,
      httpStatus: 502,
    }
  }

  // ── Phase 3: mark completed (with retry) ────────────────────────────
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
  const RETRY_BACKOFF_MS = [100, 500, 2000]
  const MAX_COMPLETION_ATTEMPTS = 1 + RETRY_BACKOFF_MS.length
  let completionErr: Error | null = null
  for (let i = 0; i < MAX_COMPLETION_ATTEMPTS; i++) {
    try {
      await db
        .update(payouts)
        .set({ status: 'completed', stripeTransferId: transfer.id })
        .where(eq(payouts.id, payoutRecord.id))
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

  if (completionErr) {
    // Fallback: try to at least stamp `stripeTransferId` so orphan
    // cleanup can route this row to 'completed' rather than 'failed'
    // (which would silently lose a real Stripe payment).
    try {
      await db
        .update(payouts)
        .set({ stripeTransferId: transfer.id })
        .where(eq(payouts.id, payoutRecord.id))
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
