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
      trustScore: computeTrustScore(agent),
    },
  }
}

/**
 * Compute a trust score (0-100) based on agent history and verification.
 */
export function computeTrustScore(agent: {
  verificationLevel: string
  createdAt: Date
  lastSeenAt: Date | null
}): number {
  let score = 10 // Base score

  // Verification level
  switch (agent.verificationLevel) {
    case 'individual': score += 40; break
    case 'business': score += 30; break
    case 'basic': score += 15; break
    default: score += 0
  }

  // Account age (up to 30 points for 90+ days)
  const ageMs = Date.now() - new Date(agent.createdAt).getTime()
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  score += Math.min(30, Math.floor(ageDays / 3))

  // Recent activity (up to 20 points)
  if (agent.lastSeenAt) {
    const lastSeenMs = Date.now() - new Date(agent.lastSeenAt).getTime()
    const lastSeenDays = lastSeenMs / (24 * 60 * 60 * 1000)
    if (lastSeenDays < 1) score += 20
    else if (lastSeenDays < 7) score += 15
    else if (lastSeenDays < 30) score += 10
    else score += 5
  }

  return Math.min(100, score)
}
