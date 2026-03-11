import { getRedis, tryRedis } from './redis'
import { db } from './db'
import { consumerToolBalances, invocations, tools, developers } from './db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { logger } from './logger'

// ─── Redis Key Helpers ──────────────────────────────────────────────────────

function balanceKey(consumerId: string, toolId: string): string {
  return `balance:${consumerId}:${toolId}`
}

function budgetSpendKey(consumerId: string, toolId: string): string {
  return `budget:spend:${consumerId}:${toolId}`
}

function budgetLimitKey(consumerId: string, toolId: string): string {
  return `budget:limit:${consumerId}:${toolId}`
}

function budgetResetKey(consumerId: string, toolId: string): string {
  return `budget:reset:${consumerId}:${toolId}`
}

// ─── Budget Enforcement ─────────────────────────────────────────────────────

export interface BudgetCheckResult {
  allowed: boolean
  reason?: string
  currentSpendCents?: number
  limitCents?: number | null
}

/**
 * Check if a metering deduction would exceed the consumer's budget.
 * Auto-resets the period if periodResetAt has passed.
 * Returns { allowed: true } if no budget is set or within limits.
 */
export async function checkBudget(
  consumerId: string,
  toolId: string,
  costCents: number
): Promise<BudgetCheckResult> {
  // Try Redis first for budget data
  const redis = getRedis()
  const [limitStr, spendStr, resetStr] = await Promise.all([
    tryRedis(() => redis.get<string>(budgetLimitKey(consumerId, toolId))),
    tryRedis(() => redis.get<string>(budgetSpendKey(consumerId, toolId))),
    tryRedis(() => redis.get<string>(budgetResetKey(consumerId, toolId))),
  ])

  // If Redis has limit data, use it
  if (limitStr !== null && limitStr !== undefined) {
    const limitCents = parseInt(String(limitStr), 10)
    if (isNaN(limitCents)) return { allowed: true }

    // Check if period needs reset
    if (resetStr) {
      const resetAt = new Date(String(resetStr))
      if (resetAt <= new Date()) {
        // Period has elapsed — reset spend in Redis
        await tryRedis(() => redis.set(budgetSpendKey(consumerId, toolId), '0'))
        // Reset in DB too (fire-and-forget)
        resetBudgetPeriodInDb(consumerId, toolId).catch(() => {})
        return { allowed: true, currentSpendCents: 0, limitCents }
      }
    }

    const currentSpend = spendStr !== null && spendStr !== undefined ? parseInt(String(spendStr), 10) : 0
    const finalSpend = isNaN(currentSpend) ? 0 : currentSpend

    if (finalSpend + costCents > limitCents) {
      return {
        allowed: false,
        reason: 'BUDGET_EXCEEDED',
        currentSpendCents: finalSpend,
        limitCents,
      }
    }
    return { allowed: true, currentSpendCents: finalSpend, limitCents }
  }

  // Fallback: check DB directly
  const [balance] = await db
    .select({
      spendingLimitCents: consumerToolBalances.spendingLimitCents,
      currentPeriodSpendCents: consumerToolBalances.currentPeriodSpendCents,
      periodResetAt: consumerToolBalances.periodResetAt,
    })
    .from(consumerToolBalances)
    .where(
      and(
        eq(consumerToolBalances.consumerId, consumerId),
        eq(consumerToolBalances.toolId, toolId)
      )
    )
    .limit(1)

  if (!balance || balance.spendingLimitCents === null || balance.spendingLimitCents === undefined) {
    return { allowed: true }
  }

  // Auto-reset period if elapsed
  if (balance.periodResetAt && new Date(balance.periodResetAt) <= new Date()) {
    await resetBudgetPeriodInDb(consumerId, toolId)
    return { allowed: true, currentSpendCents: 0, limitCents: balance.spendingLimitCents }
  }

  if (balance.currentPeriodSpendCents + costCents > balance.spendingLimitCents) {
    return {
      allowed: false,
      reason: 'BUDGET_EXCEEDED',
      currentSpendCents: balance.currentPeriodSpendCents,
      limitCents: balance.spendingLimitCents,
    }
  }

  // Hydrate Redis for next time
  hydrateBudgetToRedis(consumerId, toolId, balance).catch(() => {})

  return { allowed: true, currentSpendCents: balance.currentPeriodSpendCents, limitCents: balance.spendingLimitCents }
}

async function resetBudgetPeriodInDb(consumerId: string, toolId: string): Promise<void> {
  // Compute next reset (30 days from now as default)
  const nextReset = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db
    .update(consumerToolBalances)
    .set({
      currentPeriodSpendCents: 0,
      periodResetAt: nextReset,
    })
    .where(
      and(
        eq(consumerToolBalances.consumerId, consumerId),
        eq(consumerToolBalances.toolId, toolId)
      )
    )
}

async function hydrateBudgetToRedis(
  consumerId: string,
  toolId: string,
  data: { spendingLimitCents: number | null; currentPeriodSpendCents: number; periodResetAt: Date | null }
): Promise<void> {
  const redis = getRedis()
  if (data.spendingLimitCents !== null) {
    await Promise.all([
      redis.set(budgetLimitKey(consumerId, toolId), String(data.spendingLimitCents)),
      redis.set(budgetSpendKey(consumerId, toolId), String(data.currentPeriodSpendCents)),
      ...(data.periodResetAt
        ? [redis.set(budgetResetKey(consumerId, toolId), data.periodResetAt.toISOString())]
        : []),
    ])
  }
}

/**
 * Increment the period spend after a successful deduction.
 */
export async function incrementPeriodSpend(
  consumerId: string,
  toolId: string,
  costCents: number
): Promise<void> {
  const redis = getRedis()
  // Increment Redis (fire-and-forget)
  tryRedis(() => redis.incrby(budgetSpendKey(consumerId, toolId), costCents)).catch(() => {})

  // Increment DB (fire-and-forget)
  db.update(consumerToolBalances)
    .set({
      currentPeriodSpendCents: sql`${consumerToolBalances.currentPeriodSpendCents} + ${costCents}`,
    })
    .where(
      and(
        eq(consumerToolBalances.consumerId, consumerId),
        eq(consumerToolBalances.toolId, toolId)
      )
    )
    .then(() => {})
    .catch(() => {})
}

// ─── Credit Balance (Redis-accelerated) ─────────────────────────────────────

/**
 * Hydrate a consumer's balance from DB into Redis.
 */
export async function hydrateBalance(consumerId: string, toolId: string): Promise<number | null> {
  const [balance] = await db
    .select({ balanceCents: consumerToolBalances.balanceCents })
    .from(consumerToolBalances)
    .where(
      and(
        eq(consumerToolBalances.consumerId, consumerId),
        eq(consumerToolBalances.toolId, toolId)
      )
    )
    .limit(1)

  if (!balance) return null

  const redis = getRedis()
  await tryRedis(() => redis.set(balanceKey(consumerId, toolId), balance.balanceCents))
  return balance.balanceCents
}

/**
 * Get balance from Redis (with DB fallback + hydration).
 */
export async function getBalance(consumerId: string, toolId: string): Promise<number | null> {
  const redis = getRedis()
  const cached = await tryRedis(() => redis.get<number>(balanceKey(consumerId, toolId)))
  if (cached !== null && cached !== undefined) return cached
  return hydrateBalance(consumerId, toolId)
}

/**
 * Deduct credits via Redis DECRBY (fast path).
 * Returns remaining balance, or null if Redis unavailable.
 */
export async function deductCreditsRedis(
  consumerId: string,
  toolId: string,
  costCents: number
): Promise<number | null> {
  const redis = getRedis()
  const key = balanceKey(consumerId, toolId)

  // Ensure key exists (hydrate if not)
  const exists = await tryRedis(() => redis.exists(key))
  if (!exists) {
    const hydrated = await hydrateBalance(consumerId, toolId)
    if (hydrated === null) return null
  }

  // Atomic DECRBY
  const remaining = await tryRedis(() => redis.decrby(key, costCents))
  if (remaining === null) return null

  // If we went negative, rollback Redis and return null (insufficient)
  if (remaining < 0) {
    await tryRedis(() => redis.incrby(key, costCents))
    return null
  }

  return remaining
}

/**
 * Async writeback: persist the deduction to the database.
 * Fire-and-forget — failure is handled by periodic reconciliation.
 */
export function recordInvocationAsync(params: {
  toolId: string
  consumerId: string
  keyId: string
  method: string
  costCents: number
  latencyMs: number | null
  developerId: string
  revenueSharePct: number
}): void {
  const { toolId, consumerId, keyId, method, costCents, latencyMs, developerId, revenueSharePct } = params
  const developerShareCents = Math.floor(costCents * (revenueSharePct / 100))

  // All DB writes in parallel (fire-and-forget)
  Promise.all([
    // Deduct from DB balance
    db.update(consumerToolBalances)
      .set({ balanceCents: sql`${consumerToolBalances.balanceCents} - ${costCents}` })
      .where(
        and(
          eq(consumerToolBalances.consumerId, consumerId),
          eq(consumerToolBalances.toolId, toolId)
        )
      ),
    // Increment tool stats
    db.update(tools)
      .set({
        totalInvocations: sql`${tools.totalInvocations} + 1`,
        totalRevenueCents: sql`${tools.totalRevenueCents} + ${costCents}`,
        updatedAt: new Date(),
      })
      .where(eq(tools.id, toolId)),
    // Developer revenue share
    db.update(developers)
      .set({
        balanceCents: sql`${developers.balanceCents} + ${developerShareCents}`,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, developerId)),
    // Insert invocation record
    db.insert(invocations)
      .values({
        toolId,
        consumerId,
        apiKeyId: keyId,
        method,
        costCents,
        latencyMs,
        status: 'success',
      }),
  ]).catch((err) => {
    logger.error('metering.writeback_failed', { toolId, consumerId, costCents }, err)
  })
}

/**
 * Invalidate Redis balance cache (call on purchase/refund).
 */
export async function invalidateBalanceCache(consumerId: string, toolId: string): Promise<void> {
  const redis = getRedis()
  await tryRedis(() => redis.del(balanceKey(consumerId, toolId)))
}

/**
 * Sync budget data to Redis (call on budget set/update).
 */
export async function syncBudgetToRedis(
  consumerId: string,
  toolId: string,
  spendingLimitCents: number | null,
  currentPeriodSpendCents: number,
  periodResetAt: Date | null
): Promise<void> {
  const redis = getRedis()
  if (spendingLimitCents !== null) {
    await Promise.all([
      redis.set(budgetLimitKey(consumerId, toolId), String(spendingLimitCents)),
      redis.set(budgetSpendKey(consumerId, toolId), String(currentPeriodSpendCents)),
      ...(periodResetAt
        ? [redis.set(budgetResetKey(consumerId, toolId), periodResetAt.toISOString())]
        : []),
    ])
  } else {
    // Remove budget keys if limit is cleared
    await Promise.all([
      redis.del(budgetLimitKey(consumerId, toolId)),
      redis.del(budgetSpendKey(consumerId, toolId)),
      redis.del(budgetResetKey(consumerId, toolId)),
    ])
  }
}
