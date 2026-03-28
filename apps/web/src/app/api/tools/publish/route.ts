import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'

export const maxDuration = 60

// ─── Validation ─────────────────────────────────────────────────────────────

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

const publishSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  category: z.string().min(1, 'Category is required').max(100, 'Category too long'),
  version: z
    .string()
    .regex(SEMVER_RE, 'Version must be valid semver (e.g. 1.0.0)'),
  pricingConfig: pricingConfigSchema,
  healthEndpoint: z.string().url().max(500).refine(
    (url) => url.startsWith('https://') || url.startsWith('http://'),
    'Health endpoint must use http or https'
  ).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
})

// ─── Auth helper ────────────────────────────────────────────────────────────

/**
 * Authenticates a developer via x-api-key header.
 * Hashes the raw key with SHA-256 and matches against developers.apiKeyHash.
 */
async function authenticateDeveloperByApiKey(
  request: NextRequest
): Promise<{ id: string; email: string }> {
  const rawKey = request.headers.get('x-api-key')

  if (!rawKey) {
    throw new AuthError('API key required. Provide x-api-key header.')
  }

  if (rawKey.length < 16) {
    throw new AuthError('Invalid API key format.')
  }

  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const [developer] = await db
    .select({ id: developers.id, email: developers.email })
    .from(developers)
    .where(eq(developers.apiKeyHash, keyHash))
    .limit(1)

  if (!developer) {
    throw new AuthError('Invalid API key.')
  }

  return { id: developer.id, email: developer.email }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ─── PUT /api/tools/publish ─────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)
  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tools-publish:${ip}`)
    if (!rateLimit.success) {
      return errorResponse(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED',
        requestId
      )
    }

    // Authenticate developer by API key
    let auth: { id: string; email: string }
    try {
      auth = await authenticateDeveloperByApiKey(request)
    } catch (err) {
      if (err instanceof AuthError) {
        return errorResponse(err.message, 401, 'UNAUTHORIZED', requestId)
      }
      throw err
    }

    // Parse and validate the body
    const body = await parseBody(request, publishSchema)

    // Check if tool with this slug already exists
    const [existing] = await db
      .select({
        id: tools.id,
        developerId: tools.developerId,
        name: tools.name,
      })
      .from(tools)
      .where(eq(tools.slug, body.slug))
      .limit(1)

    let toolRecord: {
      id: string
      name: string
      slug: string
      description: string | null
      pricingConfig: unknown
      status: string
      category: string | null
      tags: unknown
      currentVersion: string
      healthEndpoint: string | null
      createdAt: Date
      updatedAt: Date
    }
    let isCreate = false

    if (existing) {
      // Verify ownership
      if (existing.developerId !== auth.id) {
        return errorResponse(
          'A tool with this slug already exists and belongs to another developer.',
          409,
          'SLUG_CONFLICT',
          requestId
        )
      }

      // Update existing tool
      const [updated] = await db
        .update(tools)
        .set({
          name: body.name,
          description: body.description,
          pricingConfig: body.pricingConfig,
          category: body.category,
          tags: body.tags ?? [],
          currentVersion: body.version,
          healthEndpoint: body.healthEndpoint ?? null,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(and(eq(tools.id, existing.id), eq(tools.developerId, auth.id)))
        .returning({
          id: tools.id,
          name: tools.name,
          slug: tools.slug,
          description: tools.description,
          pricingConfig: tools.pricingConfig,
          status: tools.status,
          category: tools.category,
          tags: tools.tags,
          currentVersion: tools.currentVersion,
          healthEndpoint: tools.healthEndpoint,
          createdAt: tools.createdAt,
          updatedAt: tools.updatedAt,
        })

      toolRecord = updated

      logger.info('tool.published.update', {
        developerId: auth.id,
        toolId: existing.id,
        slug: body.slug,
        version: body.version,
        requestId,
      })
    } else {
      // Create new tool
      isCreate = true

      const [created] = await db
        .insert(tools)
        .values({
          developerId: auth.id,
          name: body.name,
          slug: body.slug,
          description: body.description,
          pricingConfig: body.pricingConfig,
          category: body.category,
          tags: body.tags ?? [],
          currentVersion: body.version,
          healthEndpoint: body.healthEndpoint ?? null,
          status: 'active',
        })
        .returning({
          id: tools.id,
          name: tools.name,
          slug: tools.slug,
          description: tools.description,
          pricingConfig: tools.pricingConfig,
          status: tools.status,
          category: tools.category,
          tags: tools.tags,
          currentVersion: tools.currentVersion,
          healthEndpoint: tools.healthEndpoint,
          createdAt: tools.createdAt,
          updatedAt: tools.updatedAt,
        })

      toolRecord = created

      logger.info('tool.published.create', {
        developerId: auth.id,
        toolId: created.id,
        slug: body.slug,
        version: body.version,
        requestId,
      })
    }

    // Audit log
    writeAuditLog({
      developerId: auth.id,
      action: isCreate ? 'tool.published.create' : 'tool.published.update',
      resourceType: 'tool',
      resourceId: toolRecord.id,
      details: {
        name: body.name,
        slug: body.slug,
        version: body.version,
        category: body.category,
      },
      ipAddress: ip,
    }).catch(() => {})

    // Build storefront URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://settlegrid.ai'
    const storefrontUrl = `${baseUrl}/tools/${toolRecord.slug}`

    return successResponse(
      {
        tool: {
          id: toolRecord.id,
          slug: toolRecord.slug,
          name: toolRecord.name,
          currentVersion: toolRecord.currentVersion,
          status: toolRecord.status,
        },
        storefrontUrl,
      },
      isCreate ? 201 : 200,
      requestId
    )
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
