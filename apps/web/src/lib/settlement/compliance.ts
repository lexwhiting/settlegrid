import { db } from '@/lib/db'
import {
  complianceExports,
  developers,
  consumers,
  tools,
  invocations,
  apiKeys,
  payouts,
  webhookEndpoints,
  referrals,
  auditLogs,
  toolReviews,
} from '@/lib/db/schema'
import { eq, and, gte, desc, inArray } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// ---- Types ------------------------------------------------------------------

export type ComplianceRequestType = 'data-export' | 'data-deletion'
export type ComplianceEntityType = 'customer' | 'provider'
export type ComplianceStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ---- GDPR Data Export -------------------------------------------------------

export async function requestDataExport(
  entityType: ComplianceEntityType,
  entityId: string
): Promise<{ id: string; status: ComplianceStatus }> {
  const [record] = await db
    .insert(complianceExports)
    .values({
      requestType: 'data-export',
      entityType,
      entityId,
      status: 'pending',
    })
    .returning({ id: complianceExports.id, status: complianceExports.status })

  logger.info('compliance.data_export_requested', {
    exportId: record.id,
    entityType,
    entityId,
  })

  return { id: record.id, status: record.status as ComplianceStatus }
}

// ---- GDPR Data Deletion (Right to Erasure) ----------------------------------

export async function requestDataDeletion(
  entityType: ComplianceEntityType,
  entityId: string
): Promise<{ id: string; status: ComplianceStatus }> {
  const [record] = await db
    .insert(complianceExports)
    .values({
      requestType: 'data-deletion',
      entityType,
      entityId,
      status: 'pending',
    })
    .returning({ id: complianceExports.id, status: complianceExports.status })

  logger.info('compliance.data_deletion_requested', {
    exportId: record.id,
    entityType,
    entityId,
  })

  return { id: record.id, status: record.status as ComplianceStatus }
}

// ---- Status Check -----------------------------------------------------------

export async function getExportStatus(
  exportId: string
): Promise<{
  id: string
  requestType: string
  entityType: string
  entityId: string
  status: ComplianceStatus
  resultUrl: string | null
  completedAt: Date | null
  createdAt: Date
} | null> {
  const [record] = await db
    .select()
    .from(complianceExports)
    .where(eq(complianceExports.id, exportId))
    .limit(1)

  if (!record) return null

  return {
    id: record.id,
    requestType: record.requestType,
    entityType: record.entityType,
    entityId: record.entityId,
    status: record.status as ComplianceStatus,
    resultUrl: record.resultUrl,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
  }
}

// ---- Collect Developer Data (GDPR Article 20) --------------------------------

/**
 * Query all developer data from the database for a GDPR data export.
 * Returns a structured JSON object with profile, tools, invocations (last 90 days),
 * payouts, webhooks, referrals, and audit logs.
 */
/** Valid category keys for selective data export */
export type ExportCategory = 'profile' | 'tools' | 'invocations' | 'payouts' | 'webhooks' | 'audit_logs'

export const ALL_EXPORT_CATEGORIES: ExportCategory[] = [
  'profile', 'tools', 'invocations', 'payouts', 'webhooks', 'audit_logs',
]

export async function collectDeveloperData(
  developerId: string,
  categories?: ExportCategory[],
  days?: number,
): Promise<Record<string, unknown>> {
  const lookbackDays = days ?? 90
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)

  const cats = new Set(categories ?? ALL_EXPORT_CATEGORIES)

  // Build parallel query array based on requested categories
  const queries: Promise<unknown>[] = []
  const queryKeys: string[] = []

  if (cats.has('profile')) {
    queryKeys.push('profile')
    queries.push(db.select().from(developers).where(eq(developers.id, developerId)).limit(1))
  }

  if (cats.has('tools')) {
    queryKeys.push('tools')
    queries.push(db.select().from(tools).where(eq(tools.developerId, developerId)).orderBy(desc(tools.createdAt)))
  }

  if (cats.has('invocations')) {
    queryKeys.push('invocations')
    queries.push(
      db
        .select({
          id: invocations.id,
          toolId: invocations.toolId,
          consumerId: invocations.consumerId,
          method: invocations.method,
          costCents: invocations.costCents,
          latencyMs: invocations.latencyMs,
          status: invocations.status,
          isTest: invocations.isTest,
          createdAt: invocations.createdAt,
        })
        .from(invocations)
        .innerJoin(tools, eq(invocations.toolId, tools.id))
        .where(and(eq(tools.developerId, developerId), gte(invocations.createdAt, cutoffDate)))
        .orderBy(desc(invocations.createdAt))
        .limit(10000)
    )
  }

  if (cats.has('payouts')) {
    queryKeys.push('payouts')
    queries.push(db.select().from(payouts).where(eq(payouts.developerId, developerId)).orderBy(desc(payouts.createdAt)))
  }

  if (cats.has('webhooks')) {
    queryKeys.push('webhooks')
    queries.push(
      db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.developerId, developerId))
        .orderBy(desc(webhookEndpoints.createdAt))
    )
  }

  // Referrals are included whenever profile or tools are requested
  if (cats.has('profile') || cats.has('tools')) {
    queryKeys.push('referrals')
    queries.push(db.select().from(referrals).where(eq(referrals.referrerId, developerId)).orderBy(desc(referrals.createdAt)))
  }

  if (cats.has('audit_logs')) {
    queryKeys.push('audit_logs')
    queries.push(
      db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.developerId, developerId), gte(auditLogs.createdAt, cutoffDate)))
        .orderBy(desc(auditLogs.createdAt))
        .limit(5000)
    )
  }

  const results = await Promise.all(queries)

  // Build result map keyed by queryKeys
  const resultMap = new Map<string, unknown>()
  for (let i = 0; i < queryKeys.length; i++) {
    resultMap.set(queryKeys[i], results[i])
  }

  const output: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.1',
    categories: [...cats],
    lookbackDays,
  }

  if (resultMap.has('profile')) {
    const profileRows = resultMap.get('profile') as typeof developers.$inferSelect[]
    output.profile = profileRows[0]
      ? { ...profileRows[0], passwordHash: undefined, apiKeyHash: undefined }
      : null
  }
  if (resultMap.has('tools')) {
    output.tools = resultMap.get('tools')
  }
  if (resultMap.has('invocations')) {
    output.invocations = resultMap.get('invocations')
  }
  if (resultMap.has('payouts')) {
    output.payouts = resultMap.get('payouts')
  }
  if (resultMap.has('webhooks')) {
    const webhookRows = resultMap.get('webhooks') as typeof webhookEndpoints.$inferSelect[]
    output.webhookEndpoints = webhookRows.map((w) => ({
      ...w,
      secret: '[REDACTED]',
    }))
  }
  if (resultMap.has('referrals')) {
    output.referrals = resultMap.get('referrals')
  }
  if (resultMap.has('audit_logs')) {
    output.auditLogs = resultMap.get('audit_logs')
  }

  return output
}

// ---- Process Data Export (GDPR Article 20) ----------------------------------

/**
 * Process a pending data export request.
 * Queries all developer data from the database, encodes it as a base64 data URL,
 * and stores the result in the compliance_exports record.
 */
export async function processDataExport(
  exportId: string,
  categories?: ExportCategory[],
  days?: number,
): Promise<{ status: ComplianceStatus; resultUrl: string | null }> {
  const [record] = await db
    .select()
    .from(complianceExports)
    .where(eq(complianceExports.id, exportId))
    .limit(1)

  if (!record) {
    throw new Error(`Export request not found: ${exportId}`)
  }

  if (record.requestType !== 'data-export') {
    throw new Error(`Not a data-export request: ${record.requestType}`)
  }

  if (record.status !== 'pending') {
    throw new Error(`Export already processed: status=${record.status}`)
  }

  // Mark as processing
  await db
    .update(complianceExports)
    .set({ status: 'processing' })
    .where(eq(complianceExports.id, exportId))

  try {
    // Collect developer data (optionally filtered by categories and time range)
    const exportData = await collectDeveloperData(record.entityId, categories, days)

    // Encode the JSON as a base64 data URL for storage in the DB
    const jsonString = JSON.stringify(exportData, null, 2)
    const base64 = Buffer.from(jsonString, 'utf-8').toString('base64')
    const resultUrl = `data:application/json;base64,${base64}`

    await db
      .update(complianceExports)
      .set({
        status: 'completed',
        resultUrl,
        completedAt: new Date(),
      })
      .where(eq(complianceExports.id, exportId))

    logger.info('compliance.data_export_completed', {
      exportId,
      entityType: record.entityType,
      entityId: record.entityId,
      dataSizeBytes: jsonString.length,
    })

    return { status: 'completed', resultUrl }
  } catch (err) {
    await db
      .update(complianceExports)
      .set({ status: 'failed' })
      .where(eq(complianceExports.id, exportId))

    logger.error('compliance.data_export_failed', { exportId }, err)
    return { status: 'failed', resultUrl: null }
  }
}

// ---- Process Data Deletion (GDPR Article 17) --------------------------------

/**
 * Process a pending data deletion request.
 * Anonymizes PII across all relevant tables in a single transaction.
 * Financial records (payouts, purchases, ledger_entries, settlement_batches)
 * are retained for 7-year IRS / Stripe compliance but PII is scrubbed.
 *
 * Idempotent: re-running on an already-anonymized developer is a no-op
 * for each individual step (UPDATE ... SET name = '[Deleted]' WHERE id = X
 * is safe to run twice).
 */
export async function processDataDeletion(
  exportId: string
): Promise<{ status: ComplianceStatus }> {
  const [record] = await db
    .select()
    .from(complianceExports)
    .where(eq(complianceExports.id, exportId))
    .limit(1)

  if (!record) {
    throw new Error(`Deletion request not found: ${exportId}`)
  }

  if (record.requestType !== 'data-deletion') {
    throw new Error(`Not a data-deletion request: ${record.requestType}`)
  }

  if (record.status !== 'pending') {
    throw new Error(`Deletion already processed: status=${record.status}`)
  }

  const developerId = record.entityId

  // Mark as processing
  await db
    .update(complianceExports)
    .set({ status: 'processing' })
    .where(eq(complianceExports.id, exportId))

  try {
    // Look up developer to get email for consumer cross-reference
    const [dev] = await db
      .select({ id: developers.id, email: developers.email })
      .from(developers)
      .where(eq(developers.id, developerId))
      .limit(1)

    if (!dev) {
      throw new Error(`Developer not found: ${developerId}`)
    }

    // Get all tool IDs owned by this developer (needed for cascading deletes)
    const devTools = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.developerId, developerId))

    const toolIds = devTools.map((t) => t.id)

    await db.transaction(async (tx) => {
      // ── 1. Anonymize developer profile ─────────────────────────────
      await tx
        .update(developers)
        .set({
          name: '[Deleted]',
          email: `deleted-${developerId}@deleted.settlegrid.ai`,
          publicBio: null,
          avatarUrl: null,
          passwordHash: null,
          apiKeyHash: null,
          supabaseUserId: null,
          slug: null,
          stripeConnectId: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          notificationPreferences: {},
          publicProfile: false,
          updatedAt: new Date(),
        })
        .where(eq(developers.id, developerId))

      // ── 2. Anonymize consumer record with the same email (if any) ──
      const [consumerRecord] = await tx
        .select({ id: consumers.id })
        .from(consumers)
        .where(eq(consumers.email, dev.email))
        .limit(1)

      if (consumerRecord) {
        await tx
          .update(consumers)
          .set({
            email: `deleted-${consumerRecord.id}@deleted.settlegrid.ai`,
            supabaseUserId: null,
            passwordHash: null,
          })
          .where(eq(consumers.id, consumerRecord.id))
      }

      // ── 3. Delete API keys for this developer's tools ──────────────
      if (toolIds.length > 0) {
        await tx
          .delete(apiKeys)
          .where(inArray(apiKeys.toolId, toolIds))
      }

      // ── 4. Null out PII metadata on invocations (keep financial data) ──
      if (toolIds.length > 0) {
        await tx
          .update(invocations)
          .set({ metadata: null })
          .where(inArray(invocations.toolId, toolIds))
      }

      // ── 5. Scrub IP/UA from audit logs ─────────────────────────────
      await tx
        .update(auditLogs)
        .set({ ipAddress: null, userAgent: null })
        .where(eq(auditLogs.developerId, developerId))

      // ── 6. Delete webhook endpoints (may reveal infrastructure URLs) ─
      await tx
        .delete(webhookEndpoints)
        .where(eq(webhookEndpoints.developerId, developerId))

      // ── 7. Anonymize tool reviews written by the developer's consumer ─
      //    Reviews are authored by consumers, not the developer, but if the
      //    developer also has a consumer account, anonymize those reviews.
      if (consumerRecord) {
        await tx
          .update(toolReviews)
          .set({ comment: null })
          .where(eq(toolReviews.consumerId, consumerRecord.id))
      }

      // ── 8. Mark tools as deleted, clear description/health endpoint ─
      if (toolIds.length > 0) {
        await tx
          .update(tools)
          .set({
            status: 'deleted',
            description: null,
            healthEndpoint: null,
            updatedAt: new Date(),
          })
          .where(inArray(tools.id, toolIds))
      }

      // ── 9. Mark compliance export as completed ─────────────────────
      await tx
        .update(complianceExports)
        .set({
          status: 'completed',
          resultUrl: JSON.stringify({
            anonymized: [
              'developers',
              ...(consumerRecord ? ['consumers'] : []),
              ...(toolIds.length > 0 ? ['api_keys', 'invocations.metadata'] : []),
              'audit_logs.ip_address',
              'audit_logs.user_agent',
              'webhook_endpoints',
              ...(consumerRecord ? ['tool_reviews'] : []),
              ...(toolIds.length > 0 ? ['tools'] : []),
            ],
            retained: ['payouts', 'purchases', 'ledger_entries', 'settlement_batches'],
            toolCount: toolIds.length,
          }),
          completedAt: new Date(),
        })
        .where(eq(complianceExports.id, exportId))
    })

    logger.info('compliance.data_deletion_completed', {
      exportId,
      entityType: record.entityType,
      entityId: developerId,
      toolCount: toolIds.length,
    })

    return { status: 'completed' }
  } catch (err) {
    await db
      .update(complianceExports)
      .set({ status: 'failed' })
      .where(eq(complianceExports.id, exportId))

    logger.error('compliance.data_deletion_failed', { exportId }, err)
    return { status: 'failed' }
  }
}
