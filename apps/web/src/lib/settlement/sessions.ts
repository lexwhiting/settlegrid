/**
 * Workflow session management for multi-hop budget delegation.
 *
 * Sessions track budget allocation across multi-agent workflows.
 * Redis provides fast-path budget checks; PostgreSQL is the durable store.
 */

import { db } from '@/lib/db'
import { workflowSessions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getRedis, tryRedis } from '@/lib/redis'
import type { SessionCreateParams, SessionState } from './types'

// Redis key helpers
function sessionBudgetKey(sessionId: string): string {
  return `session:budget:${sessionId}`
}
function sessionSpentKey(sessionId: string): string {
  return `session:spent:${sessionId}`
}
function sessionReservedKey(sessionId: string): string {
  return `session:reserved:${sessionId}`
}

/**
 * Create a new workflow session with a budget.
 * If parentSessionId is provided, this is a delegation — the parent's
 * reserved amount is increased by budgetCents.
 */
export async function createSession(params: SessionCreateParams): Promise<SessionState> {
  const {
    customerId,
    budgetCents,
    expiresIn = 3600,
    parentSessionId,
    protocol,
    metadata,
  } = params

  if (budgetCents <= 0) {
    throw new Error('Session budget must be positive')
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
      protocol: protocol ?? null,
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
