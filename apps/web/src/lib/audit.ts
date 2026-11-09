import { after } from 'next/server'
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

export function writeAuditLog(params: {
  developerId?: string
  consumerId?: string
  action: AuditAction
  resourceType: AuditResourceType
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  const write = insertAuditLog(params)
  // Most callers don't await this. On Vercel a function can stop as soon as its
  // response is sent, which drops a write still in flight (a second save in a row
  // went unlogged). after() keeps the invocation alive until the write settles.
  // Outside a request scope (tests, scripts) after() throws; the caller's promise
  // still carries the write.
  try {
    after(write)
  } catch {
    /* not in a request scope */
  }
  return write
}

async function insertAuditLog(params: Parameters<typeof writeAuditLog>[0]): Promise<void> {
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
