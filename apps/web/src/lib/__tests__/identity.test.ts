import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const { mockDbSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}))

vi.mock('@/lib/db/schema', () => ({
  agentIdentities: {
    id: 'id',
    providerId: 'provider_id',
    agentName: 'agent_name',
    identityType: 'identity_type',
    publicKey: 'public_key',
    fingerprint: 'fingerprint',
    verificationLevel: 'verification_level',
    capabilities: 'capabilities',
    spendingLimitCents: 'spending_limit_cents',
    status: 'status',
    metadata: 'metadata',
    lastSeenAt: 'last_seen_at',
    createdAt: 'created_at',
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
}))

import {
  registerAgent,
  resolveAgent,
  listAgentsByProvider,
  generateAgentFactsProfile,
  computeTrustScore,
  computeFingerprint,
} from '@/lib/settlement/identity'
import { logger } from '@/lib/logger'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-001',
    providerId: 'provider-1',
    agentName: 'TestAgent',
    identityType: 'api-key',
    publicKey: null,
    fingerprint: 'abc123fingerprint',
    verificationLevel: 'none',
    capabilities: null,
    spendingLimitCents: null,
    status: 'active',
    metadata: null,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function setupSelectChain(result: unknown[]) {
  const chain = {
    select: mockDbSelect,
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
  mockDbSelect.mockReturnValue(chain)
  return chain
}

function setupInsertChain(result: unknown[]) {
  const chain = {
    insert: mockDbInsert,
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  }
  mockDbInsert.mockReturnValue(chain)
  return chain
}

function setupUpdateChain() {
  const promise = Promise.resolve()
  const chain = {
    update: mockDbUpdate,
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue(promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  }
  mockDbUpdate.mockReturnValue(chain)
  return chain
}

// ─── computeFingerprint Tests ────────────────────────────────────────────────

describe('computeFingerprint', () => {
  it('produces a deterministic SHA-256 hash', () => {
    const fp1 = computeFingerprint('api-key', 'my-key')
    const fp2 = computeFingerprint('api-key', 'my-key')
    expect(fp1).toBe(fp2)
  })

  it('produces different fingerprints for different identity types', () => {
    const fp1 = computeFingerprint('api-key', 'my-key')
    const fp2 = computeFingerprint('did:key', 'my-key')
    expect(fp1).not.toBe(fp2)
  })

  it('produces a valid 64-char hex string', () => {
    const fp = computeFingerprint('api-key', 'test')
    expect(fp).toMatch(/^[0-9a-f]{64}$/)
  })

  it('matches manual SHA-256 computation', () => {
    const expected = createHash('sha256').update('jwt:token123').digest('hex')
    const actual = computeFingerprint('jwt', 'token123')
    expect(actual).toBe(expected)
  })

  it('produces different fingerprints for different values', () => {
    const fp1 = computeFingerprint('api-key', 'value-a')
    const fp2 = computeFingerprint('api-key', 'value-b')
    expect(fp1).not.toBe(fp2)
  })
})

// ─── registerAgent Tests ─────────────────────────────────────────────────────

describe('registerAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an agent with correct fields', async () => {
    const agent = makeAgent()
    setupSelectChain([]) // no duplicate
    setupInsertChain([agent])

    const result = await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
    })

    expect(result.id).toBe('agent-001')
    expect(result.agentName).toBe('TestAgent')
    expect(result.identityType).toBe('api-key')
    expect(result.providerId).toBe('provider-1')
    expect(result.verificationLevel).toBe('none')
    expect(result.status).toBe('active')
  })

  it('computes fingerprint from identityType + agentName when no publicKey', async () => {
    const expectedFp = computeFingerprint('api-key', 'TestAgent')
    const agent = makeAgent({ fingerprint: expectedFp })
    setupSelectChain([])
    const insertChain = setupInsertChain([agent])

    await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
    })

    const insertValues = insertChain.values.mock.calls[0][0]
    expect(insertValues.fingerprint).toBe(expectedFp)
  })

  it('computes fingerprint from identityType + publicKey when provided', async () => {
    const expectedFp = computeFingerprint('did:key', 'ed25519-pub-key')
    const agent = makeAgent({ fingerprint: expectedFp, publicKey: 'ed25519-pub-key' })
    setupSelectChain([])
    const insertChain = setupInsertChain([agent])

    await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'did:key',
      publicKey: 'ed25519-pub-key',
    })

    const insertValues = insertChain.values.mock.calls[0][0]
    expect(insertValues.fingerprint).toBe(expectedFp)
  })

  it('throws on duplicate fingerprint', async () => {
    setupSelectChain([{ id: 'existing-agent' }]) // duplicate found

    await expect(registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
    })).rejects.toThrow('already registered')
  })

  it('stores capabilities correctly', async () => {
    const capabilities = {
      tools: ['tool-a', 'tool-b'],
      methods: ['method-1'],
      pricing: { model: 'per-invocation' as const, defaultCostCents: 5, currencyCode: 'USD' },
      protocols: ['mcp' as const],
    }
    const agent = makeAgent({ capabilities })
    setupSelectChain([])
    const insertChain = setupInsertChain([agent])

    await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
      capabilities,
    })

    const insertValues = insertChain.values.mock.calls[0][0]
    expect(insertValues.capabilities).toEqual(capabilities)
  })

  it('stores spending limit correctly', async () => {
    const agent = makeAgent({ spendingLimitCents: 5000 })
    setupSelectChain([])
    const insertChain = setupInsertChain([agent])

    await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
      spendingLimitCents: 5000,
    })

    const insertValues = insertChain.values.mock.calls[0][0]
    expect(insertValues.spendingLimitCents).toBe(5000)
  })

  it('sets default spending limit to null when not provided', async () => {
    const agent = makeAgent()
    setupSelectChain([])
    const insertChain = setupInsertChain([agent])

    await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
    })

    const insertValues = insertChain.values.mock.calls[0][0]
    expect(insertValues.spendingLimitCents).toBeNull()
  })

  it('logs the registration event', async () => {
    const agent = makeAgent()
    setupSelectChain([])
    setupInsertChain([agent])

    await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
    })

    expect(logger.info).toHaveBeenCalledWith('identity.agent_registered', expect.objectContaining({
      agentId: 'agent-001',
      agentName: 'TestAgent',
      identityType: 'api-key',
      providerId: 'provider-1',
    }))
  })

  it('returns createdAt as ISO string', async () => {
    const agent = makeAgent({ createdAt: new Date('2026-03-01T12:00:00Z') })
    setupSelectChain([])
    setupInsertChain([agent])

    const result = await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
    })

    expect(result.createdAt).toBe('2026-03-01T12:00:00.000Z')
  })

  it('stores metadata correctly', async () => {
    const metadata = { team: 'engineering', region: 'us-east' }
    const agent = makeAgent({ metadata })
    setupSelectChain([])
    const insertChain = setupInsertChain([agent])

    await registerAgent({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
      metadata,
    })

    const insertValues = insertChain.values.mock.calls[0][0]
    expect(insertValues.metadata).toEqual(metadata)
  })
})

// ─── resolveAgent Tests ──────────────────────────────────────────────────────

describe('resolveAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns agent by fingerprint', async () => {
    const agent = makeAgent()
    setupSelectChain([agent])
    setupUpdateChain()

    const result = await resolveAgent('api-key', 'TestAgent')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('agent-001')
    expect(result!.agentName).toBe('TestAgent')
  })

  it('returns null for unknown identity', async () => {
    setupSelectChain([])

    const result = await resolveAgent('api-key', 'nonexistent')
    expect(result).toBeNull()
  })

  it('updates lastSeenAt on resolution', async () => {
    const agent = makeAgent()
    setupSelectChain([agent])
    const updateChain = setupUpdateChain()

    await resolveAgent('api-key', 'TestAgent')

    expect(mockDbUpdate).toHaveBeenCalled()
    expect(updateChain.set).toHaveBeenCalledWith({ lastSeenAt: expect.any(Date) })
  })

  it('returns lastSeenAt as ISO string when present', async () => {
    const agent = makeAgent({ lastSeenAt: new Date('2026-03-15T10:00:00Z') })
    setupSelectChain([agent])
    setupUpdateChain()

    const result = await resolveAgent('api-key', 'TestAgent')
    expect(result!.lastSeenAt).toBe('2026-03-15T10:00:00.000Z')
  })

  it('returns lastSeenAt as null when not set', async () => {
    const agent = makeAgent({ lastSeenAt: null })
    setupSelectChain([agent])
    setupUpdateChain()

    const result = await resolveAgent('api-key', 'TestAgent')
    expect(result!.lastSeenAt).toBeNull()
  })
})

// ─── listAgentsByProvider Tests ──────────────────────────────────────────────

describe('listAgentsByProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns agents for a provider', async () => {
    const agents = [makeAgent(), makeAgent({ id: 'agent-002', agentName: 'Agent2' })]
    setupSelectChain(agents)

    const result = await listAgentsByProvider('provider-1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('agent-001')
    expect(result[1].agentName).toBe('Agent2')
  })

  it('returns empty array for unknown provider', async () => {
    setupSelectChain([])

    const result = await listAgentsByProvider('unknown-provider')
    expect(result).toEqual([])
  })
})

// ─── generateAgentFactsProfile Tests ─────────────────────────────────────────

describe('generateAgentFactsProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a 4-category profile', async () => {
    const agent = makeAgent({ fingerprint: 'fp-123' })
    setupSelectChain([agent])

    const profile = await generateAgentFactsProfile('agent-001')
    expect(profile).not.toBeNull()
    expect(profile!.coreIdentity).toBeDefined()
    expect(profile!.capabilities).toBeDefined()
    expect(profile!.authPermissions).toBeDefined()
    expect(profile!.verification).toBeDefined()
  })

  it('returns null for unknown agent', async () => {
    setupSelectChain([])

    const profile = await generateAgentFactsProfile('unknown')
    expect(profile).toBeNull()
  })

  it('populates coreIdentity from agent data', async () => {
    const agent = makeAgent({ fingerprint: 'fp-123', providerId: 'prov-abc' })
    setupSelectChain([agent])

    const profile = await generateAgentFactsProfile('agent-001')
    expect(profile!.coreIdentity.id).toBe('fp-123')
    expect(profile!.coreIdentity.name).toBe('TestAgent')
    expect(profile!.coreIdentity.provider).toBe('prov-abc')
    expect(profile!.coreIdentity.version).toBe('1.0.0')
    expect(profile!.coreIdentity.ttl).toBe(3600)
  })

  it('uses agent id if fingerprint is null', async () => {
    const agent = makeAgent({ fingerprint: null })
    setupSelectChain([agent])

    const profile = await generateAgentFactsProfile('agent-001')
    expect(profile!.coreIdentity.id).toBe('agent-001')
  })

  it('populates capabilities from stored data', async () => {
    const caps = {
      tools: ['tool-x'],
      methods: ['compute'],
      pricing: { model: 'per-invocation', defaultCostCents: 10, currencyCode: 'USD' },
      protocols: ['mcp', 'x402'],
    }
    const agent = makeAgent({ capabilities: caps })
    setupSelectChain([agent])

    const profile = await generateAgentFactsProfile('agent-001')
    expect(profile!.capabilities.tools).toEqual(['tool-x'])
    expect(profile!.capabilities.methods).toEqual(['compute'])
    expect(profile!.capabilities.protocols).toEqual(['mcp', 'x402'])
  })

  it('uses default capabilities when none stored', async () => {
    const agent = makeAgent({ capabilities: null })
    setupSelectChain([agent])

    const profile = await generateAgentFactsProfile('agent-001')
    expect(profile!.capabilities.tools).toEqual([])
    expect(profile!.capabilities.methods).toEqual([])
    expect(profile!.capabilities.protocols).toEqual(['mcp'])
    expect(profile!.capabilities.pricing.model).toBe('per-invocation')
  })

  it('populates authPermissions', async () => {
    const agent = makeAgent({ spendingLimitCents: 5000 })
    setupSelectChain([agent])

    const profile = await generateAgentFactsProfile('agent-001')
    expect(profile!.authPermissions.authTypes).toEqual(['api-key'])
    expect(profile!.authPermissions.rateLimits.requestsPerMinute).toBe(60)
    expect(profile!.authPermissions.spendingLimits.perSession).toBe(5000)
    expect(profile!.authPermissions.spendingLimits.perDay).toBe(50000)
  })

  it('uses default spending limits when not set', async () => {
    const agent = makeAgent({ spendingLimitCents: null })
    setupSelectChain([agent])

    const profile = await generateAgentFactsProfile('agent-001')
    expect(profile!.authPermissions.spendingLimits.perSession).toBe(10000)
    expect(profile!.authPermissions.spendingLimits.perDay).toBe(100000)
  })

  it('includes trust score in verification', async () => {
    const agent = makeAgent()
    setupSelectChain([agent])

    const profile = await generateAgentFactsProfile('agent-001')
    expect(profile!.verification.trustScore).toBeGreaterThanOrEqual(0)
    expect(profile!.verification.trustScore).toBeLessThanOrEqual(100)
    expect(profile!.verification.level).toBe('none')
  })
})

// ─── computeTrustScore Tests ─────────────────────────────────────────────────

describe('computeTrustScore', () => {
  it('gives 10 base for unverified agent', () => {
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: new Date(),
      lastSeenAt: null,
    })
    expect(score).toBe(10)
  })

  it('adds 40 for individual verification', () => {
    const score = computeTrustScore({
      verificationLevel: 'individual',
      createdAt: new Date(), // 0 age bonus
      lastSeenAt: null,
    })
    expect(score).toBe(50) // 10 base + 40 individual
  })

  it('adds 30 for business verification', () => {
    const score = computeTrustScore({
      verificationLevel: 'business',
      createdAt: new Date(),
      lastSeenAt: null,
    })
    expect(score).toBe(40) // 10 base + 30 business
  })

  it('adds 15 for basic verification', () => {
    const score = computeTrustScore({
      verificationLevel: 'basic',
      createdAt: new Date(),
      lastSeenAt: null,
    })
    expect(score).toBe(25) // 10 base + 15 basic
  })

  it('adds age bonus up to 30 points (90+ days)', () => {
    const ninetyDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000)
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: ninetyDaysAgo,
      lastSeenAt: null,
    })
    expect(score).toBe(40) // 10 base + 30 age
  })

  it('scales age bonus proportionally', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: thirtyDaysAgo,
      lastSeenAt: null,
    })
    // 10 base + floor(30/3) = 10 + 10 = 20
    expect(score).toBe(20)
  })

  it('adds 20 for activity within last day', () => {
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: new Date(),
      lastSeenAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    })
    expect(score).toBe(30) // 10 base + 20 activity
  })

  it('adds 15 for activity within last week', () => {
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: new Date(),
      lastSeenAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    })
    expect(score).toBe(25) // 10 base + 15 activity
  })

  it('adds 10 for activity within last month', () => {
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: new Date(),
      lastSeenAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    })
    expect(score).toBe(20) // 10 base + 10 activity
  })

  it('adds 5 for activity older than 30 days', () => {
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: new Date(),
      lastSeenAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
    })
    expect(score).toBe(15) // 10 base + 5 activity
  })

  it('caps at 100', () => {
    // individual (40) + max age (30) + max activity (20) + base (10) = 100
    const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const score = computeTrustScore({
      verificationLevel: 'individual',
      createdAt: longAgo,
      lastSeenAt: new Date(), // just now
    })
    expect(score).toBe(100)
  })

  it('does not exceed 100 even with all maxed factors', () => {
    const longAgo = new Date(Date.now() - 1000 * 24 * 60 * 60 * 1000)
    const score = computeTrustScore({
      verificationLevel: 'individual',
      createdAt: longAgo,
      lastSeenAt: new Date(),
    })
    expect(score).toBeLessThanOrEqual(100)
  })

  it('handles zero age correctly', () => {
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: new Date(),
      lastSeenAt: null,
    })
    // 10 base + 0 age + 0 activity = 10
    expect(score).toBe(10)
  })
})
