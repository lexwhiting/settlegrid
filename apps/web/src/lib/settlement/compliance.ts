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
