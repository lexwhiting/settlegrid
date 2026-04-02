import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, purchases } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 30

interface RouteContext {
  params: Promise<{ slug: string }>
}

/**
 * GET /api/templates/:slug/download — returns the template archive.
 * Gated behind purchase verification: consumer must have a completed purchase for this template.
 * Free (non-premium) templates are downloadable by anyone with auth.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `template-download:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const { slug } = await ctx.params

    if (!slug || slug.length > 200) {
      return errorResponse('Invalid template slug.', 400, 'VALIDATION_ERROR')
    }

    // Find the template
    const [template] = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        isPremium: tools.isPremium,
        sourceRepoUrl: tools.sourceRepoUrl,
      })
      .from(tools)
      .where(and(eq(tools.slug, slug), eq(tools.status, 'template')))
      .limit(1)

    if (!template) {
      return errorResponse('Template not found.', 404, 'NOT_FOUND')
    }

    // If premium, verify purchase
    if (template.isPremium) {
      const [purchase] = await db
        .select({ id: purchases.id })
        .from(purchases)
        .where(
          and(
            eq(purchases.consumerId, auth.id),
            eq(purchases.toolId, template.id),
            eq(purchases.status, 'completed'),
          ),
        )
        .limit(1)

      if (!purchase) {
        return errorResponse(
          'Purchase required. Buy this template at /api/templates/purchase before downloading.',
          403,
          'PURCHASE_REQUIRED',
        )
      }
    }

    // For now, redirect to the source repo URL if available.
    // Template archives will be served from blob storage once content is ready.
    if (template.sourceRepoUrl) {
      logger.info('templates.download', {
        consumerId: auth.id,
        templateSlug: template.slug,
        method: 'redirect',
      })

      return new Response(null, {
        status: 302,
        headers: {
          Location: template.sourceRepoUrl,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    // No source repo configured yet
    return errorResponse(
      'Template archive not yet available. The source code will be available for download soon.',
      404,
      'ARCHIVE_NOT_READY',
    )
  } catch (error) {
    return internalErrorResponse(error)
  }
}
