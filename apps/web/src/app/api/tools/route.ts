import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { getOrCreateRequestId } from '@/lib/request-id'

export const maxDuration = 60


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
  currentVersion: z
    .string()
    .regex(SEMVER_RE, 'Version must be valid semver (e.g. 1.0.0)')
    .optional(),
})

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tools-list:${ip}`)
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

    const developerTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        pricingConfig: tools.pricingConfig,
        status: tools.status,
        category: tools.category,
        verified: tools.verified,
        totalInvocations: tools.totalInvocations,
        totalRevenueCents: tools.totalRevenueCents,
        healthEndpoint: tools.healthEndpoint,
        currentVersion: tools.currentVersion,
        listedInMarketplace: tools.listedInMarketplace,
        createdAt: tools.createdAt,
        updatedAt: tools.updatedAt,
      })
      .from(tools)
      .where(eq(tools.developerId, auth.id))
      .limit(500)

    // Fetch developer profile for quality gate checklist
    const [devProfile] = await db
      .select({ name: developers.name, slug: developers.slug })
      .from(developers)
      .where(eq(developers.id, auth.id))
      .limit(1)

    return successResponse({
      tools: developerTools,
      developerProfile: devProfile ?? { name: null, slug: null },
    }, 200, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tools-create:${ip}`)
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

    const body = await parseBody(request, createToolSchema)

    // Check for existing tool with this slug
    const [existing] = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.slug, body.slug))
      .limit(1)

    if (existing) {
      return errorResponse('A tool with this slug already exists.', 409, 'SLUG_EXISTS', requestId)
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
        currentVersion: body.currentVersion ?? '1.0.0',
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
        currentVersion: tools.currentVersion,
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

    return successResponse({ tool }, 201, requestId)
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
