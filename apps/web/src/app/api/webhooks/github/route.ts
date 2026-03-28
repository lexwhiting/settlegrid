import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getGitHubWebhookSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import {
  verifyWebhookSignature,
  getInstallationToken,
  fetchFileContent,
  listInstallationRepos,
  isGitHubAppConfigured,
} from '@/lib/github'

// ─── Constants ──────────────────────────────────────────────────────────────────

const SYSTEM_DEVELOPER_EMAIL = 'system@settlegrid.com'
const SYSTEM_DEVELOPER_SLUG = 'settlegrid-system'
const SYSTEM_DEVELOPER_NAME = 'SettleGrid System'
const MAX_NAME_LENGTH = 256
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_REPOS_PER_SCAN = 50

/** SDK package names that indicate a SettleGrid tool */
const SETTLEGRID_PACKAGES = ['@settlegrid/mcp', '@settlegrid/sdk'] as const

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PackageJson {
  name?: string
  description?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

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

interface ScanResult {
  repo: string
  found: boolean
  action: 'created' | 'updated' | 'skipped' | 'error'
  slug?: string
  error?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Sanitizes a string into a URL-safe slug.
 */
function toSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128)
}

/**
 * Sanitizes free-text, stripping control characters.
 */
function sanitizeText(raw: string, maxLength: number): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  return cleaned.slice(0, maxLength)
}

/**
 * Checks whether a package.json contains any SettleGrid SDK package.
 */
function hasSettleGridSdk(pkg: PackageJson): boolean {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  return SETTLEGRID_PACKAGES.some((name) => name in allDeps)
}

/**
 * Extracts the first paragraph after the title from a README.
 * Returns null if no suitable paragraph is found.
 */
function extractReadmeDescription(readme: string): string | null {
  const lines = readme.split('\n')
  let pastTitle = false
  const paragraphLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip title lines (# heading or === underline)
    if (!pastTitle) {
      if (trimmed.startsWith('#') || trimmed.match(/^[=]+$/)) {
        pastTitle = true
        continue
      }
      // If the first non-empty line is not a heading, treat it as past the title
      if (trimmed.length > 0) {
        pastTitle = true
      }
    }

    if (pastTitle) {
      // Skip empty lines before the paragraph starts
      if (paragraphLines.length === 0 && trimmed.length === 0) {
        continue
      }

      // Stop at the next heading or empty line after content
      if (trimmed.length === 0 && paragraphLines.length > 0) {
        break
      }
      if (trimmed.startsWith('#')) {
        break
      }

      paragraphLines.push(trimmed)
    }
  }

  if (paragraphLines.length === 0) {
    return null
  }

  return paragraphLines.join(' ').slice(0, MAX_DESCRIPTION_LENGTH)
}

/**
 * Ensures the SettleGrid system developer row exists.
 * Returns the developer ID.
 */
async function ensureSystemDeveloper(): Promise<string> {
  const existing = await db
    .select({ id: developers.id })
    .from(developers)
    .where(eq(developers.slug, SYSTEM_DEVELOPER_SLUG))
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  const inserted = await db
    .insert(developers)
    .values({
      email: SYSTEM_DEVELOPER_EMAIL,
      name: SYSTEM_DEVELOPER_NAME,
      slug: SYSTEM_DEVELOPER_SLUG,
    })
    .returning({ id: developers.id })

  logger.info('github.webhook.system_developer_created', {
    developerId: inserted[0].id,
  })

  return inserted[0].id
}

// ─── Repository Scanning ───────────────────────────────────────────────────────

/**
 * Scans a single repository for SettleGrid SDK usage.
 *
 * 1. Fetches package.json
 * 2. Checks for @settlegrid/mcp or @settlegrid/sdk in dependencies
 * 3. If found, creates or updates a tool listing
 * 4. Fetches README.md for description enrichment
 */
export async function scanRepository(
  owner: string,
  repo: string,
  installationId: number
): Promise<ScanResult> {
  const repoFullName = `${owner}/${repo}`

  try {
    // Get installation token
    const token = await getInstallationToken(installationId)

    // Fetch package.json
    const packageJsonRaw = await fetchFileContent(token, owner, repo, 'package.json')

    if (!packageJsonRaw) {
      logger.info('github.scan.no_package_json', { repo: repoFullName })
      return { repo: repoFullName, found: false, action: 'skipped' }
    }

    let pkg: PackageJson
    try {
      pkg = JSON.parse(packageJsonRaw) as PackageJson
    } catch {
      logger.warn('github.scan.invalid_package_json', { repo: repoFullName })
      return { repo: repoFullName, found: false, action: 'skipped' }
    }

    // Check for SettleGrid SDK
    if (!hasSettleGridSdk(pkg)) {
      logger.info('github.scan.no_sdk', { repo: repoFullName })
      return { repo: repoFullName, found: false, action: 'skipped' }
    }

    logger.info('github.scan.sdk_found', { repo: repoFullName })

    // Extract metadata from package.json
    const rawName = typeof pkg.name === 'string' && pkg.name.trim().length > 0
      ? pkg.name.trim()
      : repo
    const name = sanitizeText(rawName, MAX_NAME_LENGTH)
    const slug = toSlug(rawName)

    if (slug.length === 0) {
      return { repo: repoFullName, found: true, action: 'skipped', error: 'Could not generate slug' }
    }

    // Try to get a richer description from the README
    let description: string | null = null

    const readmeRaw = await fetchFileContent(token, owner, repo, 'README.md')
    if (readmeRaw) {
      description = extractReadmeDescription(readmeRaw)
    }

    // Fall back to package.json description
    if (!description && typeof pkg.description === 'string' && pkg.description.trim().length > 0) {
      description = sanitizeText(pkg.description, MAX_DESCRIPTION_LENGTH)
    }

    // Ensure system developer exists
    const systemDeveloperId = await ensureSystemDeveloper()

    // Check if a tool with this slug already exists
    const existing = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.slug, slug))
      .limit(1)

    if (existing.length > 0) {
      // Update the existing tool's description if we have a better one
      if (description) {
        await db
          .update(tools)
          .set({
            description,
            updatedAt: new Date(),
          })
          .where(eq(tools.id, existing[0].id))
      }

      logger.info('github.scan.tool_updated', { repo: repoFullName, slug })
      return { repo: repoFullName, found: true, action: 'updated', slug }
    }

    // Create a new tool listing
    await db.insert(tools).values({
      developerId: systemDeveloperId,
      name,
      slug,
      description,
      status: 'discovered',
      category: null,
    })

    logger.info('github.scan.tool_created', { repo: repoFullName, slug, name })
    return { repo: repoFullName, found: true, action: 'created', slug }
  } catch (error) {
    logger.error(
      'github.scan.error',
      { repo: repoFullName },
      error
    )
    return {
      repo: repoFullName,
      found: false,
      action: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
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
