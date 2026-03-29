import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse } from '@/lib/api'
import { getCronSecret } from '@/lib/env'
import { logger } from '@/lib/logger'
import { runGridBot, type ToolTypeSlug } from '@/lib/gridbot'

export const maxDuration = 120

const VALID_TOOL_TYPES: readonly ToolTypeSlug[] = [
  'mcp-server',
  'ai-model',
  'rest-api',
  'agent-tool',
  'automation',
  'extension',
  'dataset',
  'sdk-package',
] as const

const requestSchema = z.object({
  /** Which tool types to target. Omit for all 8 types. */
  targetTypes: z
    .array(z.enum(VALID_TOOL_TYPES as unknown as [string, ...string[]]))
    .optional(),
  /** Tool slugs to exclude (already seeded). */
  excludeSlugs: z.array(z.string()).max(200).optional(),
  /** Max tools to invoke per type. Default: 2. */
  perTypeLimit: z.number().int().min(1).max(10).optional(),
  /** Daily budget in cents. Default: 200 ($2). */
  budgetCents: z.number().int().min(0).max(10000).optional(),
  /** If true, discover but do not invoke. */
  dryRun: z.boolean().optional(),
})

/**
 * POST /api/admin/gridbot
 *
 * Triggers a GridBot demand generation run across all tool types.
 * Requires CRON_SECRET for authorization.
 *
 * Body (all optional):
 *   targetTypes: string[]   — Which tool types to target (default: all 8)
 *   excludeSlugs: string[]  — Slugs to skip
 *   perTypeLimit: number    — Max tools per type (default: 2)
 *   budgetCents: number     — Daily budget in cents (default: 200)
 *   dryRun: boolean         — Discover only, no invocations (default: false)
 *
 * Response:
 *   GridBotRunResult — summary of the run
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: require CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Parse body
    let body: z.infer<typeof requestSchema> = {}
    try {
      const raw = await request.json()
      body = requestSchema.parse(raw)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return errorResponse(
          `Invalid request: ${err.errors.map((e) => e.message).join(', ')}`,
          400,
          'VALIDATION_ERROR',
        )
      }
      // Empty body is fine — all fields are optional
    }

    logger.info('admin.gridbot.triggered', {
      targetTypes: body.targetTypes ?? 'all',
      dryRun: body.dryRun ?? false,
    })

    const result = await runGridBot({
      targetTypes: body.targetTypes as ToolTypeSlug[] | undefined,
      excludeSlugs: body.excludeSlugs,
      perTypeLimit: body.perTypeLimit,
      budgetCents: body.budgetCents,
      dryRun: body.dryRun,
    })

    return successResponse(result)
  } catch (error) {
    logger.error('admin.gridbot.error', {}, error)
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR')
  }
}
