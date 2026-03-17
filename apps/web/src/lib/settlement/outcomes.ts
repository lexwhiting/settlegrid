/**
 * Outcome-based settlement for SettleGrid.
 *
 * Enables pay-for-performance pricing: providers define success criteria,
 * consumers only pay full price when the tool outcome meets the criteria.
 * Failed outcomes charge a reduced failure price (or zero).
 *
 * Includes a dispute mechanism with a 24-hour window after verification.
 */

import { db } from '@/lib/db'
import { outcomeVerifications } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OutcomeCriteria {
  outcomeType: 'boolean' | 'score' | 'custom'
  minScore?: number
  maxLatencyMs?: number
  requiredFields?: string[]
}

export interface CreateOutcomeParams {
  invocationId: string
  toolId: string
  consumerId: string
  outcomeType: 'boolean' | 'score' | 'custom'
  successCriteria: OutcomeCriteria
  fullPriceCents: number
  failurePriceCents?: number
}

export interface VerifyOutcomeResult {
  passed: boolean
  score: number
  settledPriceCents: number
  reason?: string
}

export interface OutcomeVerification {
  id: string
  invocationId: string
  toolId: string
  consumerId: string
  outcomeType: string
  successCriteria: unknown
  fullPriceCents: number
  failurePriceCents: number
  actualOutcome: unknown
  outcomeScore: number | null
  passed: boolean | null
  settledPriceCents: number | null
  verifiedAt: Date | null
  disputeStatus: string | null
  disputeReason: string | null
  disputeResolvedAt: Date | null
  disputeDeadline: Date | null
  createdAt: Date
}

// ─── Pure Evaluation ────────────────────────────────────────────────────────

/**
 * Evaluate an outcome against success criteria.
 * Pure function -- no DB or side effects.
 */
export function evaluateOutcome(
  criteria: OutcomeCriteria,
  outcome: unknown,
  latencyMs?: number
): { passed: boolean; score: number; reason?: string } {
  // Latency check (applies to all types)
  if (criteria.maxLatencyMs && latencyMs !== undefined && latencyMs > criteria.maxLatencyMs) {
    return {
      passed: false,
      score: 0,
      reason: `Latency ${latencyMs}ms exceeds max ${criteria.maxLatencyMs}ms`,
    }
  }

  switch (criteria.outcomeType) {
    case 'boolean': {
      const passed = outcome !== null && outcome !== undefined && outcome !== false
      return { passed, score: passed ? 100 : 0 }
    }

    case 'score': {
      const score = typeof outcome === 'number' ? outcome : 0
      const minScore = criteria.minScore ?? 0.5
      const normalizedScore = Math.round(score * 100)
      return {
        passed: score >= minScore,
        score: normalizedScore,
        reason: score < minScore
          ? `Score ${score} below minimum ${minScore}`
          : undefined,
      }
    }

    case 'custom': {
      if (criteria.requiredFields && typeof outcome === 'object' && outcome !== null) {
        const obj = outcome as Record<string, unknown>
        const missing = criteria.requiredFields.filter((f) => !(f in obj))
        if (missing.length > 0) {
          return {
            passed: false,
            score: 0,
            reason: `Missing required fields: ${missing.join(', ')}`,
          }
        }
      }
      return { passed: true, score: 100 }
    }

    default:
      return { passed: true, score: 100 }
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────

/**
 * Create a pending outcome verification record.
 * The verification is not evaluated until verifyOutcome() is called.
 */
export async function createOutcomeVerification(
  params: CreateOutcomeParams
): Promise<{ id: string }> {
  const [result] = await db
    .insert(outcomeVerifications)
    .values({
      invocationId: params.invocationId,
      toolId: params.toolId,
      consumerId: params.consumerId,
      outcomeType: params.outcomeType,
      successCriteria: params.successCriteria,
      fullPriceCents: params.fullPriceCents,
      failurePriceCents: params.failurePriceCents ?? 0,
    })
    .returning({ id: outcomeVerifications.id })

  logger.info('outcome.verification_created', {
    verificationId: result.id,
    toolId: params.toolId,
    consumerId: params.consumerId,
    outcomeType: params.outcomeType,
  })

  return { id: result.id }
}

// ─── Verify ─────────────────────────────────────────────────────────────────

/**
 * Verify an outcome against the stored criteria.
 * Sets passed, score, settledPrice, and opens a 24h dispute window.
 */
export async function verifyOutcome(
  verificationId: string,
  actualOutcome: unknown,
  latencyMs?: number
): Promise<VerifyOutcomeResult> {
  // Fetch the pending verification
  const [verification] = await db
    .select()
    .from(outcomeVerifications)
    .where(eq(outcomeVerifications.id, verificationId))
    .limit(1)

  if (!verification) {
    throw new Error('Verification not found')
  }

  if (verification.verifiedAt) {
    throw new Error('Verification already completed')
  }

  const criteria = verification.successCriteria as OutcomeCriteria
  const evaluation = evaluateOutcome(criteria, actualOutcome, latencyMs)

  const settledPriceCents = evaluation.passed
    ? verification.fullPriceCents
    : verification.failurePriceCents

  const disputeDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await db
    .update(outcomeVerifications)
    .set({
      actualOutcome: actualOutcome as Record<string, unknown>,
      outcomeScore: evaluation.score,
      passed: evaluation.passed,
      settledPriceCents,
      verifiedAt: new Date(),
      disputeDeadline,
    })
    .where(eq(outcomeVerifications.id, verificationId))

  logger.info('outcome.verified', {
    verificationId,
    passed: evaluation.passed,
    score: evaluation.score,
    settledPriceCents,
  })

  return {
    passed: evaluation.passed,
    score: evaluation.score,
    settledPriceCents,
    reason: evaluation.reason,
  }
}

// ─── Dispute ────────────────────────────────────────────────────────────────

/**
 * Open a dispute on an outcome verification.
 * Must be within the 24-hour dispute deadline.
 */
export async function openDispute(
  verificationId: string,
  reason: string
): Promise<void> {
  const [verification] = await db
    .select()
    .from(outcomeVerifications)
    .where(eq(outcomeVerifications.id, verificationId))
    .limit(1)

  if (!verification) {
    throw new Error('Verification not found')
  }

  if (!verification.verifiedAt) {
    throw new Error('Cannot dispute an unverified outcome')
  }

  if (verification.disputeDeadline && new Date() > verification.disputeDeadline) {
    throw new Error('Dispute deadline has passed')
  }

  if (verification.disputeStatus) {
    throw new Error('Dispute already exists')
  }

  await db
    .update(outcomeVerifications)
    .set({
      disputeStatus: 'opened',
      disputeReason: reason,
    })
    .where(eq(outcomeVerifications.id, verificationId))

  logger.info('outcome.dispute_opened', { verificationId, reason })
}

/**
 * Resolve a dispute in favor of consumer or provider.
 */
export async function resolveDispute(
  verificationId: string,
  resolution: 'resolved_for_consumer' | 'resolved_for_provider'
): Promise<void> {
  const [verification] = await db
    .select()
    .from(outcomeVerifications)
    .where(eq(outcomeVerifications.id, verificationId))
    .limit(1)

  if (!verification) {
    throw new Error('Verification not found')
  }

  if (verification.disputeStatus !== 'opened') {
    throw new Error('No open dispute to resolve')
  }

  const adjustedPriceCents =
    resolution === 'resolved_for_consumer'
      ? verification.failurePriceCents // refund to failure price
      : verification.fullPriceCents // charge full price

  await db
    .update(outcomeVerifications)
    .set({
      disputeStatus: resolution,
      disputeResolvedAt: new Date(),
      settledPriceCents: adjustedPriceCents,
    })
    .where(eq(outcomeVerifications.id, verificationId))

  logger.info('outcome.dispute_resolved', { verificationId, resolution, adjustedPriceCents })
}

// ─── Get ────────────────────────────────────────────────────────────────────

/**
 * Get an outcome verification by ID.
 */
export async function getOutcomeVerification(
  verificationId: string
): Promise<OutcomeVerification | null> {
  const [verification] = await db
    .select()
    .from(outcomeVerifications)
    .where(eq(outcomeVerifications.id, verificationId))
    .limit(1)

  return (verification as OutcomeVerification) ?? null
}
