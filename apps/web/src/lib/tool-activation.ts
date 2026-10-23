import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { grantFoundingMemberIfEligible } from '@/lib/founding'
import { sendNotificationEmail } from '@/lib/notifications'
import { firstToolPublishedEmail, toolStatusChangedEmail } from '@/lib/email'

export interface ActivatedTool {
  developerId: string
  toolId: string
  toolName: string
  toolSlug: string
  /** Status the tool had before it became active (e.g. 'draft'). */
  fromStatus: string
}

/**
 * Side effects of a tool going from not-active to active (dashboard Activate,
 * quick publish, CLI/SDK publish). Never throws: a failure here is logged and
 * must not fail the activation itself.
 */
export async function onToolActivated(tool: ActivatedTool): Promise<void> {
  try {
    const result = await grantFoundingMemberIfEligible(tool.developerId)
    if (result === 'granted') {
      logger.info('founding_member.granted', { developerId: tool.developerId, toolId: tool.toolId })
    }
  } catch (err) {
    logger.error('founding_member.grant_failed', { developerId: tool.developerId, toolId: tool.toolId }, err)
  }

  try {
    await sendToolPublishedEmail(tool)
  } catch (err) {
    logger.error('tool_published_email.failed', { developerId: tool.developerId, toolId: tool.toolId }, err)
  }
}

/**
 * "Tool published" notification (preference key `tool_published`). The
 * developer's first active tool gets the first-tool email; later ones get the
 * status-changed email.
 */
async function sendToolPublishedEmail(tool: ActivatedTool): Promise<void> {
  const [dev] = await db
    .select({ email: developers.email, name: developers.name })
    .from(developers)
    .where(eq(developers.id, tool.developerId))
    .limit(1)
  if (!dev?.email) return

  const [active] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tools)
    .where(and(eq(tools.developerId, tool.developerId), eq(tools.status, 'active')))
  const isFirstActiveTool = (active?.count ?? 0) <= 1

  const displayName = dev.name ?? dev.email
  const template = isFirstActiveTool
    ? firstToolPublishedEmail(displayName, tool.toolName, tool.toolSlug)
    : toolStatusChangedEmail(displayName, tool.toolName, tool.fromStatus, 'active')

  await sendNotificationEmail({
    developerId: tool.developerId,
    eventKey: 'tool_published',
    email: dev.email,
    subject: template.subject,
    html: template.html,
  })
}
