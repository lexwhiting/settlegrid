// /Users/lex/settlegrid/apps/web/src/lib/settlement/identity.ts

import { db } from '@/lib/db'
import { agentIdentities } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createHash } from 'crypto'
import { logger } from '@/lib/logger'
import type { AgentFactsProfile, IdentityType, GeneralizedPricingConfig, ProtocolName } from './types'

export interface RegisterAgentParams {
  providerId: string
  agentName: string
  identityType: IdentityType
  publicKey?: string           // Ed25519 hex for did:key
  capabilities?: {
    tools: string[]
    methods: string[]
    pricing: GeneralizedPricingConfig
    protocols: ProtocolName[]
  }
  spendingLimitCents?: number
  metadata?: Record<string, unknown>
}

export interface AgentIdentity {
  id: string
  providerId: string | null
  agentName: string
  identityType: IdentityType
  publicKey: string | null
  fingerprint: string | null
  verificationLevel: string
  capabilities: Record<string, unknown> | null
  spendingLimitCents: number | null
  status: string
  lastSeenAt: string | null
  createdAt: string
}

/**
 * Compute a fingerprint for an identity proof.
 * Used to detect duplicate registrations and enable lookup by identity.
 */
export function computeFingerprint(identityType: IdentityType, value: string): string {
  return createHash('sha256')
    .update(`${identityType}:${value}`)
    .digest('hex')
}

/**
 * Register a new agent identity.
 */
export async function registerAgent(params: RegisterAgentParams): Promise<AgentIdentity> {
  const {
    providerId,
    agentName,
    identityType,
    publicKey,
    capabilities,
    spendingLimitCents,
    metadata,
  } = params

  // Compute fingerprint from identity proof
  const fingerprintSource = publicKey ?? agentName
  const fingerprint = computeFingerprint(identityType, fingerprintSource)

  // Check for duplicate
  const [existing] = await db
    .select({ id: agentIdentities.id })
    .from(agentIdentities)
    .where(eq(agentIdentities.fingerprint, fingerprint))
    .limit(1)

  if (existing) {
    throw new Error(`Agent identity already registered with fingerprint: ${fingerprint}`)
  }

  const [agent] = await db
    .insert(agentIdentities)
    .values({
      providerId,
      agentName,
      identityType,
      publicKey: publicKey ?? null,
      fingerprint,
      verificationLevel: 'none',
      capabilities: capabilities ?? null,
      spendingLimitCents: spendingLimitCents ?? null,
      status: 'active',
      metadata: metadata ?? null,
    })
    .returning()

  logger.info('identity.agent_registered', {
    agentId: agent.id,
    agentName,
    identityType,
    providerId,
  })

  return {
    id: agent.id,
    providerId: agent.providerId,
    agentName: agent.agentName,
    identityType: agent.identityType as IdentityType,
    publicKey: agent.publicKey,
    fingerprint: agent.fingerprint,
    verificationLevel: agent.verificationLevel,
    capabilities: agent.capabilities as Record<string, unknown> | null,
    spendingLimitCents: agent.spendingLimitCents,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
  }
}

/**
 * Look up an agent by fingerprint (identity proof hash).
 */
export async function resolveAgent(
  identityType: IdentityType,
  identityValue: string
): Promise<AgentIdentity | null> {
  const fingerprint = computeFingerprint(identityType, identityValue)

  const [agent] = await db
    .select()
    .from(agentIdentities)
    .where(and(
      eq(agentIdentities.fingerprint, fingerprint),
      eq(agentIdentities.status, 'active')
    ))
    .limit(1)

  if (!agent) return null

  // Update lastSeenAt (fire and forget)
  db.update(agentIdentities)
    .set({ lastSeenAt: new Date() })
    .where(eq(agentIdentities.id, agent.id))
    .then(() => {})
    .catch(() => {})

  return {
    id: agent.id,
    providerId: agent.providerId,
    agentName: agent.agentName,
    identityType: agent.identityType as IdentityType,
    publicKey: agent.publicKey,
    fingerprint: agent.fingerprint,
    verificationLevel: agent.verificationLevel,
    capabilities: agent.capabilities as Record<string, unknown> | null,
    spendingLimitCents: agent.spendingLimitCents,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
  }
}

/**
 * List agents for a given provider.
 */
export async function listAgentsByProvider(providerId: string): Promise<AgentIdentity[]> {
  const agents = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.providerId, providerId))
    .limit(100)

  return agents.map((agent) => ({
    id: agent.id,
    providerId: agent.providerId,
    agentName: agent.agentName,
    identityType: agent.identityType as IdentityType,
    publicKey: agent.publicKey,
    fingerprint: agent.fingerprint,
    verificationLevel: agent.verificationLevel,
    capabilities: agent.capabilities as Record<string, unknown> | null,
    spendingLimitCents: agent.spendingLimitCents,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
  }))
}

/**
 * Revoke an agent identity (soft-delete).
 */
export async function revokeAgent(agentId: string, providerId: string): Promise<boolean> {
  const [agent] = await db
    .select({ id: agentIdentities.id, status: agentIdentities.status })
    .from(agentIdentities)
    .where(and(eq(agentIdentities.id, agentId), eq(agentIdentities.providerId, providerId)))
    .limit(1)

  if (!agent) return false
  if (agent.status === 'revoked') return false

  await db
    .update(agentIdentities)
    .set({ status: 'revoked' })
    .where(eq(agentIdentities.id, agentId))

  logger.info('identity.agent_revoked', { agentId, providerId })
  return true
}

/**
 * Update an agent's capabilities and spending limit.
 */
export async function updateAgent(
  agentId: string,
  providerId: string,
  updates: {
    agentName?: string
    capabilities?: RegisterAgentParams['capabilities']
    spendingLimitCents?: number
    metadata?: Record<string, unknown>
  }
): Promise<AgentIdentity | null> {
  const [existing] = await db
    .select({ id: agentIdentities.id, status: agentIdentities.status })
    .from(agentIdentities)
    .where(and(eq(agentIdentities.id, agentId), eq(agentIdentities.providerId, providerId)))
    .limit(1)

  if (!existing || existing.status === 'revoked') return null

  const setData: Record<string, unknown> = {}
  if (updates.agentName !== undefined) setData.agentName = updates.agentName
  if (updates.capabilities !== undefined) setData.capabilities = updates.capabilities
  if (updates.spendingLimitCents !== undefined) setData.spendingLimitCents = updates.spendingLimitCents
  if (updates.metadata !== undefined) setData.metadata = updates.metadata

  if (Object.keys(setData).length === 0) return null

  const [agent] = await db
    .update(agentIdentities)
    .set(setData)
    .where(eq(agentIdentities.id, agentId))
    .returning()

  if (!agent) return null

  logger.info('identity.agent_updated', { agentId, providerId, fields: Object.keys(setData) })

  return {
    id: agent.id,
    providerId: agent.providerId,
    agentName: agent.agentName,
    identityType: agent.identityType as IdentityType,
    publicKey: agent.publicKey,
    fingerprint: agent.fingerprint,
    verificationLevel: agent.verificationLevel,
    capabilities: agent.capabilities as Record<string, unknown> | null,
    spendingLimitCents: agent.spendingLimitCents,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
  }
}

/**
 * Generate an AgentFacts-compatible profile for an agent.
 * Implements 4 of the 10 AgentFacts categories.
 */
export async function generateAgentFactsProfile(agentId: string): Promise<AgentFactsProfile | null> {
  const [agent] = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.id, agentId))
    .limit(1)

  if (!agent) return null

  const capabilities = agent.capabilities as {
    tools?: string[]
    methods?: string[]
    pricing?: GeneralizedPricingConfig
    protocols?: ProtocolName[]
  } | null

  return {
    coreIdentity: {
      id: agent.fingerprint ?? agent.id,
      name: agent.agentName,
      version: '1.0.0',
      provider: agent.providerId ?? 'unknown',
      ttl: 3600, // 1 hour cache
    },
    capabilities: {
      tools: capabilities?.tools ?? [],
      methods: capabilities?.methods ?? [],
      pricing: capabilities?.pricing ?? {
        model: 'per-invocation',
        defaultCostCents: 0,
        currencyCode: 'USD',
      },
      protocols: capabilities?.protocols ?? ['mcp'],
    },
    authPermissions: {
      authTypes: [agent.identityType as IdentityType],
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerDay: 10000,
      },
      spendingLimits: {
        perSession: agent.spendingLimitCents ?? 10000,  // $100 default
        perDay: (agent.spendingLimitCents ?? 10000) * 10,
        currency: 'USD',
      },
    },
    verification: {
      level: agent.verificationLevel as AgentFactsProfile['verification']['level'],
      verifiedAt: undefined,
      trustScore: computeTrustScore({
        verificationLevel: agent.verificationLevel,
        createdAt: agent.createdAt,
        lastSeenAt: agent.lastSeenAt,
      }),
    },
  }
}

/**
 * Extended trust score input — allows richer signals beyond the agent record.
 */
export interface TrustScoreInput {
  verificationLevel: string
  createdAt: Date
  lastSeenAt: Date | null
  // Additional signals for moat deepening
  successfulTransactions?: number
  failedTransactions?: number
  totalDisputes?: number
  resolvedDisputes?: number
  lastDisputeAt?: Date | null
}

/**
 * Compute a trust score (0-100) based on agent history, verification,
 * transaction performance, and dispute record.
 *
 * Scoring breakdown (max 100):
 *  - Base:                      5 points
 *  - Verification level:       up to 25 points
 *  - Account age:              up to 15 points
 *  - Recent activity:          up to 10 points
 *  - Transaction success rate: up to 25 points
 *  - Dispute record:           up to 20 points (penalty for recent disputes)
 */
export function computeTrustScore(agent: TrustScoreInput): number {
  let score = 5 // Base score

  // ── Verification level (up to 25) ──
  switch (agent.verificationLevel) {
    case 'individual': score += 25; break
    case 'business': score += 20; break
    case 'basic': score += 10; break
    default: score += 0
  }

  // ── Account age (up to 15 points for 90+ days) ──
  const ageMs = Date.now() - new Date(agent.createdAt).getTime()
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  score += Math.min(15, Math.floor(ageDays / 6))

  // ── Recent activity (up to 10 points) ──
  if (agent.lastSeenAt) {
    const lastSeenMs = Date.now() - new Date(agent.lastSeenAt).getTime()
    const lastSeenDays = lastSeenMs / (24 * 60 * 60 * 1000)
    if (lastSeenDays < 1) score += 10
    else if (lastSeenDays < 7) score += 7
    else if (lastSeenDays < 30) score += 4
    else score += 1
  }

  // ── Transaction success rate (up to 25 points) ──
  const successfulTx = agent.successfulTransactions ?? 0
  const failedTx = agent.failedTransactions ?? 0
  const totalTx = successfulTx + failedTx
  if (totalTx > 0) {
    const successRate = successfulTx / totalTx
    // Volume bonus: more transactions = more data = more trust
    const volumeBonus = Math.min(5, Math.floor(totalTx / 100))
    score += Math.round(successRate * 20) + volumeBonus
  }

  // ── Dispute record (up to 20 points, with penalties) ──
  const totalDisputes = agent.totalDisputes ?? 0
  const resolvedDisputes = agent.resolvedDisputes ?? 0

  if (totalTx > 0 && totalDisputes === 0) {
    // Clean record — full points
    score += 20
  } else if (totalDisputes > 0) {
    // Dispute rate penalty
    const disputeRate = totalTx > 0 ? totalDisputes / totalTx : 1
    if (disputeRate < 0.01) score += 15    // < 1% dispute rate
    else if (disputeRate < 0.05) score += 10 // < 5%
    else if (disputeRate < 0.10) score += 5  // < 10%
    else score += 0                           // >= 10% — no trust points

    // Resolution bonus: resolved disputes show good faith
    if (totalDisputes > 0 && resolvedDisputes === totalDisputes) {
      score += 3
    }

    // Recency penalty: recent disputes reduce trust
    if (agent.lastDisputeAt) {
      const daysSinceDispute =
        (Date.now() - new Date(agent.lastDisputeAt).getTime()) / (24 * 60 * 60 * 1000)
      if (daysSinceDispute < 7) score -= 10
      else if (daysSinceDispute < 30) score -= 5
    }
  } else {
    // No transactions, no disputes — neutral
    score += 5
  }

  return Math.max(0, Math.min(100, score))
}
