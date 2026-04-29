import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { hasFeature } from '@/lib/tier-config'

export const maxDuration = 60


/** GET /api/tools/[slug]/pricing-widget — public embeddable pricing widget */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `pricing-widget:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const { slug } = await params

    const [tool] = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        pricingConfig: tools.pricingConfig,
        developerId: tools.developerId,
      })
      .from(tools)
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Check developer tier for white-label eligibility
    const [dev] = await db
      .select({ tier: developers.tier, isFoundingMember: developers.isFoundingMember })
      .from(developers)
      .where(eq(developers.id, tool.developerId))
      .limit(1)

    const whiteLabel = dev
      ? hasFeature(dev.tier, 'whitelabel_widget', dev.isFoundingMember)
      : false

    const baseUrl = 'https://settlegrid.ai'
    const checkoutUrl = `${baseUrl}/tools/${tool.slug}#pricing`

    // Parse pricing config to extract tiers
    const pricingConfig = tool.pricingConfig as Record<string, unknown> | null
    const tiers = Array.isArray(pricingConfig?.tiers)
      ? (pricingConfig.tiers as Array<Record<string, unknown>>).slice(0, 10)
      : [{ name: 'Pay Per Call', description: 'Charged per invocation' }]

    const embedCode = `<iframe src="${baseUrl}/embed/pricing/${tool.slug}" width="100%" height="400" frameborder="0" style="border:1px solid #e5e7eb;border-radius:8px;"></iframe>`

    return successResponse({
      tool: { name: tool.name, slug: tool.slug },
      pricingConfig: pricingConfig ?? {},
      tiers,
      checkoutUrl,
      embedCode,
      whiteLabel,
      branding: whiteLabel ? null : { name: 'SettleGrid', url: baseUrl },
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
