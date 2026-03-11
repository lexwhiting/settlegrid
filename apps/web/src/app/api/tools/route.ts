import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

export const maxDuration = 15

const pricingConfigSchema = z.object({
  model: z.enum(['per_call', 'tiered', 'flat']),
  perCallCents: z.number().int().min(0).optional(),
  tiers: z
    .array(
      z.object({
        upTo: z.number().int().min(1),
        centsPerCall: z.number().int().min(0),
      })
    )
    .optional(),
  flatMonthlyCents: z.number().int().min(0).optional(),
})

const createToolSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(2000, 'Description too long').optional(),
  pricingConfig: pricingConfigSchema,
  healthEndpoint: z.string().url().max(500).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tools-list:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const developerTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        pricingConfig: tools.pricingConfig,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        healthEndpoint: tools.healthEndpoint,
        createdAt: tools.createdAt,
        updatedAt: tools.updatedAt,
      })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    return successResponse({ tools: developerTools })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tools-create:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, createToolSchema)

    // Check for existing tool with this slug
    const [existing] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.slug, body.slug))
      .limit(1)

    if (existing) {
      return errorResponse('A tool with this slug already exists.', 409, 'SLUG_EXISTS')
    }

    const [tool] = await db
      .insert(tools)
      .values({
        developerId: auth.id,
        name: body.name,
        slug: body.slug,
        description: body.description ?? null,
        pricingConfig: body.pricingConfig,
        healthEndpoint: body.healthEndpoint ?? null,
      })
      .returning({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        pricingConfig: tools.pricingConfig,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        healthEndpoint: tools.healthEndpoint,
        createdAt: tools.createdAt,
        updatedAt: tools.updatedAt,
      })

    // Audit log: tool created
    writeAuditLog({
      developerId: auth.id,
      action: 'tool.created',
      resourceType: 'tool',
      resourceId: tool.id,
      details: { name: body.name, slug: body.slug },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({ tool }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
