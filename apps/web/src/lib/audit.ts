import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import type { AuditAction, AuditResourceType } from '@/lib/audit-actions'

export {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  DEVELOPER_AUDIT_ACTIONS,
  DEVELOPER_AUDIT_RESOURCE_TYPES,
  type AuditAction,
  type AuditResourceType,
} from '@/lib/audit-actions'

export async function writeAuditLog(params: {
  developerId?: string
  consumerId?: string
  action: AuditAction
  resourceType: AuditResourceType
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      developerId: params.developerId ?? null,
      consumerId: params.consumerId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    })
  } catch (err) {
    logger.error('audit.write_failed', { action: params.action }, err)
  }
}
