/**
 * GET /api/admin/experiments — List active experiments and their variants.
 *
 * Informational endpoint. Actual flag management happens in the PostHog dashboard.
 * Returns all registered experiments with their configuration.
 */

import { NextRequest } from 'next/server'
import { EXPERIMENTS } from '@/lib/experiments'
import { successResponse, errorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `admin-experiments:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const experiments = Object.entries(EXPERIMENTS).map(([key, experiment]) => ({
      key,
      flagKey: experiment.flagKey,
      name: experiment.name,
      description: experiment.description,
      variants: experiment.variants,
      controlVariant: experiment.controlVariant,
      primaryMetric: experiment.primaryMetric,
      variantCount: experiment.variants.length,
    }))

    return successResponse({
      experiments,
      total: experiments.length,
      note: 'Experiment flags are managed in the PostHog dashboard. This endpoint is read-only.',
    })
  } catch {
    return errorResponse(
      'Failed to load experiments.',
      500,
      'INTERNAL_ERROR'
    )
  }
}
