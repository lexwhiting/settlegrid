import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `public-tool:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { slug } = await params

    const results = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        pricingConfig: tools.pricingConfig,
        developerName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    if (results.length === 0) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    const tool = results[0]

    return successResponse({
      tool: {
        id: tool.id,
        name: tool.name,
        slug: tool.slug,
        description: tool.description,
        pricingConfig: tool.pricingConfig,
        developerName: tool.developerName,
      },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
