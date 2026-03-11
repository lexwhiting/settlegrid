import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'

export async function writeAuditLog(params: {
  developerId?: string
  consumerId?: string
  action: string
  resourceType: string
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
    console.error('[Audit Log Write Error]', {
      action: params.action,
      error: err instanceof Error ? err.message : 'Unknown',
    })
  }
}
