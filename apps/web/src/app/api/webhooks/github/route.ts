import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getGitHubWebhookSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  verifyWebhookSignature,
  getInstallationToken,
  listInstallationRepos,
  isGitHubAppConfigured,
} from '@/lib/github'
import { scanRepository, type ScanResult } from './scan-impl'

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_REPOS_PER_SCAN = 50

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PushEventPayload {
  ref?: string
  repository?: {
    name?: string
    full_name?: string
    owner?: { login?: string }
  }
  installation?: { id?: number }
  commits?: Array<{
    added?: string[]
    modified?: string[]
    removed?: string[]
  }>
}

interface InstallationEventPayload {
  action?: string
  installation?: {
    id?: number
    account?: { login?: string }
  }
  repositories?: Array<{ name?: string; full_name?: string }>
}

interface InstallationRepositoriesEventPayload {
  action?: string
  installation?: {
    id?: number
    account?: { login?: string }
  }
  repositories_added?: Array<{ name?: string; full_name?: string }>
  repositories_removed?: Array<{ name?: string; full_name?: string }>
}

// ─── Event Handlers ─────────────────────────────────────────────────────────────

/**
 * Handles the `installation` event — someone installed or uninstalled the GitHub App.
 * On install, scans all repos for SettleGrid SDK usage.
 */
async function handleInstallationEvent(payload: InstallationEventPayload): Promise<ScanResult[]> {
  const { action, installation, repositories } = payload

  if (!installation?.id) {
    logger.warn('github.webhook.installation.no_id', { action })
    return []
  }

  logger.info('github.webhook.installation', {
    action,
    installationId: installation.id,
    account: installation.account?.login,
    repoCount: repositories?.length ?? 0,
  })

  if (action !== 'created') {
    // We only scan on new installations; deletions are logged but no tools removed
    return []
  }

  // Scan all repos that came with the installation
  const results: ScanResult[] = []

  if (repositories && repositories.length > 0) {
    const batch = repositories.slice(0, MAX_REPOS_PER_SCAN)
    for (const repo of batch) {
      const fullName = repo.full_name ?? ''
      const [owner, repoName] = fullName.split('/')
      if (owner && repoName) {
        const result = await scanRepository(owner, repoName, installation.id)
        results.push(result)
      }
    }
  } else {
    // No repos listed — fetch from the installation
    try {
      const token = await getInstallationToken(installation.id)
      const repos = await listInstallationRepos(token)
      const batch = repos.slice(0, MAX_REPOS_PER_SCAN)

      for (const repo of batch) {
        const fullName = repo.full_name ?? ''
        const [owner, repoName] = fullName.split('/')
        if (owner && repoName) {
          const result = await scanRepository(owner, repoName, installation.id)
          results.push(result)
        }
      }
    } catch (error) {
      logger.error('github.webhook.installation.scan_failed', {
        installationId: installation.id,
      }, error)
    }
  }

  return results
}

/**
 * Handles the `push` event — code was pushed to a repo.
 * Only scans if package.json was modified in the push.
 */
async function handlePushEvent(payload: PushEventPayload): Promise<ScanResult[]> {
  const { repository, installation, commits } = payload

  if (!repository?.owner?.login || !repository.name || !installation?.id) {
    logger.warn('github.webhook.push.missing_fields')
    return []
  }

  // Check if any commit in the push touched package.json
  const touchedPackageJson = (commits ?? []).some((commit) => {
    const allFiles = [
      ...(commit.added ?? []),
      ...(commit.modified ?? []),
      ...(commit.removed ?? []),
    ]
    return allFiles.includes('package.json')
  })

  if (!touchedPackageJson) {
    logger.info('github.webhook.push.no_package_json_change', {
      repo: repository.full_name,
    })
    return []
  }

  logger.info('github.webhook.push.package_json_changed', {
    repo: repository.full_name,
  })

  const result = await scanRepository(
    repository.owner.login,
    repository.name,
    installation.id
  )

  return [result]
}

/**
 * Handles the `installation_repositories` event — repos added/removed from installation.
 * Scans newly added repos for SettleGrid SDK usage.
 */
async function handleInstallationRepositoriesEvent(
  payload: InstallationRepositoriesEventPayload
): Promise<ScanResult[]> {
  const { action, installation, repositories_added, repositories_removed } = payload

  if (!installation?.id) {
    logger.warn('github.webhook.installation_repos.no_id', { action })
    return []
  }

  // Log removals (we don't delete tools when repos are removed)
  if (repositories_removed && repositories_removed.length > 0) {
    logger.info('github.webhook.installation_repos.removed', {
      installationId: installation.id,
      repos: repositories_removed.map((r) => r.full_name).filter(Boolean),
    })
  }

  if (action !== 'added' || !repositories_added || repositories_added.length === 0) {
    return []
  }

  const results: ScanResult[] = []
  const batch = repositories_added.slice(0, MAX_REPOS_PER_SCAN)

  for (const repo of batch) {
    const fullName = repo.full_name ?? ''
    const [owner, repoName] = fullName.split('/')
    if (owner && repoName) {
      const result = await scanRepository(owner, repoName, installation.id)
      results.push(result)
    }
  }

  return results
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/github
 *
 * Receives GitHub App webhook events and auto-discovers SettleGrid tools
 * by scanning repositories for @settlegrid/mcp or @settlegrid/sdk in package.json.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `github-webhook:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    // Check if GitHub App is configured
    if (!isGitHubAppConfigured()) {
      logger.warn('github.webhook.not_configured')
      return errorResponse('GitHub App not configured', 503, 'GITHUB_NOT_CONFIGURED')
    }

    // Read the raw body for signature verification
    const rawBody = await request.text()

    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256')
    const webhookSecret = getGitHubWebhookSecret()

    if (!signature || !webhookSecret) {
      return errorResponse('Missing webhook signature', 401, 'UNAUTHORIZED')
    }

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn('github.webhook.invalid_signature')
      return errorResponse('Invalid webhook signature', 401, 'UNAUTHORIZED')
    }

    // Parse the event
    const event = request.headers.get('x-github-event')
    const deliveryId = request.headers.get('x-github-delivery') ?? 'unknown'

    if (!event) {
      return errorResponse('Missing x-github-event header', 400, 'BAD_REQUEST')
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return errorResponse('Invalid JSON body', 400, 'BAD_REQUEST')
    }

    logger.info('github.webhook.received', {
      event,
      deliveryId,
    })

    // Route to the appropriate handler
    let results: ScanResult[] = []

    switch (event) {
      case 'installation':
        results = await handleInstallationEvent(payload as InstallationEventPayload)
        break

      case 'push':
        results = await handlePushEvent(payload as PushEventPayload)
        break

      case 'installation_repositories':
        results = await handleInstallationRepositoriesEvent(
          payload as InstallationRepositoriesEventPayload
        )
        break

      case 'ping':
        logger.info('github.webhook.ping', { deliveryId })
        return successResponse({ event: 'ping', message: 'pong' })

      default:
        logger.info('github.webhook.unhandled_event', { event, deliveryId })
        return successResponse({ event, message: 'Event type not handled' })
    }

    // Summarize results
    const summary = {
      event,
      deliveryId,
      scanned: results.length,
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      skipped: results.filter((r) => r.action === 'skipped').length,
      errors: results.filter((r) => r.action === 'error').length,
    }

    logger.info('github.webhook.completed', summary)

    return successResponse(summary)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
