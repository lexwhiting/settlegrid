import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import {
  crawlUniversalSource,
  getUniversalSourceForDay,
  getAdditionalSources,
  type CrawledService,
  type UniversalSource,
} from '@/lib/universal-crawlers'
import { submitToolSlugsToIndexNow } from '@/lib/indexnow'
import {
  getCrawlOffset,
  setCrawlOffset,
  resetCrawlOffset,
  incrementCrawlTotal,
  getCrawlTotal,
  maybeMonthlyReset,
} from '@/lib/crawl-offset'

export const maxDuration = 300

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_SERVICES_PER_RUN = 300
const SYSTEM_DEVELOPER_EMAIL = 'system@settlegrid.com'
const SYSTEM_DEVELOPER_SLUG = 'settlegrid-system'
const SYSTEM_DEVELOPER_NAME = 'SettleGrid System'

/**
 * Maps crawler source identifiers to the `source_ecosystem` column values.
 */
const SOURCE_TO_ECOSYSTEM: Record<string, string> = {
  'huggingface': 'huggingface',
  'apify': 'apify',
  'pypi': 'pypi',
  'replicate': 'replicate',
  'npm': 'npm',
  'npm-ai': 'npm',
  'github': 'github',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Sanitizes a server name into a URL-safe slug.
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
 */
function sanitizeText(raw: string, maxLength: number): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  return cleaned.slice(0, maxLength)
}

/**
 * Ensures the SettleGrid system developer row exists.
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
 * Processes a batch of crawled services: deduplicates, sanitizes, and inserts
 * new tools into the database with proper toolType and sourceEcosystem.
 *
 * Dedup strategy: loads existing slugs into a Set for in-memory dedup.
 * At 10K-50K tools this is ~2-4MB which is well within Vercel's memory limits.
 * The DB also has a unique constraint on slug as a safety net.
 */
async function processBatch(
  services: CrawledService[],
  universalSource: UniversalSource,
  systemDeveloperId: string,
): Promise<{ inserted: number; skipped: number; insertedSlugs: string[] }> {
  const batch = services.slice(0, MAX_SERVICES_PER_RUN)

  // Fetch existing slugs in one bounded query to avoid N+1
  const existingSlugs = new Set(
    (await db.select({ slug: tools.slug }).from(tools).limit(100000)).map((row) => row.slug),
  )

  let inserted = 0
  let skipped = 0
  const insertedSlugs: string[] = []

  for (const service of batch) {
    const rawName = service.name.trim()
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
      service.description.length > 0 ? sanitizeText(service.description, 2000) : null

    // Map the crawler source to the source_ecosystem column value
    const sourceEcosystem = SOURCE_TO_ECOSYSTEM[service.source] ?? service.source

    // Store enrichment metadata in crawl_metadata JSONB column
    const crawlMetadata = service.enrichment
      ? JSON.parse(JSON.stringify(service.enrichment))
      : null

    try {
      await db.insert(tools).values({
        developerId: systemDeveloperId,
        name,
        slug,
        description,
        status: 'unclaimed',
        category: null,
        sourceRepoUrl: service.sourceUrl || null,
        toolType: service.toolType,
        sourceEcosystem,
        crawlMetadata,
      })

      existingSlugs.add(slug)
      insertedSlugs.push(slug)
      inserted++
    } catch (insertError) {
      // Unique constraint violation — another run may have inserted it concurrently
      logger.warn('cron.crawl_services.insert_conflict', {
        slug,
        source: universalSource,
        error: insertError instanceof Error ? insertError.message : String(insertError),
      })
      skipped++
    }
  }

  return { inserted, skipped, insertedSlugs }
}

// ─── Route Handler ──────────────────────────────────────────────────────────────

/**
 * Vercel Cron handler: crawls universal AI tool ecosystems for models,
 * APIs, agents, SDK packages, and automation actors. Indexes newly
 * discovered ones as unclaimed tools in the SettleGrid catalog.
 *
 * Pagination: Each source maintains its own offset in Redis. Each run
 * continues from where the last run left off, progressively walking
 * through the full catalog. When the end is reached, the offset resets
 * to 0 to catch new additions.
 *
 * Runs 2-3 sources per invocation:
 *   1. The primary source (rotated daily through 7 sources)
 *   2. 1-2 additional high-priority sources (HuggingFace models/spaces)
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

    // Build the list of sources: primary (rotated) + high-priority extras
    const primary = getUniversalSourceForDay()
    const additional = getAdditionalSources(primary)
    const sourcesToCrawl: UniversalSource[] = [primary, ...additional]

    logger.info('cron.crawl_services.starting', {
      primary,
      additional,
      totalSources: sourcesToCrawl.length,
    })

    // Ensure system developer exists (needed for FK on unclaimed tools)
    const systemDeveloperId = await ensureSystemDeveloper()

    // Crawl each source sequentially (avoids timeout from parallel fetches)
    const sourceResults: Array<{
      source: UniversalSource
      offset: number
      nextOffset: number | null
      discovered: number
      inserted: number
      skipped: number
      totalIndexed: number
      endOfCatalog: boolean
    }> = []

    let totalInserted = 0
    const allInsertedSlugs: string[] = []

    for (const source of sourcesToCrawl) {
      try {
        // Check for monthly offset reset
        await maybeMonthlyReset(source)

        // Read current offset from Redis
        const currentOffset = await getCrawlOffset(source)

        logger.info('cron.crawl_services.source_starting', {
          source,
          offset: currentOffset,
        })

        const { services, nextOffset, endOfCatalog } = await crawlUniversalSource(
          source,
          MAX_SERVICES_PER_RUN,
          currentOffset,
        )

        // Update offset in Redis
        if (endOfCatalog || nextOffset === null) {
          await resetCrawlOffset(source)
        } else {
          await setCrawlOffset(source, nextOffset)
        }

        if (services.length === 0) {
          logger.info('cron.crawl_services.source_no_data', {
            source,
            offset: currentOffset,
            msg: 'Source returned 0 services',
            endOfCatalog,
          })
          const totalIndexed = await getCrawlTotal(source)
          sourceResults.push({
            source,
            offset: currentOffset,
            nextOffset: endOfCatalog ? 0 : nextOffset,
            discovered: 0,
            inserted: 0,
            skipped: 0,
            totalIndexed,
            endOfCatalog,
          })
          continue
        }

        const { inserted, skipped, insertedSlugs } = await processBatch(
          services,
          source,
          systemDeveloperId,
        )

        // Update cumulative total
        await incrementCrawlTotal(source, inserted)
        const totalIndexed = await getCrawlTotal(source)

        logger.info('cron.crawl_services.source_completed', {
          source,
          offset: currentOffset,
          nextOffset: endOfCatalog ? 0 : nextOffset,
          discovered: services.length,
          inserted,
          skipped,
          totalIndexed,
          endOfCatalog,
        })

        sourceResults.push({
          source,
          offset: currentOffset,
          nextOffset: endOfCatalog ? 0 : nextOffset,
          discovered: services.length,
          inserted,
          skipped,
          totalIndexed,
          endOfCatalog,
        })
        totalInserted += inserted
        allInsertedSlugs.push(...insertedSlugs)
      } catch (sourceError) {
        logger.warn('cron.crawl_services.source_failed', {
          source,
          error: sourceError instanceof Error ? sourceError.message : String(sourceError),
        })
        sourceResults.push({
          source,
          offset: 0,
          nextOffset: null,
          discovered: 0,
          inserted: 0,
          skipped: 0,
          totalIndexed: 0,
          endOfCatalog: false,
        })
        // Continue to next source
      }
    }

    // Submit newly inserted tool pages to IndexNow for rapid search engine indexing
    const indexNowResult = await submitToolSlugsToIndexNow(allInsertedSlugs)

    logger.info('cron.crawl_services.completed', {
      sourcesRun: sourceResults.length,
      totalInserted,
      indexNowSubmitted: indexNowResult?.submitted ?? 0,
    })

    return successResponse({
      sources: sourceResults,
      totalInserted,
      indexNow: indexNowResult
        ? { submitted: indexNowResult.submitted, ok: indexNowResult.ok }
        : null,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
