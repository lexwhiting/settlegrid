/**
 * Crawl Offset Tracker — Redis-backed pagination state for crawlers.
 *
 * Each crawler source stores its current offset/cursor in Redis so
 * successive cron runs continue from where the last run left off,
 * progressively paginating through the full catalog instead of
 * re-fetching page 1 every time.
 *
 * Keys:
 *   crawl:offset:{source}   — current numeric offset (or cursor string)
 *   crawl:total:{source}    — total tools indexed from this source
 *   crawl:lastRun:{source}  — ISO timestamp of last successful crawl
 *
 * Reset strategy:
 *   When a crawler reaches the end of a catalog (empty page returned),
 *   the offset resets to 0 so the next run starts from the beginning
 *   to pick up newly added tools. A monthly forced reset also runs
 *   to re-scan early pages for new additions.
 */

import { getRedis, tryRedis } from './redis'
import { logger } from './logger'

// ─── Constants ──────────────────────────────────────────────────────────────

const KEY_PREFIX = 'crawl:offset'
const TOTAL_KEY_PREFIX = 'crawl:total'
const LAST_RUN_KEY_PREFIX = 'crawl:lastRun'

/** Force reset offsets every 30 days to re-scan early pages */
const MONTHLY_RESET_DAYS = 30
const MS_PER_DAY = 86_400_000

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrawlOffsetState {
  /** Current numeric offset for the source */
  offset: number
  /** Total tools indexed from this source (cumulative) */
  totalIndexed: number
  /** ISO timestamp of last successful crawl run */
  lastRunAt: string | null
}

// ─── Core functions ─────────────────────────────────────────────────────────

/**
 * Retrieves the current crawl offset for a source.
 * Returns 0 if no offset is stored (first run or after reset).
 */
export async function getCrawlOffset(source: string): Promise<number> {
  const key = `${KEY_PREFIX}:${source}`
  const value = await tryRedis(() => getRedis().get<number>(key))
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Updates the crawl offset for a source after a successful run.
 * Also updates the lastRun timestamp.
 */
export async function setCrawlOffset(source: string, offset: number): Promise<void> {
  const key = `${KEY_PREFIX}:${source}`
  const lastRunKey = `${LAST_RUN_KEY_PREFIX}:${source}`
  const now = new Date().toISOString()

  await tryRedis(async () => {
    const redis = getRedis()
    await redis.set(key, offset)
    await redis.set(lastRunKey, now)
  })
}

/**
 * Resets the crawl offset to 0 (used when end-of-catalog is reached
 * or when a monthly reset is triggered).
 */
export async function resetCrawlOffset(source: string): Promise<void> {
  const key = `${KEY_PREFIX}:${source}`
  await tryRedis(() => getRedis().set(key, 0))

  logger.info('crawl.offset.reset', { source })
}

/**
 * Increments the total-indexed counter for a source.
 * Fire-and-forget — does not block on Redis failure.
 */
export async function incrementCrawlTotal(source: string, count: number): Promise<void> {
  if (count <= 0) return
  const key = `${TOTAL_KEY_PREFIX}:${source}`
  await tryRedis(() => getRedis().incrby(key, count))
}

/**
 * Retrieves the total tools indexed for a source.
 */
export async function getCrawlTotal(source: string): Promise<number> {
  const key = `${TOTAL_KEY_PREFIX}:${source}`
  const value = await tryRedis(() => getRedis().get<number>(key))
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Retrieves the full crawl state for a source (offset, total, lastRun).
 */
export async function getCrawlState(source: string): Promise<CrawlOffsetState> {
  const [offset, totalIndexed, lastRunAt] = await Promise.all([
    getCrawlOffset(source),
    getCrawlTotal(source),
    tryRedis(() => getRedis().get<string>(`${LAST_RUN_KEY_PREFIX}:${source}`)),
  ])

  return {
    offset,
    totalIndexed,
    lastRunAt: typeof lastRunAt === 'string' ? lastRunAt : null,
  }
}

/**
 * Checks whether a monthly offset reset is due for a source.
 * Returns true if lastRun is older than MONTHLY_RESET_DAYS and offset > 0.
 */
export async function shouldMonthlyReset(source: string): Promise<boolean> {
  const lastRunStr = await tryRedis(() =>
    getRedis().get<string>(`${LAST_RUN_KEY_PREFIX}:${source}`)
  )

  if (typeof lastRunStr !== 'string') return false

  const offset = await getCrawlOffset(source)
  if (offset === 0) return false

  const lastRun = new Date(lastRunStr).getTime()
  if (!Number.isFinite(lastRun)) return false

  const daysSinceLastReset = (Date.now() - lastRun) / MS_PER_DAY
  return daysSinceLastReset >= MONTHLY_RESET_DAYS
}

/**
 * Performs the monthly reset check and resets if needed.
 * Returns true if a reset was performed.
 */
export async function maybeMonthlyReset(source: string): Promise<boolean> {
  const shouldReset = await shouldMonthlyReset(source)
  if (shouldReset) {
    await resetCrawlOffset(source)
    logger.info('crawl.offset.monthly_reset', { source })
    return true
  }
  return false
}
