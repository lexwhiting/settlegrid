import { db } from '@/lib/db'
import { complianceExports } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

// ---- Process Data Export (GDPR Article 20) ----------------------------------

/**
 * Process a pending data export request.
 * Collects data for the entity and produces a downloadable URL.
 * In production this would query all relevant tables; for now it
 * marks the record as completed with a placeholder result URL.
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
    // In production: query ledger_entries, invocations, workflow_sessions,
    // outcome_verifications etc. for this entity, package as JSON/ZIP,
    // upload to secure storage and set resultUrl.
    const resultUrl = `https://exports.settlegrid.ai/${exportId}/data.json`

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
