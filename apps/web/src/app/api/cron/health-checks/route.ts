import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolHealthChecks } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'

export const maxDuration = 60

/**
 * Vercel Cron handler: pings tools with healthEndpoint URLs
 * and records results in toolHealthChecks table.
 * Schedule: every 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify CRON_SECRET header (Vercel sends this for cron jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Fetch active tools with health endpoints
    const activeTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        healthEndpoint: tools.healthEndpoint,
      })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .limit(200)

    const toolsWithEndpoints = activeTools.filter(
      (t) => t.healthEndpoint && t.healthEndpoint.length > 0
    )

    if (toolsWithEndpoints.length === 0) {
      return successResponse({ checked: 0, message: 'No tools with health endpoints' })
    }

    // Batch in groups of 10 to stay within function timeout
    const BATCH_SIZE = 10
    const results: Array<{ toolId: string; status: string; responseTimeMs: number | null }> = []

    for (let i = 0; i < toolsWithEndpoints.length; i += BATCH_SIZE) {
      const batch = toolsWithEndpoints.slice(i, i + BATCH_SIZE)

      const batchResults = await Promise.allSettled(
        batch.map(async (tool) => {
          const startTime = Date.now()
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

            const response = await fetch(tool.healthEndpoint!, {
              method: 'GET',
              signal: controller.signal,
              headers: { 'User-Agent': 'SettleGrid-HealthCheck/1.0' },
            })

            clearTimeout(timeout)

            const responseTimeMs = Date.now() - startTime
            const status = response.ok ? 'up' : response.status >= 500 ? 'down' : 'degraded'

            return { toolId: tool.id, status, responseTimeMs }
          } catch (error) {
            const responseTimeMs = Date.now() - startTime
            const isTimeout = error instanceof Error && error.name === 'AbortError'
            return {
              toolId: tool.id,
              status: 'down' as const,
              responseTimeMs: isTimeout ? 10000 : responseTimeMs,
            }
          }
        })
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        }
      }
    }

    // Batch insert all health check records
    if (results.length > 0) {
      await db.insert(toolHealthChecks).values(
        results.map((r) => ({
          toolId: r.toolId,
          status: r.status,
          responseTimeMs: r.responseTimeMs,
          checkedAt: new Date(),
        }))
      )
    }

    const upCount = results.filter((r) => r.status === 'up').length
    const downCount = results.filter((r) => r.status === 'down').length
    const degradedCount = results.filter((r) => r.status === 'degraded').length

    logger.info('cron.health_checks.completed', {
      checked: results.length,
      up: upCount,
      down: downCount,
      degraded: degradedCount,
    })

    return successResponse({
      checked: results.length,
      up: upCount,
      down: downCount,
      degraded: degradedCount,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
