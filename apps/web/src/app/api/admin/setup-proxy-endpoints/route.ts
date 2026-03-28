import { NextRequest } from 'next/server'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, errorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

export const maxDuration = 60

/**
 * POST /api/admin/setup-proxy-endpoints
 *
 * Sets proxyEndpoint on all active tools that don't have one yet,
 * pointing to the internal /api/tools/{slug}/call endpoint.
 * This enables GridBot to invoke showcase tools via the Smart Proxy.
 *
 * Auth: CRON_SECRET (same as cron jobs)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://settlegrid.ai'

    const toolsToUpdate = await db
      .select({ id: tools.id, slug: tools.slug, name: tools.name })
      .from(tools)
      .where(and(
        eq(tools.status, 'active'),
        isNull(tools.proxyEndpoint)
      ))
      .limit(200)

    if (toolsToUpdate.length === 0) {
      return successResponse({ message: 'All active tools already have proxy endpoints.', updated: 0 })
    }

    let updated = 0
    const results: { slug: string; endpoint: string }[] = []

    for (const tool of toolsToUpdate) {
      const endpoint = `${appUrl}/api/tools/${tool.slug}/call`

      await db
        .update(tools)
        .set({
          proxyEndpoint: endpoint,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, tool.id))

      results.push({ slug: tool.slug, endpoint })
      updated++
    }

    logger.info('admin.proxy_endpoints_set', { updated, tools: results.map(r => r.slug) })

    return successResponse({
      message: `Set proxy endpoints on ${updated} tools.`,
      updated,
      tools: results,
    })
  } catch (error) {
    logger.error('admin.setup_proxy_endpoints_failed', {}, error as Error)
    return errorResponse('Internal error', 500, 'INTERNAL_ERROR')
  }
}
