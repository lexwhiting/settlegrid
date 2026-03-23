import { NextRequest } from 'next/server'
import { eq, and, lt, inArray, sql } from 'drizzle-orm'
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
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-data-retention:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.data_retention.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
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

    logger.info('cron.data_retention.completed', totals)

    return successResponse({
      message: 'Data retention purge completed',
      ...totals,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
