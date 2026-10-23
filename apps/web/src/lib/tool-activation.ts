import { logger } from '@/lib/logger'
import { grantFoundingMemberIfEligible } from '@/lib/founding'

export interface ActivatedTool {
  developerId: string
  toolId: string
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
}
