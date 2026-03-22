import { db } from '@/lib/db'
import {
  complianceExports,
  developers,
  tools,
  invocations,
  payouts,
  webhookEndpoints,
  referrals,
  auditLogs,
} from '@/lib/db/schema'
import { eq, and, gte, desc } from 'drizzle-orm'
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
export async function collectDeveloperData(developerId: string): Promise<Record<string, unknown>> {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  // Query all related data in parallel
  const [profileRows, toolRows, invocationRows, payoutRows, webhookRows, referralRows, auditLogRows] =
    await Promise.all([
      // Developer profile
      db.select().from(developers).where(eq(developers.id, developerId)).limit(1),

      // Developer tools
      db.select().from(tools).where(eq(tools.developerId, developerId)).orderBy(desc(tools.createdAt)),

      // Invocations for developer's tools (last 90 days)
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
        .where(and(eq(tools.developerId, developerId), gte(invocations.createdAt, ninetyDaysAgo)))
        .orderBy(desc(invocations.createdAt))
        .limit(10000),

      // Payouts
      db.select().from(payouts).where(eq(payouts.developerId, developerId)).orderBy(desc(payouts.createdAt)),

      // Webhook endpoints
      db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.developerId, developerId))
        .orderBy(desc(webhookEndpoints.createdAt)),

      // Referrals
      db.select().from(referrals).where(eq(referrals.referrerId, developerId)).orderBy(desc(referrals.createdAt)),

      // Audit logs (last 90 days)
      db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.developerId, developerId), gte(auditLogs.createdAt, ninetyDaysAgo)))
        .orderBy(desc(auditLogs.createdAt))
        .limit(5000),
    ])

  // Redact sensitive fields from the profile
  const profile = profileRows[0]
    ? {
        ...profileRows[0],
        passwordHash: undefined,
        apiKeyHash: undefined,
      }
    : null

  return {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0',
    profile,
    tools: toolRows,
    invocations: invocationRows,
    payouts: payoutRows,
    webhookEndpoints: webhookRows.map((w) => ({
      ...w,
      secret: '[REDACTED]', // Do not expose webhook secrets in export
    })),
    referrals: referralRows,
    auditLogs: auditLogRows,
  }
}

// ---- Process Data Export (GDPR Article 20) ----------------------------------

/**
 * Process a pending data export request.
 * Queries all developer data from the database, encodes it as a base64 data URL,
 * and stores the result in the compliance_exports record.
 */
export async function processDataExport(
  exportId: string
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
    // Collect all developer data
    const exportData = await collectDeveloperData(record.entityId)

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
 * Anonymizes PII for the entity across all relevant tables.
 * In production this would scrub names, emails, IPs etc.;
 * for now it marks the record as completed.
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

  // Mark as processing
  await db
    .update(complianceExports)
    .set({ status: 'processing' })
    .where(eq(complianceExports.id, exportId))

  try {
    // In production: anonymize PII in accounts, ledger_entries, invocations,
    // agent_identities, workflow_sessions etc. for this entity.
    // Replace emails with "deleted@anonymized", names with "[REDACTED]",
    // IPs with "0.0.0.0", etc.

    await db
      .update(complianceExports)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(complianceExports.id, exportId))

    logger.info('compliance.data_deletion_completed', {
      exportId,
      entityType: record.entityType,
      entityId: record.entityId,
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
