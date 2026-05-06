/**
 * P5.PAYOUTS-4 — Daily payout cron.
 *
 * Runs daily at 12:00 UTC. For every developer with:
 *   - stripeConnectStatus === 'active'
 *   - balance >= payoutMinimumCents
 *   - no payout row in the last 23h (cooldown — covers same-day
 *     double-pay AND Vercel cron retry mid-run)
 * calls processPayout() to credit them once. Per-developer try/catch
 * so one failure doesn't block the rest of the run.
 *
 * The 23h cooldown matches Stripe's idempotency-key TTL of 24h: if
 * yesterday's run partially completed and a developer's row already
 * exists with status='processing' or 'completed' from that run, we
 * skip. The Phase-1 partial unique index also protects against this
 * at the DB layer — the cooldown is just a cheap pre-filter.
 *
 * Schedule simplification: ignores `developers.payout_schedule_*`
 * columns entirely (those are a 1h-TTL cache of Stripe's connected-
 * account → bank schedule, NOT a platform-controlled scheduling
 * input). Daily-for-everyone keeps the ops surface tiny; if a
 * developer wants less frequent transfers they can raise their
 * payoutMinimumCents.
 *
 * Pre-flight: confirms platform Stripe balance >= sum(eligible
 * developer balances). If short, the run aborts and logs — Vercel
 * will retry on the next schedule, by which time auto-payouts to
 * the platform may have settled. This avoids creating Stripe
 * transfers that will fail with INSUFFICIENT_FUNDS at the platform
 * level and rollback en masse.
 */

import { NextRequest } from 'next/server'
import { and, eq, gte, sql } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { developers, payouts as payoutsTable } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { getCronSecret, getStripeSecretKey } from '@/lib/env'
import { logger } from '@/lib/logger'
import { processPayout } from '@/lib/payouts/process'
import { calculateTakeCents } from '@/lib/pricing'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

export const maxDuration = 300 // 5 min — generous for ≤ ~hundreds of devs

interface DeveloperOutcome {
  developerId: string
  ok: boolean
  errorCode?: string
  amountCents?: number
  payoutId?: string
}

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  })
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-process-payouts:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.process_payouts.no_secret', {})
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // ── Step 0: orphan-row cleanup ───────────────────────────────────────
    //
    // A row stuck in status='processing' from a previous run blocks the
    // partial unique index from accepting a new attempt for that
    // developer. Two distinct shapes of orphan, handled differently:
    //
    //   A. stripe_transfer_id IS NULL → the Stripe transfer was never
    //      created (lambda died before/during the call, or before the
    //      completion UPDATE). The developer's balance was already
    //      debited in preflight; we MUST restore it, otherwise that
    //      money is silently lost. Mark 'failed', refund balance.
    //
    //   B. stripe_transfer_id IS NOT NULL → the Stripe transfer DID
    //      complete (the completion UPDATE wrote the id but failed to
    //      flip status to 'completed'; or the partial-recovery
    //      single-column UPDATE in process.ts:Phase 3 fired). Stripe
    //      really paid the dev. Mark 'completed' (the status it should
    //      have reached); do NOT touch balance (correctly debited).
    //
    // 24h matches Stripe's idempotency-key TTL — past that we know any
    // orphan is unrecoverable via auto-retry from the original caller.
    //
    // The whole orphan sweep runs per-row in its own transaction so a
    // single bad row can't poison the whole sweep.
    try {
      const orphans = await db
        .select({
          id: payoutsTable.id,
          developerId: payoutsTable.developerId,
          amountCents: payoutsTable.amountCents,
          platformFeeCents: payoutsTable.platformFeeCents,
          stripeTransferId: payoutsTable.stripeTransferId,
        })
        .from(payoutsTable)
        .where(
          and(
            eq(payoutsTable.status, 'processing'),
            sql`${payoutsTable.createdAt} < NOW() - INTERVAL '24 hours'`,
          ),
        )
        .limit(100)

      let releasedFailed = 0
      let releasedCompleted = 0
      for (const orphan of orphans) {
        try {
          if (orphan.stripeTransferId) {
            // Shape B: Stripe paid, our row stuck. Recover to
            // 'completed'. Conditional UPDATE acts as a CAS — only
            // succeeds if status is still 'processing'. If a concurrent
            // cron run already processed this orphan, our UPDATE
            // returns 0 rows and we no-op.
            const claimed = await db
              .update(payoutsTable)
              .set({
                status: 'completed',
                errorMessage: 'auto-recovered: stripe transfer succeeded; row stuck in processing > 24h',
              })
              .where(
                and(
                  eq(payoutsTable.id, orphan.id),
                  eq(payoutsTable.status, 'processing'),
                ),
              )
              .returning({ id: payoutsTable.id })
            if (claimed.length === 0) {
              logger.info('cron.process_payouts.orphan_already_handled', {
                payoutId: orphan.id,
                shape: 'B',
              })
              continue
            }
            releasedCompleted += 1
            logger.warn('cron.process_payouts.orphan_recovered_to_completed', {
              payoutId: orphan.id,
              developerId: orphan.developerId,
              stripeTransferId: orphan.stripeTransferId,
            })
            // Best-effort audit log so the founder/operator has a paper
            // trail of silent recoveries. writeAuditLog swallows its
            // own errors so this can't poison the loop.
            await writeAuditLog({
              developerId: orphan.developerId,
              action: 'payout.auto_recovered_to_completed',
              resourceType: 'payout',
              resourceId: orphan.id,
              details: {
                stripeTransferId: orphan.stripeTransferId,
                amountCents: orphan.amountCents,
                platformFeeCents: orphan.platformFeeCents,
                reason: 'stuck_processing_with_stripe_transfer',
              },
            })
          } else {
            // Shape A: no Stripe transfer. Refund balance + mark
            // 'failed' inside a transaction. The status UPDATE is
            // CAS-conditional (WHERE status='processing'); if a
            // concurrent run already won, the UPDATE returns 0 rows
            // and we abort the whole tx so balance is NOT incremented.
            const grossCents = orphan.amountCents + orphan.platformFeeCents
            const claimed = await db.transaction(async (tx) => {
              const released = await tx
                .update(payoutsTable)
                .set({
                  status: 'failed',
                  errorMessage: 'auto-released: stuck in processing > 24h, no stripe transfer recorded',
                })
                .where(
                  and(
                    eq(payoutsTable.id, orphan.id),
                    eq(payoutsTable.status, 'processing'),
                  ),
                )
                .returning({ id: payoutsTable.id })
              if (released.length === 0) return false
              await tx
                .update(developers)
                .set({
                  balanceCents: sql`${developers.balanceCents} + ${grossCents}`,
                  updatedAt: new Date(),
                })
                .where(eq(developers.id, orphan.developerId))
              return true
            })
            if (!claimed) {
              logger.info('cron.process_payouts.orphan_already_handled', {
                payoutId: orphan.id,
                shape: 'A',
              })
              continue
            }
            releasedFailed += 1
            logger.warn('cron.process_payouts.orphan_released_to_failed', {
              payoutId: orphan.id,
              developerId: orphan.developerId,
              refundedCents: grossCents,
            })
          }
        } catch (perRowErr) {
          logger.error(
            'cron.process_payouts.orphan_per_row_failed',
            { payoutId: orphan.id, developerId: orphan.developerId },
            perRowErr as Error,
          )
        }
      }
      if (releasedFailed + releasedCompleted > 0) {
        logger.info('cron.process_payouts.orphan_sweep_complete', {
          releasedFailed,
          releasedCompleted,
          totalScanned: orphans.length,
        })
      }
    } catch (err) {
      // Don't bail on orphan-cleanup failure — log and proceed; the
      // affected developers will be skipped this run via the partial
      // unique index, and we'll retry next run.
      logger.error('cron.process_payouts.orphan_release_failed', {}, err as Error)
    }

    // ── Step 1: select eligible developers ───────────────────────────────
    //
    // SQL filter:
    //   stripe_connect_status = 'active'
    //   balance_cents >= payout_minimum_cents
    //   NOT EXISTS (recent payouts row for this developer in the last
    //               23h with status processing|completed)
    //
    // The "last 23h" cooldown uses NOW() - INTERVAL '23 hours'. We use
    // 23h (not 24h) so a daily cron with a few minutes of jitter
    // doesn't accidentally skip a developer because of clock drift.
    const eligible = await db
      .select({
        id: developers.id,
        balanceCents: developers.balanceCents,
      })
      .from(developers)
      .where(
        and(
          eq(developers.stripeConnectStatus, 'active'),
          gte(developers.balanceCents, developers.payoutMinimumCents),
          sql`NOT EXISTS (
            SELECT 1 FROM ${payoutsTable}
            WHERE ${payoutsTable.developerId} = ${developers.id}
              AND ${payoutsTable.createdAt} > NOW() - INTERVAL '23 hours'
              AND ${payoutsTable.status} IN ('processing', 'completed')
          )`,
        ),
      )
      .limit(1000) // Safety cap; raises into the thousands as the platform scales.

    if (eligible.length === 0) {
      logger.info('cron.process_payouts.no_eligible', {})
      return successResponse({
        processedCount: 0,
        succeededCount: 0,
        failedCount: 0,
        outcomes: [],
      })
    }

    // ── Step 2: pre-flight platform Stripe balance check ─────────────────
    //
    // Sum eligible NET payouts (gross - progressive take); if the
    // platform's available USD balance is less than that, abort the
    // run rather than create transfers that will collectively fail.
    // The platform balance can be < expected if Stripe auto-paid out
    // to the founder's bank, or if a recent batch hasn't settled.
    //
    // We compare net (not gross) because the platform fee never leaves
    // Stripe — only the developer payout amount is transferred out.
    const totalEligibleCents = eligible.reduce((sum, d) => {
      const net = d.balanceCents - calculateTakeCents(d.balanceCents)
      return sum + net
    }, 0)
    try {
      const stripe = getStripe()
      const balance = await stripe.balance.retrieve()
      const availableUsd = balance.available.find((b) => b.currency === 'usd')
      const availableCents = availableUsd?.amount ?? 0
      if (availableCents < totalEligibleCents) {
        logger.error('cron.process_payouts.insufficient_platform_balance', {
          availableCents,
          totalEligibleCents,
          eligibleCount: eligible.length,
        })
        return errorResponse(
          'Insufficient platform balance for this run.',
          503,
          'INSUFFICIENT_PLATFORM_BALANCE',
        )
      }
    } catch (err) {
      // Don't proceed if we can't even read the balance — better to
      // skip a run than to fire blind.
      logger.error('cron.process_payouts.balance_check_failed', {}, err as Error)
      return errorResponse(
        'Unable to verify platform balance.',
        503,
        'BALANCE_CHECK_FAILED',
      )
    }

    // ── Step 3: per-developer payout (sequential, isolated try/catch) ────
    //
    // Sequential rather than parallel: simpler reasoning under
    // concurrency, easier per-dev outcome tracking, and the Stripe
    // API rate-limits are well above the per-second rate at this
    // scale (≤ tens of devs/day).
    const outcomes: DeveloperOutcome[] = []
    let succeededCount = 0
    let failedCount = 0

    for (const dev of eligible) {
      try {
        const result = await processPayout({
          developerId: dev.id,
          trigger: 'cron',
        })
        if (result.ok) {
          outcomes.push({
            developerId: dev.id,
            ok: true,
            amountCents: result.amountCents,
            payoutId: result.payoutId,
          })
          succeededCount += 1
          logger.info('cron.process_payouts.developer_succeeded', {
            developerId: dev.id,
            payoutId: result.payoutId,
            amountCents: result.amountCents,
          })
        } else {
          outcomes.push({
            developerId: dev.id,
            ok: false,
            errorCode: result.errorCode,
          })
          failedCount += 1
          logger.warn('cron.process_payouts.developer_failed', {
            developerId: dev.id,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          })
        }
      } catch (err) {
        // Belt-and-suspenders: processPayout shouldn't throw, but if
        // it does, we don't let one explosion stop the whole run.
        outcomes.push({ developerId: dev.id, ok: false, errorCode: 'INTERNAL' })
        failedCount += 1
        logger.error(
          'cron.process_payouts.developer_threw',
          { developerId: dev.id },
          err as Error,
        )
      }
    }

    logger.info('cron.process_payouts.run_complete', {
      processedCount: eligible.length,
      succeededCount,
      failedCount,
    })

    // Cap outcomes in the response body — full per-developer outcomes
    // already went to logger.info above (durable observability), and
    // Vercel's response body limit is 4.5 MB. At 100 outcomes ~ 200 B
    // each ≈ 20 KB, comfortably bounded. Caller still gets accurate
    // counts; the array is a sample for spot-checking.
    const OUTCOMES_CAP = 100
    const outcomesTruncated = outcomes.length > OUTCOMES_CAP
    const outcomesSample = outcomesTruncated ? outcomes.slice(0, OUTCOMES_CAP) : outcomes

    return successResponse({
      processedCount: eligible.length,
      succeededCount,
      failedCount,
      outcomes: outcomesSample,
      outcomesTruncated,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
