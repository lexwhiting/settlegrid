import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { queueSeedInvocations } from '@/lib/seed-invocations'
import { CATEGORY_SLUGS } from '@/lib/categories'
import { logger } from '@/lib/logger'

export const maxDuration = 60

// ─── SSRF Protection ─────────────────────────────────────────────────────────

function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true
    if (hostname === 'metadata.google.internal' || hostname.endsWith('.internal')) return true
    const parts = hostname.split('.').map(Number)
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      if (parts[0] === 10) return true
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
      if (parts[0] === 192 && parts[1] === 168) return true
      if (parts[0] === 169 && parts[1] === 254) return true
      if (parts[0] === 0) return true
    }
    return false
  } catch {
    return true
  }
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
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
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
