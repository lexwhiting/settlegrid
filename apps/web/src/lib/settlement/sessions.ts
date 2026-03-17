/**
 * Workflow session management for multi-hop budget delegation and settlement.
 *
 * Sessions track budget allocation across multi-agent workflows.
 * Redis provides fast-path budget checks; PostgreSQL is the durable store.
 *
 * Phase 4 additions: recordHop, finalizeSession, processSettlementBatch,
 * rollbackSettlementBatch, expireStaleSessionsBatch.
 */

import { db } from '@/lib/db'
import { workflowSessions, settlementBatches, tools, developers, organizations } from '@/lib/db/schema'
import { eq, and, sql, lt } from 'drizzle-orm'
import { getRedis, tryRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'
import type { SessionCreateParams, SessionState } from './types'
import type {
  SessionHop,
  SessionDisbursement,
  RecordHopInput,
  FinalizeResult,
} from './session-types'

// ─── Redis Key Helpers ───────────────────────────────────────────────────────

function sessionBudgetKey(sessionId: string): string {
  return `session:budget:${sessionId}`
}
function sessionSpentKey(sessionId: string): string {
  return `session:spent:${sessionId}`
}
function sessionReservedKey(sessionId: string): string {
  return `session:reserved:${sessionId}`
}

// ─── Create Session ──────────────────────────────────────────────────────────

/**
 * Create a new workflow session with a budget.
 * If parentSessionId is provided, this is a delegation -- the parent's
 * reserved amount is increased by budgetCents.
 */
export async function createSession(params: SessionCreateParams): Promise<SessionState> {
  const {
    customerId,
    budgetCents,
    expiresIn = 3600,
    parentSessionId,
    protocol,
    orgId,
    metadata,
  } = params

  if (budgetCents <= 0) {
    throw new Error('Session budget must be positive')
  }

  // ── Organization budget enforcement ──
  if (orgId) {
    const [org] = await db
      .select({
        monthlyBudgetCents: organizations.monthlyBudgetCents,
        currentMonthSpendCents: organizations.currentMonthSpendCents,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!org) {
      throw new Error(`Organization not found: ${orgId}`)
    }

    // null budget = unlimited
    if (org.monthlyBudgetCents !== null) {
      const remaining = org.monthlyBudgetCents - org.currentMonthSpendCents
      if (budgetCents > remaining) {
        throw new Error(
          `Organization monthly budget exceeded: need ${budgetCents}, remaining ${remaining}`
        )
      }
    }
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  // If child session, verify parent has available budget
  if (parentSessionId) {
    const [parent] = await db
      .select({
        budgetCents: workflowSessions.budgetCents,
        spentCents: workflowSessions.spentCents,
        reservedCents: workflowSessions.reservedCents,
        status: workflowSessions.status,
        expiresAt: workflowSessions.expiresAt,
      })
      .from(workflowSessions)
      .where(eq(workflowSessions.id, parentSessionId))
      .limit(1)

    if (!parent) throw new Error(`Parent session not found: ${parentSessionId}`)
    if (parent.status !== 'active') throw new Error(`Parent session is ${parent.status}`)

    const parentAvailable = parent.budgetCents - parent.spentCents - parent.reservedCents
    if (budgetCents > parentAvailable) {
      throw new Error(
        `Delegation budget (${budgetCents}) exceeds parent available budget (${parentAvailable})`
      )
    }

    if (parent.expiresAt && expiresAt > new Date(parent.expiresAt)) {
      throw new Error('Child session cannot expire after parent session')
    }

    // Reserve budget on parent
    await db
      .update(workflowSessions)
      .set({
        reservedCents: sql`${workflowSessions.reservedCents} + ${budgetCents}`,
      })
      .where(eq(workflowSessions.id, parentSessionId))
  }

  // Create the session
  const [session] = await db
    .insert(workflowSessions)
    .values({
      customerId,
      parentSessionId: parentSessionId ?? null,
      budgetCents,
      spentCents: 0,
      reservedCents: 0,
      status: 'active',
      settlementMode: 'immediate',
      protocol: protocol ?? null,
      hops: [],
      metadata: metadata ?? null,
      expiresAt,
    })
    .returning()

  // Hydrate Redis for fast budget checks
  const redis = getRedis()
  const ttlSeconds = Math.max(1, Math.ceil(expiresIn))
  await Promise.all([
    tryRedis(() => redis.set(sessionBudgetKey(session.id), budgetCents, { ex: ttlSeconds })),
    tryRedis(() => redis.set(sessionSpentKey(session.id), 0, { ex: ttlSeconds })),
    tryRedis(() => redis.set(sessionReservedKey(session.id), 0, { ex: ttlSeconds })),
  ])

  return {
    id: session.id,
    customerId: session.customerId,
    parentSessionId: session.parentSessionId,
    budgetCents: session.budgetCents,
    spentCents: 0,
    reservedCents: 0,
    availableCents: session.budgetCents,
    status: 'active',
    expiresAt: session.expiresAt?.toISOString() ?? null,
    children: [],
  }
}

// ─── Check Session Budget ────────────────────────────────────────────────────

/**
 * Check if a session has sufficient budget for an operation.
 * Uses Redis for fast path, DB for fallback.
 */
export async function checkSessionBudget(
  sessionId: string,
  costCents: number
): Promise<{ allowed: boolean; availableCents: number; reason?: string }> {
  const redis = getRedis()

  // Try Redis fast path
  const [budgetStr, spentStr, reservedStr] = await Promise.all([
    tryRedis(() => redis.get<string>(sessionBudgetKey(sessionId))),
    tryRedis(() => redis.get<string>(sessionSpentKey(sessionId))),
    tryRedis(() => redis.get<string>(sessionReservedKey(sessionId))),
  ])

  if (budgetStr !== null && budgetStr !== undefined) {
    const budget = parseInt(String(budgetStr), 10)
    const spent = parseInt(String(spentStr ?? '0'), 10)
    const reserved = parseInt(String(reservedStr ?? '0'), 10)
    const available = budget - spent - reserved

    if (costCents > available) {
      return { allowed: false, availableCents: available, reason: 'SESSION_BUDGET_EXCEEDED' }
    }
    return { allowed: true, availableCents: available - costCents }
  }

  // DB fallback
  const [session] = await db
    .select({
      budgetCents: workflowSessions.budgetCents,
      spentCents: workflowSessions.spentCents,
      reservedCents: workflowSessions.reservedCents,
      status: workflowSessions.status,
      expiresAt: workflowSessions.expiresAt,
    })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) return { allowed: false, availableCents: 0, reason: 'SESSION_NOT_FOUND' }
  if (session.status !== 'active') return { allowed: false, availableCents: 0, reason: 'SESSION_INACTIVE' }
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    return { allowed: false, availableCents: 0, reason: 'SESSION_EXPIRED' }
  }

  const available = session.budgetCents - session.spentCents - session.reservedCents
  if (costCents > available) {
    return { allowed: false, availableCents: available, reason: 'SESSION_BUDGET_EXCEEDED' }
  }
  return { allowed: true, availableCents: available - costCents }
}

// ─── Record Session Spend ────────────────────────────────────────────────────

/**
 * Record spending against a session.
 * If the session has a parent, spending rolls up.
 */
export async function recordSessionSpend(sessionId: string, costCents: number): Promise<void> {
  const redis = getRedis()

  // Increment Redis (fast)
  await tryRedis(() => redis.incrby(sessionSpentKey(sessionId), costCents))

  // Increment DB
  await db
    .update(workflowSessions)
    .set({
      spentCents: sql`${workflowSessions.spentCents} + ${costCents}`,
    })
    .where(eq(workflowSessions.id, sessionId))

  // Roll up to parent if exists
  const [session] = await db
    .select({ parentSessionId: workflowSessions.parentSessionId })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (session?.parentSessionId) {
    await tryRedis(() => redis.incrby(sessionSpentKey(session.parentSessionId!), costCents))
    await db
      .update(workflowSessions)
      .set({
        spentCents: sql`${workflowSessions.spentCents} + ${costCents}`,
      })
      .where(eq(workflowSessions.id, session.parentSessionId))
  }
}

// ─── Complete Session ────────────────────────────────────────────────────────

/**
 * Complete a session. Releases unused reserved budget back to parent.
 */
export async function completeSession(sessionId: string): Promise<void> {
  const [session] = await db
    .select({
      parentSessionId: workflowSessions.parentSessionId,
      budgetCents: workflowSessions.budgetCents,
      spentCents: workflowSessions.spentCents,
    })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) throw new Error(`Session not found: ${sessionId}`)

  await db
    .update(workflowSessions)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(workflowSessions.id, sessionId))

  // Release unused delegation back to parent
  if (session.parentSessionId) {
    const unusedBudget = session.budgetCents - session.spentCents
    if (unusedBudget > 0) {
      await db
        .update(workflowSessions)
        .set({
          reservedCents: sql`GREATEST(${workflowSessions.reservedCents} - ${unusedBudget}, 0)`,
        })
        .where(eq(workflowSessions.id, session.parentSessionId))
    }
  }

  // Clean up Redis
  const redis = getRedis()
  await Promise.all([
    tryRedis(() => redis.del(sessionBudgetKey(sessionId))),
    tryRedis(() => redis.del(sessionSpentKey(sessionId))),
    tryRedis(() => redis.del(sessionReservedKey(sessionId))),
  ])
}

// ─── Get Session State ───────────────────────────────────────────────────────

/**
 * Get full session state including children.
 */
export async function getSessionState(sessionId: string): Promise<SessionState | null> {
  const [session] = await db
    .select()
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) return null

  const children = await db
    .select()
    .from(workflowSessions)
    .where(eq(workflowSessions.parentSessionId, sessionId))

  return {
    id: session.id,
    customerId: session.customerId,
    parentSessionId: session.parentSessionId,
    budgetCents: session.budgetCents,
    spentCents: session.spentCents,
    reservedCents: session.reservedCents,
    availableCents: session.budgetCents - session.spentCents - session.reservedCents,
    status: session.status as SessionState['status'],
    expiresAt: session.expiresAt?.toISOString() ?? null,
    children: children.map((child) => ({
      id: child.id,
      customerId: child.customerId,
      parentSessionId: child.parentSessionId,
      budgetCents: child.budgetCents,
      spentCents: child.spentCents,
      reservedCents: child.reservedCents,
      availableCents: child.budgetCents - child.spentCents - child.reservedCents,
      status: child.status as SessionState['status'],
      expiresAt: child.expiresAt?.toISOString() ?? null,
      children: [],
    })),
  }
}

// ─── Record Hop (Multi-Hop Phase 4) ─────────────────────────────────────────

/**
 * Record a service call (hop) within a session.
 * Appends to the hops array and increments spentCents atomically.
 * Checks budget via Redis fast-path, falls back to DB.
 */
export async function recordHop(
  sessionId: string,
  input: RecordHopInput
): Promise<{ hopId: string; remainingBudgetCents: number }> {
  // ── Expiry gate: check session status and expiration BEFORE spending ──
  const [sessionCheck] = await db
    .select({
      status: workflowSessions.status,
      expiresAt: workflowSessions.expiresAt,
    })
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!sessionCheck) {
    throw new Error('Session not found or not active')
  }
  if (sessionCheck.status !== 'active') {
    throw new Error(`Session is ${sessionCheck.status}, cannot record hop`)
  }
  if (sessionCheck.expiresAt && new Date(sessionCheck.expiresAt) < new Date()) {
    // Mark as expired and reject
    await db
      .update(workflowSessions)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(workflowSessions.id, sessionId))
    throw new Error('Session has expired, cannot record hop')
  }

  const redis = getRedis()

  // Atomic budget check via Redis: INCRBY spent, check against budget
  const spent = await tryRedis(() => redis.incrby(sessionSpentKey(sessionId), input.costCents))
  const budget = await tryRedis(() => redis.get<number>(sessionBudgetKey(sessionId)))
  const reserved = await tryRedis(() => redis.get<number>(sessionReservedKey(sessionId)))

  if (spent === null || budget === null) {
    // Fallback to DB
    const [session] = await db
      .select({
        budgetCents: workflowSessions.budgetCents,
        spentCents: workflowSessions.spentCents,
        reservedCents: workflowSessions.reservedCents,
        status: workflowSessions.status,
      })
      .from(workflowSessions)
      .where(eq(workflowSessions.id, sessionId))
      .limit(1)

    if (!session) {
      throw new Error('Session not found or not active')
    }
    if (session.status !== 'active') {
      throw new Error('Session not found or not active')
    }

    const availableCents = session.budgetCents - session.spentCents - session.reservedCents
    if (input.costCents > availableCents) {
      throw new Error(
        `Insufficient session budget: need ${input.costCents}, available ${availableCents}`
      )
    }
  } else {
    const effectiveReserved = reserved ?? 0
    const available = budget - spent - effectiveReserved
    // We already incremented spent; if insufficient, roll back
    if (available < 0) {
      await tryRedis(() => redis.decrby(sessionSpentKey(sessionId), input.costCents))
      throw new Error(
        `Insufficient session budget: need ${input.costCents}, ` +
        `available ${budget - (spent - input.costCents) - effectiveReserved}`
      )
    }
  }

  const hopId = randomUUID()
  const hop: SessionHop = {
    hopId,
    serviceId: input.serviceId,
    toolId: input.toolId,
    method: input.method,
    costCents: input.costCents,
    timestamp: new Date().toISOString(),
    status: 'success',
    latencyMs: input.latencyMs ?? null,
    metadata: input.metadata ?? null,
  }

  // Append hop to DB session (JSONB append) and increment spentCents
  await db
    .update(workflowSessions)
    .set({
      hops: sql`${workflowSessions.hops} || ${JSON.stringify([hop])}::jsonb`,
      spentCents: sql`${workflowSessions.spentCents} + ${input.costCents}`,
      updatedAt: new Date(),
    })
    .where(eq(workflowSessions.id, sessionId))

  const effectiveBudget = budget ?? 0
  const effectiveSpent = spent ?? input.costCents
  const effectiveReserved = reserved ?? 0

  logger.info('session.hop_recorded', {
    sessionId,
    hopId,
    serviceId: input.serviceId,
    costCents: input.costCents,
  })

  return {
    hopId,
    remainingBudgetCents: effectiveBudget - effectiveSpent - effectiveReserved,
  }
}

// ─── Finalize Session (Multi-Hop Phase 4) ────────────────────────────────────

/**
 * Finalize a session: mark as finalizing, calculate disbursements,
 * and create a settlement batch. For immediate mode, just marks settled.
 */
export async function finalizeSession(sessionId: string): Promise<FinalizeResult> {
  // Mark session as finalizing
  const updateResult = await db
    .update(workflowSessions)
    .set({ status: 'finalizing', finalizedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(workflowSessions.id, sessionId),
      eq(workflowSessions.status, 'active'),
    ))
    .returning({ id: workflowSessions.id })

  if (updateResult.length === 0) {
    // Check if session exists at all
    const [existing] = await db
      .select({ status: workflowSessions.status })
      .from(workflowSessions)
      .where(eq(workflowSessions.id, sessionId))
      .limit(1)

    if (!existing) throw new Error('Session not found')
    throw new Error(`Session cannot be finalized: status is ${existing.status}`)
  }

  // Get the session with all hops
  const [session] = await db
    .select()
    .from(workflowSessions)
    .where(eq(workflowSessions.id, sessionId))
    .limit(1)

  if (!session) throw new Error('Session not found')

  const hops = (session.hops as SessionHop[]).filter(h => h.status === 'success')

  if (session.settlementMode === 'immediate') {
    // Already settled per-hop; just mark complete
    await db
      .update(workflowSessions)
      .set({ status: 'settled', settledAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowSessions.id, sessionId))

    // Clean up Redis
    const redis = getRedis()
    await Promise.all([
      tryRedis(() => redis.del(sessionBudgetKey(sessionId))),
      tryRedis(() => redis.del(sessionSpentKey(sessionId))),
      tryRedis(() => redis.del(sessionReservedKey(sessionId))),
    ])

    return { batchId: null, totalSettledCents: session.spentCents }
  }

  // For 'deferred' or 'atomic' mode, create a settlement batch
  const disbursementMap = new Map<string, { toolId: string; amountCents: number }>()

  for (const hop of hops) {
    const key = hop.toolId
    const existing = disbursementMap.get(key)
    if (existing) {
      existing.amountCents += hop.costCents
    } else {
      disbursementMap.set(key, { toolId: hop.toolId, amountCents: hop.costCents })
    }
  }

  // Look up developer IDs and revenue share for each tool
  const toolIds = [...new Set(hops.map(h => h.toolId))]
  const toolRows = toolIds.length > 0
    ? await db
        .select({
          toolId: tools.id,
          developerId: tools.developerId,
        })
        .from(tools)
        .where(sql`${tools.id} IN (${sql.join(toolIds.map(id => sql`${id}::uuid`), sql`, `)})`)
    : []

  const developerIds = [...new Set(toolRows.map(t => t.developerId))]
  const developerRows = developerIds.length > 0
    ? await db
        .select({
          developerId: developers.id,
          revenueSharePct: developers.revenueSharePct,
        })
        .from(developers)
        .where(sql`${developers.id} IN (${sql.join(
          developerIds.map(id => sql`${id}::uuid`),
          sql`, `
        )})`)
    : []

  const devMap = new Map(developerRows.map(d => [d.developerId, d.revenueSharePct]))
  const toolDevMap = new Map(toolRows.map(t => [t.toolId, t.developerId]))

  const disbursements: SessionDisbursement[] = []
  let totalPlatformFee = 0

  for (const [, entry] of disbursementMap) {
    const developerId = toolDevMap.get(entry.toolId)
    if (!developerId) continue

    const revSharePct = devMap.get(developerId) ?? 85
    const platformFeeCents = Math.ceil(entry.amountCents * ((100 - revSharePct) / 100))
    const developerAmountCents = entry.amountCents - platformFeeCents

    totalPlatformFee += platformFeeCents

    disbursements.push({
      developerId,
      toolId: entry.toolId,
      amountCents: developerAmountCents,
      platformFeeCents,
      stripeTransferId: null,
      status: 'pending',
    })
  }

  const totalAmount = hops.reduce((sum, h) => sum + h.costCents, 0)

  // Create settlement batch
  const [batch] = await db
    .insert(settlementBatches)
    .values({
      sessionId,
      totalAmountCents: totalAmount,
      platformFeeCents: totalPlatformFee,
      disbursements,
    })
    .returning({ id: settlementBatches.id })

  // Link session to batch
  await db
    .update(workflowSessions)
    .set({
      atomicSettlementId: batch.id,
      updatedAt: new Date(),
    })
    .where(eq(workflowSessions.id, sessionId))

  logger.info('session.finalized', {
    sessionId,
    batchId: batch.id,
    totalAmountCents: totalAmount,
    disbursementCount: disbursements.length,
  })

  return { batchId: batch.id, totalSettledCents: totalAmount }
}

// ─── Process Settlement Batch (Multi-Hop Phase 4) ────────────────────────────

/**
 * Process each disbursement in a settlement batch.
 * Credits developer balances and marks the batch completed.
 */
export async function processSettlementBatch(batchId: string): Promise<void> {
  // Mark batch as processing
  const [batch] = await db
    .update(settlementBatches)
    .set({ status: 'processing' })
    .where(and(
      eq(settlementBatches.id, batchId),
      eq(settlementBatches.status, 'pending'),
    ))
    .returning()

  if (!batch) {
    throw new Error('Settlement batch not found or not in pending status')
  }

  const disbursements = batch.disbursements as SessionDisbursement[]

  // Atomic transaction: credit ALL developers or rollback ALL on failure.
  // If any single credit fails, the entire transaction is rolled back by
  // Postgres, so no developer receives a partial payment.
  try {
    await db.transaction(async (tx) => {
      // Credit each developer balance inside the transaction
      for (const d of disbursements) {
        await tx
          .update(developers)
          .set({
            balanceCents: sql`${developers.balanceCents} + ${d.amountCents}`,
            updatedAt: new Date(),
          })
          .where(eq(developers.id, d.developerId))
      }

      // Mark all disbursements as completed and batch as completed
      await tx
        .update(settlementBatches)
        .set({
          status: 'completed',
          processedAt: new Date(),
          disbursements: disbursements.map(d => ({ ...d, status: 'completed' as const })),
        })
        .where(eq(settlementBatches.id, batchId))

      // Mark the session as settled
      await tx
        .update(workflowSessions)
        .set({
          status: 'settled',
          settledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workflowSessions.atomicSettlementId, batchId))
    })
  } catch (error) {
    // Transaction rolled back by Postgres -- mark batch and all disbursements as failed
    const reason = error instanceof Error ? error.message : 'Unknown transaction error'
    await db
      .update(settlementBatches)
      .set({
        status: 'failed',
        rollbackReason: reason,
        processedAt: new Date(),
        disbursements: disbursements.map(d => ({ ...d, status: 'failed' as const })),
      })
      .where(eq(settlementBatches.id, batchId))

    await db
      .update(workflowSessions)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(workflowSessions.atomicSettlementId, batchId))

    logger.error('settlement.batch_failed', {
      batchId,
      reason,
      disbursementCount: disbursements.length,
    })

    throw error
  }

  // Clean up Redis for the session (post-commit, best-effort)
  const [session] = await db
    .select({ id: workflowSessions.id })
    .from(workflowSessions)
    .where(eq(workflowSessions.atomicSettlementId, batchId))
    .limit(1)

  if (session) {
    const redis = getRedis()
    await Promise.all([
      tryRedis(() => redis.del(sessionBudgetKey(session.id))),
      tryRedis(() => redis.del(sessionSpentKey(session.id))),
      tryRedis(() => redis.del(sessionReservedKey(session.id))),
    ])
  }

  logger.info('settlement.batch_processed', {
    batchId,
    disbursementCount: disbursements.length,
    totalAmountCents: batch.totalAmountCents,
  })
}

// ─── Rollback Settlement Batch (Multi-Hop Phase 4) ───────────────────────────

/**
 * Roll back a failed settlement batch.
 * Marks the batch and session as rolled_back/failed.
 */
export async function rollbackSettlementBatch(batchId: string, reason: string): Promise<void> {
  const [batch] = await db
    .select()
    .from(settlementBatches)
    .where(eq(settlementBatches.id, batchId))
    .limit(1)

  if (!batch) {
    throw new Error('Settlement batch not found')
  }

  if (batch.status === 'completed') {
    throw new Error('Cannot roll back a completed batch')
  }

  const disbursements = batch.disbursements as SessionDisbursement[]

  // Mark all disbursements as failed
  await db
    .update(settlementBatches)
    .set({
      status: 'rolled_back',
      rollbackReason: reason,
      processedAt: new Date(),
      disbursements: disbursements.map(d => ({ ...d, status: 'failed' as const })),
    })
    .where(eq(settlementBatches.id, batchId))

  // Mark the session as failed
  await db
    .update(workflowSessions)
    .set({
      status: 'failed',
      updatedAt: new Date(),
    })
    .where(eq(workflowSessions.atomicSettlementId, batchId))

  logger.info('settlement.batch_rolled_back', {
    batchId,
    reason,
    sessionId: batch.sessionId,
  })
}

// ─── Expire Stale Sessions (Cron — Multi-Hop Phase 4) ────────────────────────

/**
 * Expire sessions that have passed their expiresAt timestamp.
 * Returns the number of sessions expired.
 */
export async function expireStaleSessionsBatch(): Promise<number> {
  const now = new Date()

  const stale = await db
    .select({ id: workflowSessions.id })
    .from(workflowSessions)
    .where(and(
      eq(workflowSessions.status, 'active'),
      lt(workflowSessions.expiresAt, now),
    ))
    .limit(100)

  for (const s of stale) {
    await db
      .update(workflowSessions)
      .set({ status: 'expired', updatedAt: now })
      .where(eq(workflowSessions.id, s.id))

    // Clean up Redis
    const redis = getRedis()
    await Promise.all([
      tryRedis(() => redis.del(sessionBudgetKey(s.id))),
      tryRedis(() => redis.del(sessionSpentKey(s.id))),
      tryRedis(() => redis.del(sessionReservedKey(s.id))),
    ])
  }

  if (stale.length > 0) {
    logger.info('session.expired_batch', { count: stale.length })
  }

  return stale.length
}

// ─── Get Settlement Batch ────────────────────────────────────────────────────

/**
 * Get a settlement batch by ID.
 */
export async function getSettlementBatch(batchId: string) {
  const [batch] = await db
    .select()
    .from(settlementBatches)
    .where(eq(settlementBatches.id, batchId))
    .limit(1)

  return batch ?? null
}
