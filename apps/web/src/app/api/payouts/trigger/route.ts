import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, payouts } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getStripeSecretKey } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { payoutNotificationEmail, sendEmail } from '@/lib/email'
import { calculateTakeCents } from '@/lib/pricing'

export const maxDuration = 60

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  })
}

/**
 * Postgres unique-constraint-violation detector for the partial
 * unique index `payouts_one_processing_per_dev` (migration 0009).
 *
 * The `postgres` driver throws errors with `.code === '23505'` for
 * unique violations, plus `.constraint_name` set to the offending
 * index. We narrow to our specific index so an unrelated future
 * unique constraint doesn't accidentally get treated as a concurrent
 * payout collision.
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
  developerId: string
  developerEmail: string
  developerName: string | null
  stripeConnectId: string
}

interface PreflightFail {
  ok: false
  status: number
  code:
    | 'NOT_FOUND'
    | 'STRIPE_NOT_ACTIVE'
    | 'NO_STRIPE_ACCOUNT'
    | 'BELOW_MINIMUM'
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `payout-trigger:${ip}`)
    if (!rateLimit.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
      )
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    // ── Phase 1: serialized preflight ─────────────────────────────────────
    //
    // SELECT ... FOR UPDATE locks the developer row for the duration of
    // the transaction. A concurrent POST to this route for the same
    // developer waits on the lock, then sees the post-commit state
    // (balance = 0) and bails out with BELOW_MINIMUM. The partial
    // unique index `payouts_one_processing_per_dev` (migration 0009)
    // is a defense-in-depth backstop — if a second attempt somehow
    // reaches the INSERT in the same transaction window, the unique
    // constraint rejects it and we return 409 PAYOUT_IN_PROGRESS.
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
          })
          .from(developers)
          .where(eq(developers.id, auth.id))
          .for('update')
          .limit(1)

        if (!developer) {
          return {
            ok: false as const,
            status: 404,
            code: 'NOT_FOUND' as const,
            message: 'Developer not found.',
          }
        }

        if (developer.stripeConnectStatus !== 'active') {
          return {
            ok: false as const,
            status: 400,
            code: 'STRIPE_NOT_ACTIVE' as const,
            message:
              'Stripe Connect account must be active to trigger payouts. Complete onboarding first.',
          }
        }

        if (!developer.stripeConnectId) {
          return {
            ok: false as const,
            status: 400,
            code: 'NO_STRIPE_ACCOUNT' as const,
            message:
              'No Stripe Connect account found. Complete onboarding first.',
          }
        }

        if (developer.balanceCents < developer.payoutMinimumCents) {
          return {
            ok: false as const,
            status: 400,
            code: 'BELOW_MINIMUM' as const,
            message: `Balance ($${(developer.balanceCents / 100).toFixed(2)}) is below the minimum payout threshold ($${(developer.payoutMinimumCents / 100).toFixed(2)}).`,
          }
        }

        // Snapshot balance, compute take, debit balance — all atomic.
        const grossCents = developer.balanceCents
        const platformFeeCents = calculateTakeCents(grossCents)
        const payoutAmountCents = grossCents - platformFeeCents

        const now = new Date()
        const [payoutRecord] = await tx
          .insert(payouts)
          .values({
            developerId: developer.id,
            amountCents: payoutAmountCents,
            platformFeeCents,
            periodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
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
          developerId: developer.id,
          developerEmail: developer.email,
          developerName: developer.name,
          stripeConnectId: developer.stripeConnectId,
        }
      })
    } catch (txErr) {
      if (isConcurrentPayoutCollision(txErr)) {
        return errorResponse(
          'A payout is already in progress for this account. Wait for it to complete and try again.',
          409,
          'PAYOUT_IN_PROGRESS',
        )
      }
      throw txErr
    }

    if (!preflight.ok) {
      return errorResponse(preflight.message, preflight.status, preflight.code)
    }

    const {
      payoutRecord,
      payoutAmountCents,
      platformFeeCents,
      grossCents,
      developerId,
      developerEmail,
      developerName,
      stripeConnectId,
    } = preflight

    // ── Phase 2: Stripe transfer with idempotency key ────────────────────
    //
    // The idempotency key is the payout row id — Stripe deduplicates
    // by this key for 24h, so a Vercel cron retry or transient
    // network error doesn't double-pay. Each new payout row gets a
    // fresh id, so legitimate subsequent payouts use a different key.
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
          },
        },
        { idempotencyKey: `payout:${payoutRecord.id}` },
      )
    } catch (stripeError) {
      // Stripe call failed AFTER we zeroed the balance. Restore the
      // balance + mark payout failed in a single transaction so the
      // developer's accumulated revenue isn't lost. Terminal account
      // errors (account_invalid, insufficient_capabilities) flip the
      // dev's connect status so the cron stops retrying daily.
      const errorMsg =
        stripeError instanceof Error
          ? stripeError.message
          : 'Unknown Stripe error'
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
        // Last-ditch logging — if the rollback transaction itself
        // fails, manual reconciliation is required. Surface loudly.
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
        },
        stripeError as Error,
      )

      return errorResponse(
        isTerminal
          ? `Stripe Connect account is no longer accepting payouts. Reconnect required.`
          : `Payout failed: ${errorMsg}`,
        502,
        isTerminal ? 'NEEDS_RECONNECT' : 'STRIPE_TRANSFER_FAILED',
      )
    }

    // ── Phase 3: mark completed ──────────────────────────────────────────
    //
    // Single UPDATE — no transaction needed since balance was already
    // debited atomically in Phase 1. If this UPDATE fails, the Stripe
    // transfer succeeded but the row stays 'processing'. The orphan
    // 'processing' row also blocks future payouts via the partial
    // unique index until reconciled. Manual reconciliation is required
    // until a future reconcile job is built; the Stripe transfer's
    // metadata.payoutId is the join key.
    await db
      .update(payouts)
      .set({ status: 'completed', stripeTransferId: transfer.id })
      .where(eq(payouts.id, payoutRecord.id))

    // Fire-and-forget audit + email — these are observability/
    // notification side effects that must not block the response or
    // affect transactional correctness. Any failure here is logged,
    // not propagated.
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
      },
      ipAddress: ip,
    }).catch((err) =>
      logger.error('payout.audit_log_failed', { payoutId: payoutRecord.id }, err),
    )

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

    return successResponse({
      payout: {
        id: payoutRecord.id,
        amountCents: payoutAmountCents,
        platformFeeCents,
        stripeTransferId: transfer.id,
        status: 'completed',
        createdAt: payoutRecord.createdAt,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
