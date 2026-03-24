import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolChangelogs } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { getOrCreateRequestId } from '@/lib/request-id'

export const maxDuration = 60


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEMVER_RE = /^\d+\.\d+\.\d+$/

const VALID_PRICING_MODELS = [
  'per-invocation',
  'per-token',
  'per-byte',
  'per-second',
  'tiered',
  'outcome',
] as const

const pricingConfigSchema = z
  .object({
    model: z.enum(VALID_PRICING_MODELS),
    defaultCostCents: z.number().int().min(0).optional(),
    currencyCode: z.string().max(10).default('USD'),
    costPerToken: z.number().min(0).optional(),
    costPerMB: z.number().min(0).optional(),
    costPerSecond: z.number().min(0).optional(),
    methods: z
      .record(
        z.string(),
        z.object({
          costCents: z.number().int().min(0),
          unitType: z.string().max(50).optional(),
          displayName: z.string().max(200).optional(),
        })
      )
      .optional(),
    tiers: z
      .array(
        z.object({
          upTo: z.number().int().min(1),
          costCents: z.number().int().min(0),
        })
      )
      .optional(),
    outcomeConfig: z
      .object({
        successCostCents: z.number().int().min(0),
        failureCostCents: z.number().int().min(0).default(0),
        successCondition: z.string().max(500).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    switch (data.model) {
      case 'per-invocation':
        if (data.defaultCostCents === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'per-invocation model requires defaultCostCents',
            path: ['defaultCostCents'],
          })
        }
        break
      case 'per-token':
        if (data.costPerToken === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'per-token model requires costPerToken',
            path: ['costPerToken'],
          })
        }
        break
      case 'per-byte':
        if (data.costPerMB === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'per-byte model requires costPerMB',
            path: ['costPerMB'],
          })
        }
        break
      case 'per-second':
        if (data.costPerSecond === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'per-second model requires costPerSecond',
            path: ['costPerSecond'],
          })
        }
        break
      case 'tiered':
        if (!data.methods || Object.keys(data.methods).length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'tiered model requires methods object with at least one method',
            path: ['methods'],
          })
        }
        break
      case 'outcome':
        if (!data.outcomeConfig || data.outcomeConfig.successCostCents === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'outcome model requires outcomeConfig with successCostCents',
            path: ['outcomeConfig'],
          })
        }
        break
    }
  })

const updateToolSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  pricingConfig: pricingConfigSchema.optional(),
  healthEndpoint: z.string().url().max(500).nullable().optional(),
  currentVersion: z
    .string()
    .regex(SEMVER_RE, 'Version must be valid semver (e.g. 1.0.0)')
    .optional(),
})

/**
 * Determines change type by comparing old and new semver strings.
 */
function detectChangeType(oldVersion: string, newVersion: string): 'major' | 'minor' | 'patch' {
  const oldParts = oldVersion.split('.').map(Number)
  const newParts = newVersion.split('.').map(Number)

  if ((newParts[0] ?? 0) !== (oldParts[0] ?? 0)) return 'major'
  if ((newParts[1] ?? 0) !== (oldParts[1] ?? 0)) return 'minor'
  return 'patch'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tool-get:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID', requestId)
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
        healthEndpoint: tools.healthEndpoint,
        currentVersion: tools.currentVersion,
        createdAt: tools.createdAt,
        updatedAt: tools.updatedAt,
      })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND', requestId)
    }

    return successResponse({ tool }, 200, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tool-update:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID', requestId)
    }
    const body = await parseBody(request, updateToolSchema)

    // Verify tool belongs to developer, also read currentVersion for changelog
    const [existing] = await db
      .select({ id: tools.id, currentVersion: tools.currentVersion })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND', requestId)
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.pricingConfig !== undefined) updateData.pricingConfig = body.pricingConfig
    if (body.healthEndpoint !== undefined) updateData.healthEndpoint = body.healthEndpoint
    if (body.currentVersion !== undefined) updateData.currentVersion = body.currentVersion

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
        healthEndpoint: tools.healthEndpoint,
        currentVersion: tools.currentVersion,
        createdAt: tools.createdAt,
        updatedAt: tools.updatedAt,
      })

    // Auto-insert changelog entry when version changes
    if (body.currentVersion !== undefined && body.currentVersion !== existing.currentVersion) {
      const changeType = detectChangeType(existing.currentVersion, body.currentVersion)
      db.insert(toolChangelogs)
        .values({
          toolId: id,
          version: body.currentVersion,
          changeType,
          summary: `Version updated from ${existing.currentVersion} to ${body.currentVersion}`,
          details: { previousVersion: existing.currentVersion },
        })
        .then(() => {})
        .catch(() => {})
    }

    // Audit log: tool updated
    writeAuditLog({
      developerId: auth.id,
      action: 'tool.updated',
      resourceType: 'tool',
      resourceId: id,
      details: { updatedFields: Object.keys(body).filter((k) => (body as Record<string, unknown>)[k] !== undefined) },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({ tool }, 200, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tool-delete:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED', requestId)
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID', requestId)
    }

    // Verify tool belongs to developer
    const [existing] = await db
      .select({ id: tools.id, status: tools.status })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND', requestId)
    }

    if (existing.status === 'deleted') {
      return errorResponse('Tool is already deleted.', 400, 'ALREADY_DELETED', requestId)
    }

    await db
      .update(tools)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(tools.id, id))

    // Audit log: tool deleted
    writeAuditLog({
      developerId: auth.id,
      action: 'tool.deleted',
      resourceType: 'tool',
      resourceId: id,
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({ message: 'Tool deleted successfully.' }, 200, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
