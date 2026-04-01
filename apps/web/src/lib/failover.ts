/**
 * SLA-Backed Tool Failover
 *
 * When the primary tool returns an error (timeout, 5xx), queries the
 * marketplace for the next-best tool in the same category and retries.
 *
 * Constraints:
 * - Only ONE failover attempt (no chaining)
 * - Bills at the ORIGINAL tool's rate
 * - Only fails over to tools with a proxy endpoint
 * - Respects the consumer's budget limits
 * - Logs the failover event
 */

import { eq, and, ne, isNotNull, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, consumers, consumerToolBalances } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FallbackTool {
  id: string
  slug: string
  name: string
  proxyEndpoint: string
}

export interface FailoverResult {
  attempted: boolean
  succeeded: boolean
  fallbackTool: FallbackTool | null
  error?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

/** HTTP status codes that trigger failover */
export const FAILOVER_STATUS_CODES = new Set([500, 502, 503, 504])

/** Maximum number of fallback candidates to query */
const FALLBACK_QUERY_LIMIT = 5

// ── Failover Logic ───────────────────────────────────────────────────────────

/**
 * Finds the best fallback tool in the same category as the original tool.
 *
 * Selection criteria:
 * - Same category as original
 * - Active status
 * - Has a proxy endpoint configured
 * - Not the original tool
 * - Ordered by total invocations (prefer proven tools)
 *
 * Returns null if no suitable fallback exists.
 */
export async function findFallbackTool(
  originalSlug: string,
  category: string | null
): Promise<FallbackTool | null> {
  if (!category) {
    return null
  }

  try {
    const results = await db
      .select({
        id: tools.id,
        slug: tools.slug,
        name: tools.name,
        proxyEndpoint: tools.proxyEndpoint,
      })
      .from(tools)
      .where(
        and(
          eq(tools.category, category),
          eq(tools.status, 'active'),
          isNotNull(tools.proxyEndpoint),
          ne(tools.slug, originalSlug)
        )
      )
      .orderBy(desc(tools.totalInvocations))
      .limit(FALLBACK_QUERY_LIMIT)

    if (results.length === 0) {
      return null
    }

    // Return the top candidate with a valid proxy endpoint
    const candidate = results[0]
    if (!candidate.proxyEndpoint) {
      return null
    }

    return {
      id: candidate.id,
      slug: candidate.slug,
      name: candidate.name,
      proxyEndpoint: candidate.proxyEndpoint,
    }
  } catch (err) {
    logger.error('failover.find_fallback_error', {
      originalSlug,
      category,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * Checks whether the consumer has sufficient balance for the failover call.
 * Checks both per-tool balance and global balance.
 */
export async function consumerCanAffordFailover(
  consumerId: string,
  costCents: number
): Promise<boolean> {
  if (costCents <= 0) {
    return true
  }

  try {
    // Check global balance
    const [consumer] = await db
      .select({ globalBalanceCents: consumers.globalBalanceCents })
      .from(consumers)
      .where(eq(consumers.id, consumerId))
      .limit(1)

    if (consumer && consumer.globalBalanceCents >= costCents) {
      return true
    }

    // Check aggregate per-tool balances
    const balances = await db
      .select({
        total: sql<number>`COALESCE(SUM(${consumerToolBalances.balanceCents}), 0)`,
      })
      .from(consumerToolBalances)
      .where(eq(consumerToolBalances.consumerId, consumerId))
      .limit(1)

    const totalToolBalance = balances[0]?.total ?? 0
    const globalBalance = consumer?.globalBalanceCents ?? 0

    return (totalToolBalance + globalBalance) >= costCents
  } catch {
    // On error, deny failover to prevent unbounded spending
    return false
  }
}

/**
 * Determines whether a given upstream response qualifies for failover.
 */
export function shouldAttemptFailover(
  upstreamStatus: number,
  isAbortError: boolean
): boolean {
  if (isAbortError) {
    return true // Timeout
  }
  return FAILOVER_STATUS_CODES.has(upstreamStatus)
}

/**
 * Logs a failover event for observability and auditing.
 */
export function logFailoverEvent(params: {
  originalSlug: string
  fallbackSlug: string
  consumerId: string
  costCents: number
  originalStatus: number | null
  fallbackStatus: number
  latencyMs: number
  requestId: string
}): void {
  logger.info('proxy.failover', {
    originalSlug: params.originalSlug,
    fallbackSlug: params.fallbackSlug,
    consumerId: params.consumerId,
    costCents: params.costCents,
    originalStatus: params.originalStatus,
    fallbackStatus: params.fallbackStatus,
    latencyMs: params.latencyMs,
    requestId: params.requestId,
  })
}

/**
 * Builds response headers that indicate a failover occurred.
 */
export function addFailoverHeaders(
  headers: Headers,
  fallbackSlug: string
): void {
  headers.set('X-SettleGrid-Failover', 'true')
  headers.set('X-SettleGrid-Failover-Tool', fallbackSlug)
}
