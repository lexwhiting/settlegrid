import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import type { CrawledServer } from '@/lib/registry-crawlers'
import { crawlNpmAiPackages } from '@/lib/crawlers/npm-ai-packages'
import { crawlHuggingFaceSpaces } from '@/lib/crawlers/huggingface-spaces'
import { crawlReplicateModels } from '@/lib/crawlers/replicate-models'

export const maxDuration = 300

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_SERVERS_PER_RUN = 100
const SYSTEM_DEVELOPER_EMAIL = 'system@settlegrid.com'
const SYSTEM_DEVELOPER_SLUG = 'settlegrid-system'
const SYSTEM_DEVELOPER_NAME = 'SettleGrid System'

/** Service sources in rotation order (cycles by day-of-year) */
const SERVICE_SOURCES = ['npm-ai', 'huggingface', 'replicate'] as const
type ServiceSource = (typeof SERVICE_SOURCES)[number]

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

  logger.info('cron.crawl_services.system_developer_created', {
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
  source: ServiceSource,
  systemDeveloperId: string,
): Promise<{ inserted: number; skipped: number }> {
  const batch = servers.slice(0, MAX_SERVERS_PER_RUN)

  // Fetch existing slugs in one bounded query to avoid N+1
  const existingSlugs = new Set(
    (await db.select({ slug: tools.slug }).from(tools).limit(50000)).map((row) => row.slug),
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
      server.description.length > 0 ? sanitizeText(server.description, 2000) : null

    try {
      await db.insert(tools).values({
        developerId: systemDeveloperId,
        name,
        slug,
        description,
        status: 'unclaimed',
        category: null,
        sourceRepoUrl: server.sourceUrl || null,
      })

      existingSlugs.add(slug)
      inserted++
    } catch (insertError) {
      // Unique constraint violation — another run may have inserted it concurrently
      logger.warn('cron.crawl_services.insert_conflict', {
        slug,
        source,
        error: insertError instanceof Error ? insertError.message : String(insertError),
      })
      skipped++
    }
  }

  return { inserted, skipped }
}

/**
 * Determines which service source to crawl based on the current day.
 * Rotates through sources using modulo on the day-of-year.
 */
function getSourceForCurrentDay(): ServiceSource {
  const now = new Date()
  const start = new Date(now.getUTCFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  const index = dayOfYear % SERVICE_SOURCES.length
  return SERVICE_SOURCES[index]
}

/**
 * Dispatches crawl to the appropriate source adapter.
 */
async function crawlServiceSource(
  source: ServiceSource,
  limit: number,
): Promise<CrawledServer[]> {
  switch (source) {
    case 'npm-ai':
      return crawlNpmAiPackages(limit)
    case 'huggingface':
      return crawlHuggingFaceSpaces(limit)
    case 'replicate':
      return crawlReplicateModels(limit)
    default:
      logger.warn('cron.crawl_services.unknown_source', { source })
      return []
  }
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: crawls non-MCP service registries for AI tools,
 * ML models, and inference endpoints. Indexes newly discovered ones
 * as unclaimed tools in the SettleGrid catalog.
 *
 * Rotates through 3 sources on a daily cycle:
 *   Day 1 (dayOfYear % 3 == 0): npm AI packages
 *   Day 2 (dayOfYear % 3 == 1): Hugging Face Spaces
 *   Day 3 (dayOfYear % 3 == 2): Replicate models
 *
 * Schedule: daily at noon UTC
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `cron-crawl-services:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    // Verify CRON_SECRET header (fail-closed: reject if secret is not configured)
    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.crawl_services.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    // Determine which source to crawl this run
    const source = getSourceForCurrentDay()
    logger.info('cron.crawl_services.starting', { source })

    // Crawl the selected source
    const servers = await crawlServiceSource(source, MAX_SERVERS_PER_RUN)

    if (servers.length === 0) {
      logger.info('cron.crawl_services.no_data', {
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

    logger.info('cron.crawl_services.completed', {
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
