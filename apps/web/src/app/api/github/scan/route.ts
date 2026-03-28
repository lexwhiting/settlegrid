import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import {
  isGitHubAppConfigured,
  getInstallationToken,
  listInstallationRepos,
} from '@/lib/github'
import { scanRepository } from '@/app/api/webhooks/github/route'

// ─── Schemas ────────────────────────────────────────────────────────────────────

const scanBodySchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid GitHub owner'),
  repo: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid GitHub repo name'),
  installationId: z.number().int().positive(),
})

const scanAllBodySchema = z.object({
  installationId: z.number().int().positive(),
})

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * POST /api/github/scan
 *
 * Manually triggers a scan of a GitHub repository or all repos in an installation.
 * Authenticated via CRON_SECRET (for internal / admin use).
 *
 * Body options:
 *   { owner: string, repo: string, installationId: number }  — scan a single repo
 *   { installationId: number }                                — scan all repos in an installation
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `github-scan:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Authenticate via CRON_SECRET (Bearer token)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('github.scan.no_cron_secret')
      return errorResponse('Endpoint not configured', 500, 'CONFIG_ERROR')
    }
    const expectedToken = `Bearer ${cronSecret}`
    if (
      !authHeader ||
      authHeader.length !== expectedToken.length ||
      !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))
    ) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Check if GitHub App is configured
    if (!isGitHubAppConfigured()) {
      return errorResponse('GitHub App not configured', 503, 'GITHUB_NOT_CONFIGURED')
    }

    // Parse body — try single-repo schema first, then all-repos schema
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return errorResponse('Request body must be valid JSON', 400, 'BAD_REQUEST')
    }

    // Try single-repo scan
    const singleResult = scanBodySchema.safeParse(rawBody)
    if (singleResult.success) {
      const { owner, repo, installationId } = singleResult.data

      logger.info('github.scan.single_repo', { owner, repo, installationId })

      const result = await scanRepository(owner, repo, installationId)

      return successResponse({
        mode: 'single',
        result,
      })
    }

    // Try all-repos scan
    const allResult = scanAllBodySchema.safeParse(rawBody)
    if (allResult.success) {
      const { installationId } = allResult.data

      logger.info('github.scan.all_repos', { installationId })

      const token = await getInstallationToken(installationId)
      const repos = await listInstallationRepos(token)

      const results = []
      const MAX_REPOS = 50

      for (const repo of repos.slice(0, MAX_REPOS)) {
        const [owner, repoName] = repo.full_name.split('/')
        if (owner && repoName) {
          const result = await scanRepository(owner, repoName, installationId)
          results.push(result)
        }
      }

      const summary = {
        mode: 'all',
        installationId,
        totalRepos: repos.length,
        scanned: results.length,
        created: results.filter((r) => r.action === 'created').length,
        updated: results.filter((r) => r.action === 'updated').length,
        skipped: results.filter((r) => r.action === 'skipped').length,
        errors: results.filter((r) => r.action === 'error').length,
        results,
      }

      logger.info('github.scan.all_repos_completed', {
        installationId,
        scanned: summary.scanned,
        created: summary.created,
      })

      return successResponse(summary)
    }

    // Neither schema matched — return validation error
    return errorResponse(
      'Invalid request body. Provide { owner, repo, installationId } for single scan or { installationId } for all repos.',
      422,
      'VALIDATION_ERROR'
    )
  } catch (error) {
    return internalErrorResponse(error)
  }
}
