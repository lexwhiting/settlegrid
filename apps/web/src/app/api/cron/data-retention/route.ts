import { NextRequest } from 'next/server'
import { eq, and, or, lt, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  developers,
  tools,
  invocations,
  webhookDeliveries,
  webhookEndpoints,
  auditLogs,
  toolHealthChecks,
  conversionEvents,
  complianceExports,
} from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { verifyCronAuth } from '@/lib/cron-auth'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { processDataDeletion } from '@/lib/settlement/compliance'

export const maxDuration = 300 // 5 minutes — may process many developers

const BATCH_SIZE = 1000

/**
 * Vercel Cron handler: purges expired data based on each developer's
 * retention settings (logRetentionDays, webhookLogRetentionDays,
 * auditLogRetentionDays). Also purges high-volume tables on a
 * hardcoded schedule (health checks 90d, conversion events 180d,
 * completed compliance exports 30d).
 *
 * Schedule: daily at 03:00 UTC
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-data-retention:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const auth = verifyCronAuth(request.headers)
    if (auth === 'no-secret') {
      logger.error('cron.data_retention.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (auth === 'unauthorized') {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const totals = {
      invocations: 0,
      webhookDeliveries: 0,
      auditLogs: 0,
      healthChecks: 0,
      conversionEvents: 0,
      complianceExports: 0,
      developersProcessed: 0,
      deletionsRecovered: 0,
    }

    // ── 1. Per-developer retention purge ──────────────────────────────

    const allDevelopers = await db
      .select({
        id: developers.id,
        logRetentionDays: developers.logRetentionDays,
        webhookLogRetentionDays: developers.webhookLogRetentionDays,
        auditLogRetentionDays: developers.auditLogRetentionDays,
      })
      .from(developers)
      .limit(10000)

    for (const dev of allDevelopers) {
      // a. Purge invocations older than logRetentionDays (0 = keep forever)
      if (dev.logRetentionDays > 0) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - dev.logRetentionDays)
        const cutoffIso = cutoff.toISOString()

        // Get tool IDs for this developer
        const devTools = await db
          .select({ id: tools.id })
          .from(tools)
          .where(eq(tools.developerId, dev.id))

        const toolIds = devTools.map((t) => t.id)

        if (toolIds.length > 0) {
          let deleted = BATCH_SIZE
          while (deleted === BATCH_SIZE) {
            const idsToDelete = await db
              .select({ id: invocations.id })
              .from(invocations)
              .where(
                and(
                  inArray(invocations.toolId, toolIds),
                  lt(invocations.createdAt, sql`${cutoffIso}::timestamptz`)
                )
              )
              .limit(BATCH_SIZE)

            if (idsToDelete.length === 0) break
            deleted = idsToDelete.length

            await db
              .delete(invocations)
              .where(inArray(invocations.id, idsToDelete.map((r) => r.id)))

            totals.invocations += deleted
          }
        }
      }

      // b. Purge webhook_deliveries older than webhookLogRetentionDays
      if (dev.webhookLogRetentionDays > 0) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - dev.webhookLogRetentionDays)
        const cutoffIso = cutoff.toISOString()

        // Get webhook endpoint IDs for this developer
        const devEndpoints = await db
          .select({ id: webhookEndpoints.id })
          .from(webhookEndpoints)
          .where(eq(webhookEndpoints.developerId, dev.id))

        const endpointIds = devEndpoints.map((e) => e.id)

        if (endpointIds.length > 0) {
          let deleted = BATCH_SIZE
          while (deleted === BATCH_SIZE) {
            const idsToDelete = await db
              .select({ id: webhookDeliveries.id })
              .from(webhookDeliveries)
              .where(
                and(
                  inArray(webhookDeliveries.endpointId, endpointIds),
                  lt(webhookDeliveries.createdAt, sql`${cutoffIso}::timestamptz`)
                )
              )
              .limit(BATCH_SIZE)

            if (idsToDelete.length === 0) break
            deleted = idsToDelete.length

            await db
              .delete(webhookDeliveries)
              .where(inArray(webhookDeliveries.id, idsToDelete.map((r) => r.id)))

            totals.webhookDeliveries += deleted
          }
        }
      }

      // c. Purge audit_logs older than auditLogRetentionDays
      if (dev.auditLogRetentionDays > 0) {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - dev.auditLogRetentionDays)
        const cutoffIso = cutoff.toISOString()

        let deleted = BATCH_SIZE
        while (deleted === BATCH_SIZE) {
          const idsToDelete = await db
            .select({ id: auditLogs.id })
            .from(auditLogs)
            .where(
              and(
                eq(auditLogs.developerId, dev.id),
                lt(auditLogs.createdAt, sql`${cutoffIso}::timestamptz`)
              )
            )
            .limit(BATCH_SIZE)

          if (idsToDelete.length === 0) break
          deleted = idsToDelete.length

          await db
            .delete(auditLogs)
            .where(inArray(auditLogs.id, idsToDelete.map((r) => r.id)))

          totals.auditLogs += deleted
        }
      }

      totals.developersProcessed++
    }

    // ── 2. Global hardcoded retention purge ──────────────────────────

    // d. tool_health_checks older than 90 days
    {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 90)
      const cutoffIso = cutoff.toISOString()

      let deleted = BATCH_SIZE
      while (deleted === BATCH_SIZE) {
        const idsToDelete = await db
          .select({ id: toolHealthChecks.id })
          .from(toolHealthChecks)
          .where(lt(toolHealthChecks.checkedAt, sql`${cutoffIso}::timestamptz`))
          .limit(BATCH_SIZE)

        if (idsToDelete.length === 0) break
        deleted = idsToDelete.length

        await db
          .delete(toolHealthChecks)
          .where(inArray(toolHealthChecks.id, idsToDelete.map((r) => r.id)))

        totals.healthChecks += deleted
      }
    }

    // e. conversion_events older than 180 days
    {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 180)
      const cutoffIso = cutoff.toISOString()

      let deleted = BATCH_SIZE
      while (deleted === BATCH_SIZE) {
        const idsToDelete = await db
          .select({ id: conversionEvents.id })
          .from(conversionEvents)
          .where(lt(conversionEvents.createdAt, sql`${cutoffIso}::timestamptz`))
          .limit(BATCH_SIZE)

        if (idsToDelete.length === 0) break
        deleted = idsToDelete.length

        await db
          .delete(conversionEvents)
          .where(inArray(conversionEvents.id, idsToDelete.map((r) => r.id)))

        totals.conversionEvents += deleted
      }
    }

    // ── 3. Purge completed compliance_exports older than 30 days ─────
    {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const cutoffIso = cutoff.toISOString()

      let deleted = BATCH_SIZE
      while (deleted === BATCH_SIZE) {
        const idsToDelete = await db
          .select({ id: complianceExports.id })
          .from(complianceExports)
          .where(
            and(
              eq(complianceExports.status, 'completed'),
              lt(complianceExports.completedAt, sql`${cutoffIso}::timestamptz`)
            )
          )
          .limit(BATCH_SIZE)

        if (idsToDelete.length === 0) break
        deleted = idsToDelete.length

        await db
          .delete(complianceExports)
          .where(inArray(complianceExports.id, idsToDelete.map((r) => r.id)))

        totals.complianceExports += deleted
      }
    }

    // ── 4. Recover wedged GDPR account-deletions (§13.7b) ────────────────
    //    The deletion endpoint runs processDataDeletion SYNCHRONOUSLY. A run that
    //    TIMED OUT mid-scrub dies before its catch → the compliance_exports row
    //    wedges at 'processing'; a run that threw lands at 'failed' (retryable).
    //    A wedged run usually has the Supabase auth user already deleted (pre-txn)
    //    and, if it reached the F-B1 pre-commit, the account DEACTIVATED — the user
    //    is locked out with the erasure INCOMPLETE, and there is NO async processor.
    //    (A run that failed BEFORE the pre-commit may be only partially advanced;
    //    the idempotent re-run completes it either way.) Re-drive them here: ALERT on
    //    each, reset a stale 'processing' row to 'failed' so processDataDeletion's
    //    pending/failed guard proceeds (it THROWS on 'processing'), then re-run it
    //    (in-txn revoke/scrub are idempotent backstops). Staleness keys on createdAt
    //    with a threshold (15m) ≫ the endpoint's 60s maxDuration, so a fresh run is
    //    never reset; a reused long-stranded 'pending' row is the one edge, tolerated
    //    because the re-run is idempotent. The reset is a COMPARE-AND-SET (only if
    //    still 'processing') so a row that completed meanwhile is never reverted.
    //    Capped per run.
    {
      const STALE_PROCESSING_MS = 15 * 60 * 1000 // 15 min ≫ the 60s endpoint maxDuration
      const RECOVERY_CAP = 50
      const staleCutoffIso = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()

      const wedged = await db
        .select({ id: complianceExports.id, status: complianceExports.status })
        .from(complianceExports)
        .where(
          and(
            eq(complianceExports.requestType, 'data-deletion'),
            or(
              eq(complianceExports.status, 'failed'),
              and(
                eq(complianceExports.status, 'processing'),
                lt(complianceExports.createdAt, sql`${staleCutoffIso}::timestamptz`)
              )
            )
          )
        )
        .limit(RECOVERY_CAP)

      for (const row of wedged) {
        // ALERT (§13.7a): surface every wedged/failed deletion (no async actor else).
        logger.error('compliance.account_deletion.recovery', { exportId: row.id, status: row.status })
        try {
          // A wedged 'processing' run is dead → reset so the guard re-drives it.
          // COMPARE-AND-SET on status: never revert a row that completed (or moved
          // on) between the batch SELECT and this UPDATE.
          if (row.status === 'processing') {
            await db
              .update(complianceExports)
              .set({ status: 'failed' })
              .where(and(eq(complianceExports.id, row.id), eq(complianceExports.status, 'processing')))
          }
          const result = await processDataDeletion(row.id)
          if (result.status === 'completed') {
            totals.deletionsRecovered++
          } else {
            logger.error('compliance.account_deletion.recovery_failed', {
              exportId: row.id,
              status: result.status,
            })
          }
        } catch (err) {
          logger.error('compliance.account_deletion.recovery_failed', { exportId: row.id }, err)
        }
      }
    }

    logger.info('cron.data_retention.completed', totals)

    return successResponse({
      message: 'Data retention purge completed',
      ...totals,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
