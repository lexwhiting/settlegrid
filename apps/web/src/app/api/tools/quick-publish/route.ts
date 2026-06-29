import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { queueSeedInvocations } from '@/lib/seed-invocations'
import { CATEGORY_SLUGS } from '@/lib/categories'
import { logger } from '@/lib/logger'
import { isPublicUrlString } from '@/lib/safe-egress'

export const maxDuration = 60

// ─── SSRF Protection ─────────────────────────────────────────────────────────

// Registration-time UX pre-check (delegates to the shared SSRF guard, G2-2;
// supersedes the old string-prefix denylist). This feeds the proxy sinks; the
// load-bearing block is L1+L2 in `safeFetch` at the proxy fetch. The https
// requirement is enforced by a separate schema refine.
function isPrivateUrl(urlStr: string): boolean {
  return !isPublicUrlString(urlStr)
}

// ─── Request Schema ──────────────────────────────────────────────────────────

const VALID_PRICING_MODELS = [
  'per-invocation',
  'per-token',
  'per-byte',
  'per-second',
  'tiered',
  'outcome',
] as const

const VALID_TOOL_TYPES = [
  'mcp-server',
  'ai-model',
  'rest-api',
  'agent-tool',
  'automation',
  'extension',
  'dataset',
  'sdk-package',
] as const

const quickPublishSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .max(2000, 'URL must not exceed 2000 characters')
    .refine(
      (u) => u.startsWith('https://'),
      'URL must use HTTPS'
    )
    .refine(
      (u) => !isPrivateUrl(u),
      'URL must not point to private or internal addresses'
    ),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name too long'),
  category: z
    .string()
    .max(50, 'Category too long')
    .optional(),
  toolType: z
    .enum(VALID_TOOL_TYPES)
    .default('mcp-server'),
  pricingModel: z
    .enum(VALID_PRICING_MODELS)
    .default('per-invocation'),
  costCents: z
    .number()
    .int('Cost must be a whole number of cents')
    .min(1, 'Minimum cost is 1 cent')
    .max(100000, 'Maximum cost is $1,000')
    .default(5),
  description: z
    .string()
    .max(2000, 'Description too long')
    .optional(),
})

// ─── POST Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/tools/quick-publish
 *
 * Instant publish: creates a tool with status='active', sets the proxy endpoint,
 * and returns the proxy URL immediately. Auth required.
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)

  try {
    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimit(apiLimiter, `quick-publish:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    // Auth required for publishing
    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const userRl = await checkRateLimit(apiLimiter, `quick-publish:uid:${auth.id}`)
    if (!userRl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const body = await parseBody(request, quickPublishSchema)

    // Validate category if provided
    if (body.category && !CATEGORY_SLUGS.includes(body.category)) {
      return errorResponse(
        `Invalid category. Must be one of: ${CATEGORY_SLUGS.join(', ')}`,
        422,
        'INVALID_CATEGORY',
        requestId
      )
    }

    // Generate slug from name
    const baseSlug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)

    // Ensure slug uniqueness by appending random suffix
    const randomSuffix = Math.random().toString(36).slice(2, 6)
    let slug = baseSlug

    // Check if base slug exists
    const [existing] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.slug, slug))
      .limit(1)

    if (existing) {
      slug = `${baseSlug}-${randomSuffix}`
    }

    // Build pricing config based on model
    const costCents = body.costCents ?? 5
    const pricingModel = body.pricingModel ?? 'per-invocation'
    const pricingConfig = buildPricingConfig(pricingModel, costCents)

    // Create tool with active status and proxy endpoint
    const toolType = body.toolType ?? 'mcp-server'
    const [tool] = await db
      .insert(tools)
      .values({
        developerId: auth.id,
        name: body.name,
        slug,
        description: body.description ?? null,
        pricingConfig,
        status: 'active',
        category: body.category ?? null,
        toolType,
        proxyEndpoint: body.url,
        currentVersion: '1.0.0',
      })
      .returning({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        pricingConfig: tools.pricingConfig,
        status: tools.status,
        toolType: tools.toolType,
        category: tools.category,
        proxyEndpoint: tools.proxyEndpoint,
        createdAt: tools.createdAt,
      })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://settlegrid.ai'
    const proxyUrl = `${appUrl}/api/proxy/${tool.slug}`
    const toolPageUrl = `${appUrl}/tools/${tool.slug}`

    // Audit log
    writeAuditLog({
      developerId: auth.id,
      action: 'tool.quick_published',
      resourceType: 'tool',
      resourceId: tool.id,
      details: {
        name: body.name,
        slug: tool.slug,
        url: body.url,
        toolType,
        category: body.category ?? null,
        costCents: body.costCents,
      },
      ipAddress: ip,
    }).catch(() => {})

    // Fire-and-forget: queue seed invocations
    queueSeedInvocations({
      toolSlug: tool.slug,
      proxyUrl,
    })

    logger.info('quick_publish.success', {
      toolId: tool.id,
      slug: tool.slug,
      developerId: auth.id,
    })

    return successResponse(
      {
        tool: {
          id: tool.id,
          name: tool.name,
          slug: tool.slug,
          description: tool.description,
          status: tool.status,
          toolType: tool.toolType,
          category: tool.category,
          proxyUrl,
          toolPageUrl,
          createdAt: tool.createdAt,
        },
      },
      201,
      requestId
    )
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPricingConfig(model: string, costCents: number): Record<string, unknown> {
  switch (model) {
    case 'per-invocation':
      return { model: 'per-invocation', defaultCostCents: costCents }
    case 'per-token':
      return { model: 'per-token', costPerToken: costCents / 100 }
    case 'per-byte':
      return { model: 'per-byte', costPerMB: costCents }
    case 'per-second':
      return { model: 'per-second', costPerSecond: costCents / 100 }
    default:
      return { model: 'per-invocation', defaultCostCents: costCents }
  }
}
