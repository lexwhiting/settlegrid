import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, desc, sql, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import {
  parseBody,
  successResponse,
  errorResponse,
  internalErrorResponse,
} from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { getEffectiveCostCents, getSuggestedPricing } from '@/lib/pricing-utils'
import { getBundlesForCategory } from '@/lib/tool-bundles'

export const maxDuration = 15

// ─── Validation ─────────────────────────────────────────────────────────────

const suggestPricingSchema = z.object({
  toolId: z.string().uuid('Invalid tool ID'),
})

// ─── Types ──────────────────────────────────────────────────────────────────

interface SimilarToolPricing {
  name: string
  slug: string
  category: string | null
  toolType: string
  priceCents: number
  totalInvocations: number
}

interface PricingSuggestion {
  /** Recommended price in cents based on similar tools */
  suggestedCents: number
  /** 25th percentile price (budget tier) */
  budgetCents: number
  /** 75th percentile price (premium tier) */
  premiumCents: number
  /** Number of similar tools used for this suggestion */
  comparableToolCount: number
  /** Similar tools with their pricing for reference */
  similarTools: SimilarToolPricing[]
  /** Recommended pricing model */
  suggestedPricingModel: string
  /** Bundles this tool could join (network effect) */
  recommendedBundles: ReadonlyArray<{
    slug: string
    title: string
    description: string
    suggestedDiscountPct: number
  }>
}

/**
 * POST /api/tools/claim/suggest-pricing
 *
 * After claiming a tool, suggests pricing based on:
 * 1. Similar tools in the same category
 * 2. Tools of the same type from the same ecosystem
 * 3. Category-level pricing benchmarks
 * 4. Relevant bundles for network effects
 *
 * This creates lock-in: developers who use SettleGrid's pricing intelligence
 * have a competitive advantage over those who guess at pricing.
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `suggest-pricing:${ip}`)
    if (!rl.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
        requestId,
      )
    }

    const body = await parseBody(request, suggestPricingSchema)

    // Look up the tool
    const [tool] = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        toolType: tools.toolType,
        sourceEcosystem: tools.sourceEcosystem,
      })
      .from(tools)
      .where(eq(tools.id, body.toolId))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'TOOL_NOT_FOUND', requestId)
    }

    // Find similar tools by category and type
    const similarConditions = [
      eq(tools.status, 'active'),
      ne(tools.id, tool.id),
      sql`${tools.pricingConfig} IS NOT NULL`,
    ]

    // Prefer same category, fall back to same type
    if (tool.category) {
      similarConditions.push(eq(tools.category, tool.category))
    } else {
      similarConditions.push(eq(tools.toolType, tool.toolType))
    }

    const similarTools = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        category: tools.category,
        toolType: tools.toolType,
        pricingConfig: tools.pricingConfig,
        totalInvocations: tools.totalInvocations,
      })
      .from(tools)
      .where(and(...similarConditions))
      .orderBy(desc(tools.totalInvocations))
      .limit(20)

    // Extract pricing from similar tools
    const pricedTools: SimilarToolPricing[] = []
    for (const st of similarTools) {
      const cost = getEffectiveCostCents(st.pricingConfig)
      if (cost !== null && cost > 0 && Number.isFinite(cost)) {
        pricedTools.push({
          name: st.name,
          slug: st.slug,
          category: st.category,
          toolType: st.toolType,
          priceCents: cost,
          totalInvocations: st.totalInvocations,
        })
      }
    }

    // Get category-level benchmarks
    const categoryBenchmark = tool.category
      ? await getSuggestedPricing(tool.category)
      : null

    // Determine suggested pricing
    let suggestedCents: number
    let budgetCents: number
    let premiumCents: number
    let comparableToolCount: number

    if (pricedTools.length >= 3) {
      // Use similar tools for pricing
      const prices = pricedTools.map((t) => t.priceCents).sort((a, b) => a - b)
      const p25Idx = Math.floor(prices.length * 0.25)
      const p50Idx = Math.floor(prices.length * 0.5)
      const p75Idx = Math.floor(prices.length * 0.75)

      suggestedCents = prices[p50Idx]
      budgetCents = prices[p25Idx]
      premiumCents = prices[p75Idx]
      comparableToolCount = pricedTools.length
    } else if (categoryBenchmark && categoryBenchmark.toolCount >= 3) {
      // Fall back to category benchmarks
      suggestedCents = categoryBenchmark.suggestedCents
      budgetCents = categoryBenchmark.p25Cents
      premiumCents = categoryBenchmark.p75Cents
      comparableToolCount = categoryBenchmark.toolCount
    } else {
      // Default pricing by tool type
      const typeDefaults: Record<string, number> = {
        'mcp-server': 5,
        'ai-model': 10,
        'rest-api': 3,
        'agent-tool': 8,
        'automation': 10,
        'extension': 3,
        'dataset': 5,
        'sdk-package': 2,
      }
      suggestedCents = typeDefaults[tool.toolType] ?? 5
      budgetCents = Math.max(1, Math.round(suggestedCents * 0.5))
      premiumCents = Math.round(suggestedCents * 2)
      comparableToolCount = 0
    }

    // Determine best pricing model
    let suggestedPricingModel = 'per-invocation'
    if (tool.toolType === 'ai-model') {
      suggestedPricingModel = 'per-invocation' // Could be per-token, but per-invocation is simpler to start
    } else if (tool.toolType === 'automation') {
      suggestedPricingModel = 'per-invocation'
    }

    // Get bundle recommendations (network effects)
    const bundleRecommendations = tool.category
      ? getBundlesForCategory(tool.category).map((b) => ({
          slug: b.slug,
          title: b.title,
          description: b.description,
          suggestedDiscountPct: b.suggestedDiscountPct,
        }))
      : []

    const suggestion: PricingSuggestion = {
      suggestedCents,
      budgetCents,
      premiumCents,
      comparableToolCount,
      similarTools: pricedTools.slice(0, 5),
      suggestedPricingModel,
      recommendedBundles: bundleRecommendations,
    }

    return successResponse(suggestion, 200, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
