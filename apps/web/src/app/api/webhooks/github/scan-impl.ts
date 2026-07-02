/**
 * Pure scanning logic + helpers for the GitHub-app integration.
 *
 * Lives in a sibling file (NOT route.ts) because Next.js App Router's
 * Route segment type-check rejects any export from `route.ts` that
 * isn't an HTTP method handler or a recognized config export.
 *
 * Two route handlers import from here:
 *   - `apps/web/src/app/api/webhooks/github/route.ts` (the webhook)
 *   - `apps/web/src/app/api/github/scan/route.ts` (manual scan trigger)
 *
 * Keeping the implementation in a sibling file lets both routes share
 * one definition without either route.ts needing to re-export it.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { getInstallationToken, fetchFileContent } from '@/lib/github'
import { SYSTEM_DEVELOPER_EMAIL, SYSTEM_DEVELOPER_SLUG, SYSTEM_DEVELOPER_NAME } from '@/lib/system-principal'

// ─── Constants ──────────────────────────────────────────────────────────────

export const MAX_NAME_LENGTH = 256
export const MAX_DESCRIPTION_LENGTH = 2000

/** SDK package names that indicate a SettleGrid tool */
const SETTLEGRID_PACKAGES = ['@settlegrid/mcp', '@settlegrid/sdk'] as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PackageJson {
  name?: string
  description?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

export interface ScanResult {
  repo: string
  found: boolean
  action: 'created' | 'updated' | 'skipped' | 'error'
  slug?: string
  error?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Sanitizes a string into a URL-safe slug. */
export function toSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128)
}

/** Sanitizes free-text, stripping control characters. */
export function sanitizeText(raw: string, maxLength: number): string {
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  return cleaned.slice(0, maxLength)
}

/** Checks whether a package.json contains any SettleGrid SDK package. */
export function hasSettleGridSdk(pkg: PackageJson): boolean {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  return SETTLEGRID_PACKAGES.some((name) => name in allDeps)
}

/**
 * Extracts the first paragraph after the title from a README.
 * Returns null if no suitable paragraph is found.
 */
export function extractReadmeDescription(readme: string): string | null {
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
      if (trimmed.length > 0) {
        pastTitle = true
      }
    }

    if (pastTitle) {
      if (paragraphLines.length === 0 && trimmed.length === 0) {
        continue
      }
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
export async function ensureSystemDeveloper(): Promise<string> {
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

// ─── Repository Scanning ───────────────────────────────────────────────────

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
  installationId: number,
): Promise<ScanResult> {
  const repoFullName = `${owner}/${repo}`

  try {
    const token = await getInstallationToken(installationId)
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

    if (!hasSettleGridSdk(pkg)) {
      logger.info('github.scan.no_sdk', { repo: repoFullName })
      return { repo: repoFullName, found: false, action: 'skipped' }
    }

    logger.info('github.scan.sdk_found', { repo: repoFullName })

    const rawName =
      typeof pkg.name === 'string' && pkg.name.trim().length > 0
        ? pkg.name.trim()
        : repo
    const name = sanitizeText(rawName, MAX_NAME_LENGTH)
    const slug = toSlug(rawName)

    if (slug.length === 0) {
      return {
        repo: repoFullName,
        found: true,
        action: 'skipped',
        error: 'Could not generate slug',
      }
    }

    let description: string | null = null

    const readmeRaw = await fetchFileContent(token, owner, repo, 'README.md')
    if (readmeRaw) {
      description = extractReadmeDescription(readmeRaw)
    }

    if (
      !description &&
      typeof pkg.description === 'string' &&
      pkg.description.trim().length > 0
    ) {
      description = sanitizeText(pkg.description, MAX_DESCRIPTION_LENGTH)
    }

    const systemDeveloperId = await ensureSystemDeveloper()

    const existing = await db
      .select({ id: tools.id })
      .from(tools)
      .where(eq(tools.slug, slug))
      .limit(1)

    if (existing.length > 0) {
      if (description) {
        await db
          .update(tools)
          .set({ description, updatedAt: new Date() })
          .where(eq(tools.id, existing[0].id))
      }

      logger.info('github.scan.tool_updated', { repo: repoFullName, slug })
      return { repo: repoFullName, found: true, action: 'updated', slug }
    }

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
    logger.error('github.scan.error', { repo: repoFullName }, error)
    return {
      repo: repoFullName,
      found: false,
      action: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
