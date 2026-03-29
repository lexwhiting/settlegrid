import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import {
  crawlSource,
  getSourceForCurrentRun,
  type CrawledServer,
  type RegistrySource,
} from '@/lib/registry-crawlers'

export const maxDuration = 300

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_SERVERS_PER_RUN = 100
const SYSTEM_DEVELOPER_EMAIL = 'system@settlegrid.com'
const SYSTEM_DEVELOPER_SLUG = 'settlegrid-system'
const SYSTEM_DEVELOPER_NAME = 'SettleGrid System'

/**
 * Maps registry crawler source identifiers to the `source_ecosystem` column values.
 */
const SOURCE_TO_ECOSYSTEM: Record<string, string> = {
  'mcp-registry': 'mcp-registry',
  'pulsemcp': 'pulsemcp',
  'smithery': 'smithery',
  'npm': 'npm',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Sanitizes a server name into a URL-safe slug.
 * Strips non-alphanumeric characters (except hyphens), lowercases,
 * collapses runs of hyphens, and trims leading/trailing hyphens.
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
 * Sanitizes a free-text string from an external API.
 * Removes control characters and trims to the given max length.
 */
function sanitizeText(raw: string, maxLength: number): string {
  // Strip control chars (except newline / tab for descriptions)
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  return cleaned.slice(0, maxLength)
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

  logger.info('cron.crawl_registry.system_developer_created', {
    developerId: inserted[0].id,
  })

  return inserted[0].id
}

/**
 * Processes a batch of crawled servers: deduplicates, sanitizes, and inserts
 * new tools into the database.
 */
async function processBatch(
  servers: CrawledServer[],
  source: RegistrySource,
  systemDeveloperId: string
): Promise<{ inserted: number; skipped: number }> {
  // Cap to MAX_SERVERS_PER_RUN
  const batch = servers.slice(0, MAX_SERVERS_PER_RUN)

  // Fetch existing slugs in one bounded query to avoid N+1
  const existingSlugs = new Set(
    (await db.select({ slug: tools.slug }).from(tools).limit(50000)).map((row) => row.slug)
  )

  let inserted = 0
  let skipped = 0

  for (const server of batch) {
    const rawName = server.name.trim()
    if (rawName.length === 0) {
      skipped++
      continue
    }

    const slug = toSlug(rawName)
    if (slug.length === 0) {
      skipped++
      continue
    }

    // Skip if tool with this slug already exists
    if (existingSlugs.has(slug)) {
      skipped++
      continue
    }

    const name = sanitizeText(rawName, 256)
    const description =
      server.description.length > 0
        ? sanitizeText(server.description, 2000)
        : null

    // Map the crawler source to the source_ecosystem column value
    const sourceEcosystem = SOURCE_TO_ECOSYSTEM[server.source] ?? server.source

    // Store enrichment metadata in crawl_metadata JSONB column
    const crawlMetadata = server.enrichment
      ? JSON.parse(JSON.stringify(server.enrichment))
      : null

    try {
      await db.insert(tools).values({
        developerId: systemDeveloperId,
        name,
        slug,
        description,
        status: 'unclaimed',
        category: null,
        sourceRepoUrl: server.sourceUrl || null,
        toolType: 'mcp-server', // Registry crawlers discover MCP servers
        sourceEcosystem,
        crawlMetadata,
      })

      // Track the slug so later servers in the same batch don't duplicate
      existingSlugs.add(slug)
      inserted++
    } catch (insertError) {
      // Unique constraint violation — another run may have inserted it concurrently
      logger.warn('cron.crawl_registry.insert_conflict', {
        slug,
        source,
        error: insertError instanceof Error ? insertError.message : String(insertError),
      })
      skipped++
    }
  }

  return { inserted, skipped }
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: crawls MCP registries for public servers
 * and indexes newly discovered ones as unclaimed tools in the SettleGrid catalog.
 *
 * Rotates through 4 sources on each run:
 *   Run 1 (hour % 4 == 0): Official MCP Registry
 *   Run 2 (hour % 4 == 1): PulseMCP
 *   Run 3 (hour % 4 == 2): Smithery
 *   Run 4 (hour % 4 == 3): npm search
 *
 * Schedule: every 6 hours
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-crawl-registry:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.crawl_registry.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Determine which source to crawl this run
    const source = getSourceForCurrentRun()
    logger.info('cron.crawl_registry.starting', { source })

    // Crawl the selected source
    const servers = await crawlSource(source, MAX_SERVERS_PER_RUN)

    if (servers.length === 0) {
      logger.info('cron.crawl_registry.no_data', {
        source,
        msg: 'Source returned 0 servers',
      })
      return successResponse({
        source,
        discovered: 0,
        inserted: 0,
        skipped: 0,
        message: `${source} returned 0 servers`,
      })
    }

    // Ensure system developer exists (needed for FK on unclaimed tools)
    const systemDeveloperId = await ensureSystemDeveloper()

    // Process and insert new tools
    const { inserted, skipped } = await processBatch(servers, source, systemDeveloperId)

    logger.info('cron.crawl_registry.completed', {
      source,
      discovered: servers.length,
      inserted,
      skipped,
    })

    return successResponse({
      source,
      discovered: servers.length,
      inserted,
      skipped,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
