import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

const updateToolSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  pricingConfig: pricingConfigSchema.optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tool-get:${ip}`)
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

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
    }

    const [tool] = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        pricingConfig: tools.pricingConfig,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        createdAt: tools.createdAt,
        updatedAt: tools.updatedAt,
      })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    return successResponse({ tool })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tool-update:${ip}`)
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

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
    }
    const body = await parseBody(request, updateToolSchema)

    // Verify tool belongs to developer
    const [existing] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.pricingConfig !== undefined) updateData.pricingConfig = body.pricingConfig

    const [tool] = await db
      .update(tools)
      .set(updateData)
      .where(eq(tools.id, id))
      .returning({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        pricingConfig: tools.pricingConfig,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        createdAt: tools.createdAt,
        updatedAt: tools.updatedAt,
      })

    return successResponse({ tool })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tool-delete:${ip}`)
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

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
    }

    // Verify tool belongs to developer
    const [existing] = await db
      .select({ id: tools.id, status: tools.status })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    if (existing.status === 'deleted') {
      return errorResponse('Tool is already deleted.', 400, 'ALREADY_DELETED')
    }

    await db
      .update(tools)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(tools.id, id))

    return successResponse({ message: 'Tool deleted successfully.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
