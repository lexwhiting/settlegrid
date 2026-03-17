import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  outcomeVerifications: {
    id: 'id',
    invocationId: 'invocation_id',
    toolId: 'tool_id',
    consumerId: 'consumer_id',
    outcomeType: 'outcome_type',
    successCriteria: 'success_criteria',
    fullPriceCents: 'full_price_cents',
    failurePriceCents: 'failure_price_cents',
    actualOutcome: 'actual_outcome',
    outcomeScore: 'outcome_score',
    passed: 'passed',
    settledPriceCents: 'settled_price_cents',
    verifiedAt: 'verified_at',
    disputeStatus: 'dispute_status',
    disputeReason: 'dispute_reason',
    disputeResolvedAt: 'dispute_resolved_at',
    disputeDeadline: 'dispute_deadline',
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
  evaluateOutcome,
  createOutcomeVerification,
  verifyOutcome,
  openDispute,
  resolveDispute,
  getOutcomeVerification,
} from '@/lib/settlement/outcomes'
import type { OutcomeCriteria } from '@/lib/settlement/outcomes'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockInsertChain(returnValue: unknown[]) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnValue),
  }
  mockDbInsert.mockReturnValue(chain)
  return chain
}

function mockSelectChain(returnValue: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
  }
  mockDbSelect.mockReturnValue(chain)
  return chain
}

function mockUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }
  mockDbUpdate.mockReturnValue(chain)
  return chain
}

// ─── evaluateOutcome (pure function) ────────────────────────────────────────

describe('evaluateOutcome', () => {
  it('boolean: truthy outcome passes', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean' }
    const result = evaluateOutcome(criteria, true)
    expect(result.passed).toBe(true)
    expect(result.score).toBe(100)
  })

  it('boolean: false outcome fails', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean' }
    const result = evaluateOutcome(criteria, false)
    expect(result.passed).toBe(false)
    expect(result.score).toBe(0)
  })

  it('boolean: null outcome fails', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean' }
    const result = evaluateOutcome(criteria, null)
    expect(result.passed).toBe(false)
    expect(result.score).toBe(0)
  })

  it('boolean: undefined outcome fails', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean' }
    const result = evaluateOutcome(criteria, undefined)
    expect(result.passed).toBe(false)
    expect(result.score).toBe(0)
  })

  it('boolean: string outcome passes', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean' }
    const result = evaluateOutcome(criteria, 'some result')
    expect(result.passed).toBe(true)
    expect(result.score).toBe(100)
  })

  it('score: above minScore passes', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'score', minScore: 0.7 }
    const result = evaluateOutcome(criteria, 0.85)
    expect(result.passed).toBe(true)
    expect(result.score).toBe(85)
  })

  it('score: below minScore fails', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'score', minScore: 0.7 }
    const result = evaluateOutcome(criteria, 0.5)
    expect(result.passed).toBe(false)
    expect(result.score).toBe(50)
    expect(result.reason).toContain('below minimum')
  })

  it('score: equal to minScore passes', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'score', minScore: 0.7 }
    const result = evaluateOutcome(criteria, 0.7)
    expect(result.passed).toBe(true)
    expect(result.score).toBe(70)
  })

  it('score: uses default minScore of 0.5', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'score' }
    const result = evaluateOutcome(criteria, 0.6)
    expect(result.passed).toBe(true)
  })

  it('score: non-number outcome gets score 0', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'score', minScore: 0.5 }
    const result = evaluateOutcome(criteria, 'not a number')
    expect(result.passed).toBe(false)
    expect(result.score).toBe(0)
  })

  it('custom: all required fields present passes', () => {
    const criteria: OutcomeCriteria = {
      outcomeType: 'custom',
      requiredFields: ['name', 'email'],
    }
    const result = evaluateOutcome(criteria, { name: 'John', email: 'john@test.com' })
    expect(result.passed).toBe(true)
    expect(result.score).toBe(100)
  })

  it('custom: missing required fields fails', () => {
    const criteria: OutcomeCriteria = {
      outcomeType: 'custom',
      requiredFields: ['name', 'email', 'phone'],
    }
    const result = evaluateOutcome(criteria, { name: 'John' })
    expect(result.passed).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reason).toContain('email')
    expect(result.reason).toContain('phone')
  })

  it('custom: no requiredFields always passes', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'custom' }
    const result = evaluateOutcome(criteria, { anything: true })
    expect(result.passed).toBe(true)
  })

  it('latency: exceeding maxLatencyMs fails', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean', maxLatencyMs: 500 }
    const result = evaluateOutcome(criteria, true, 800)
    expect(result.passed).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reason).toContain('Latency')
  })

  it('latency: within maxLatencyMs passes', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean', maxLatencyMs: 500 }
    const result = evaluateOutcome(criteria, true, 300)
    expect(result.passed).toBe(true)
    expect(result.score).toBe(100)
  })

  it('unknown outcomeType defaults to pass', () => {
    const criteria = { outcomeType: 'unknown' } as unknown as OutcomeCriteria
    const result = evaluateOutcome(criteria, 'anything')
    expect(result.passed).toBe(true)
    expect(result.score).toBe(100)
  })
})

// ─── createOutcomeVerification ──────────────────────────────────────────────

describe('createOutcomeVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a pending verification record', async () => {
    const insertChain = mockInsertChain([{ id: 'ver-123' }])

    const result = await createOutcomeVerification({
      invocationId: 'inv-1',
      toolId: 'tool-1',
      consumerId: 'cons-1',
      outcomeType: 'boolean',
      successCriteria: { outcomeType: 'boolean' },
      fullPriceCents: 1000,
    })

    expect(result.id).toBe('ver-123')
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        invocationId: 'inv-1',
        toolId: 'tool-1',
        consumerId: 'cons-1',
        outcomeType: 'boolean',
        fullPriceCents: 1000,
        failurePriceCents: 0,
      })
    )
  })

  it('stores custom failurePriceCents when provided', async () => {
    const insertChain = mockInsertChain([{ id: 'ver-456' }])

    await createOutcomeVerification({
      invocationId: 'inv-2',
      toolId: 'tool-2',
      consumerId: 'cons-2',
      outcomeType: 'score',
      successCriteria: { outcomeType: 'score', minScore: 0.8 },
      fullPriceCents: 500,
      failurePriceCents: 100,
    })

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        failurePriceCents: 100,
      })
    )
  })
})

// ─── verifyOutcome ──────────────────────────────────────────────────────────

describe('verifyOutcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('charges full price on successful boolean outcome', async () => {
    mockSelectChain([{
      id: 'ver-1',
      outcomeType: 'boolean',
      successCriteria: { outcomeType: 'boolean' },
      fullPriceCents: 1000,
      failurePriceCents: 0,
      verifiedAt: null,
    }])
    const updateChain = mockUpdateChain()

    const result = await verifyOutcome('ver-1', true)

    expect(result.passed).toBe(true)
    expect(result.settledPriceCents).toBe(1000)
    expect(result.score).toBe(100)
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        passed: true,
        settledPriceCents: 1000,
        outcomeScore: 100,
      })
    )
  })

  it('charges failure price on failed boolean outcome', async () => {
    mockSelectChain([{
      id: 'ver-2',
      outcomeType: 'boolean',
      successCriteria: { outcomeType: 'boolean' },
      fullPriceCents: 1000,
      failurePriceCents: 200,
      verifiedAt: null,
    }])
    mockUpdateChain()

    const result = await verifyOutcome('ver-2', false)

    expect(result.passed).toBe(false)
    expect(result.settledPriceCents).toBe(200)
  })

  it('charges zero on failure when failurePriceCents is 0', async () => {
    mockSelectChain([{
      id: 'ver-3',
      successCriteria: { outcomeType: 'boolean' },
      fullPriceCents: 500,
      failurePriceCents: 0,
      verifiedAt: null,
    }])
    mockUpdateChain()

    const result = await verifyOutcome('ver-3', null)

    expect(result.passed).toBe(false)
    expect(result.settledPriceCents).toBe(0)
  })

  it('verifies score-based outcome above threshold', async () => {
    mockSelectChain([{
      id: 'ver-4',
      successCriteria: { outcomeType: 'score', minScore: 0.7 },
      fullPriceCents: 1000,
      failurePriceCents: 200,
      verifiedAt: null,
    }])
    mockUpdateChain()

    const result = await verifyOutcome('ver-4', 0.85)

    expect(result.passed).toBe(true)
    expect(result.settledPriceCents).toBe(1000)
    expect(result.score).toBe(85)
  })

  it('verifies score-based outcome below threshold', async () => {
    mockSelectChain([{
      id: 'ver-5',
      successCriteria: { outcomeType: 'score', minScore: 0.7 },
      fullPriceCents: 1000,
      failurePriceCents: 100,
      verifiedAt: null,
    }])
    mockUpdateChain()

    const result = await verifyOutcome('ver-5', 0.3)

    expect(result.passed).toBe(false)
    expect(result.settledPriceCents).toBe(100)
  })

  it('throws when verification not found', async () => {
    mockSelectChain([])

    await expect(verifyOutcome('missing', true)).rejects.toThrow('Verification not found')
  })

  it('throws when already verified', async () => {
    mockSelectChain([{
      id: 'ver-6',
      verifiedAt: new Date(),
    }])

    await expect(verifyOutcome('ver-6', true)).rejects.toThrow('Verification already completed')
  })
})

// ─── openDispute ────────────────────────────────────────────────────────────

describe('openDispute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens dispute when within deadline', async () => {
    mockSelectChain([{
      id: 'ver-1',
      verifiedAt: new Date(),
      disputeDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h from now
      disputeStatus: null,
    }])
    const updateChain = mockUpdateChain()

    await openDispute('ver-1', 'Result was incorrect')

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeStatus: 'opened',
        disputeReason: 'Result was incorrect',
      })
    )
  })

  it('throws when dispute deadline has passed', async () => {
    mockSelectChain([{
      id: 'ver-2',
      verifiedAt: new Date(),
      disputeDeadline: new Date(Date.now() - 1000), // 1s ago
      disputeStatus: null,
    }])

    await expect(openDispute('ver-2', 'Too late')).rejects.toThrow('Dispute deadline has passed')
  })

  it('throws when verification not found', async () => {
    mockSelectChain([])

    await expect(openDispute('missing', 'reason')).rejects.toThrow('Verification not found')
  })

  it('throws when outcome not yet verified', async () => {
    mockSelectChain([{
      id: 'ver-3',
      verifiedAt: null,
      disputeStatus: null,
    }])

    await expect(openDispute('ver-3', 'reason')).rejects.toThrow('Cannot dispute an unverified outcome')
  })

  it('throws when dispute already exists', async () => {
    mockSelectChain([{
      id: 'ver-4',
      verifiedAt: new Date(),
      disputeDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000),
      disputeStatus: 'opened',
    }])

    await expect(openDispute('ver-4', 'again')).rejects.toThrow('Dispute already exists')
  })
})

// ─── resolveDispute ─────────────────────────────────────────────────────────

describe('resolveDispute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves for consumer (sets failure price)', async () => {
    mockSelectChain([{
      id: 'ver-1',
      disputeStatus: 'opened',
      fullPriceCents: 1000,
      failurePriceCents: 200,
      settledPriceCents: 1000,
    }])
    const updateChain = mockUpdateChain()

    await resolveDispute('ver-1', 'resolved_for_consumer')

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeStatus: 'resolved_for_consumer',
        settledPriceCents: 200,
      })
    )
  })

  it('resolves for provider (sets full price)', async () => {
    mockSelectChain([{
      id: 'ver-2',
      disputeStatus: 'opened',
      fullPriceCents: 1000,
      failurePriceCents: 0,
      settledPriceCents: 0,
    }])
    const updateChain = mockUpdateChain()

    await resolveDispute('ver-2', 'resolved_for_provider')

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        disputeStatus: 'resolved_for_provider',
        settledPriceCents: 1000,
      })
    )
  })

  it('throws when verification not found', async () => {
    mockSelectChain([])

    await expect(resolveDispute('missing', 'resolved_for_consumer')).rejects.toThrow('Verification not found')
  })

  it('throws when no open dispute', async () => {
    mockSelectChain([{
      id: 'ver-3',
      disputeStatus: null,
    }])

    await expect(resolveDispute('ver-3', 'resolved_for_consumer')).rejects.toThrow('No open dispute to resolve')
  })
})

// ─── getOutcomeVerification ─────────────────────────────────────────────────

describe('getOutcomeVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns verification when found', async () => {
    const mockVerification = {
      id: 'ver-1',
      invocationId: 'inv-1',
      toolId: 'tool-1',
      consumerId: 'cons-1',
      passed: true,
      settledPriceCents: 500,
    }
    mockSelectChain([mockVerification])

    const result = await getOutcomeVerification('ver-1')
    expect(result).toEqual(mockVerification)
  })

  it('returns null when not found', async () => {
    mockSelectChain([])

    const result = await getOutcomeVerification('missing')
    expect(result).toBeNull()
  })
})
