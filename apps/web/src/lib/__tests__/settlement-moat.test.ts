/**
 * Moat-deepening tests for the SettleGrid settlement engine.
 *
 * Covers 7 improvement areas:
 *  1. Ledger integrity verification (verifyLedgerIntegrity)
 *  2. Session timeout handling (expired session rejection)
 *  3. Outcome analytics (getOutcomesByTool)
 *  4. Organization budget enforcement in session creation
 *  5. Currency conversion precision (rounding tests)
 *  6. Compliance processing (processDataExport / processDataDeletion)
 *  7. Enhanced trust score signals (transactions, disputes)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbTransaction, mockRedis, mockTryRedis } = vi.hoisted(() => {
  const mockRedis = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    incrby: vi.fn().mockResolvedValue(0),
    decrby: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
  }

  const mockTryRedis = vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => {
    try { return await fn() } catch { return null }
  })

  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockRedis,
    mockTryRedis,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    transaction: mockDbTransaction,
  },
}))

vi.mock('@/lib/db/schema', () => ({
  accounts: { id: 'id', version: 'version', balanceCents: 'balance_cents', updatedAt: 'updated_at' },
  ledgerEntries: { id: 'id', accountId: 'account_id', entryType: 'entry_type', amountCents: 'amount_cents' },
  workflowSessions: {
    id: 'id', customerId: 'customer_id', parentSessionId: 'parent_session_id',
    budgetCents: 'budget_cents', spentCents: 'spent_cents', reservedCents: 'reserved_cents',
    status: 'status', protocol: 'protocol', metadata: 'metadata', expiresAt: 'expires_at',
    completedAt: 'completed_at', createdAt: 'created_at', updatedAt: 'updated_at',
    settlementMode: 'settlement_mode', hops: 'hops', atomicSettlementId: 'atomic_settlement_id',
    finalizedAt: 'finalized_at', settledAt: 'settled_at',
  },
  settlementBatches: { id: 'id', sessionId: 'session_id', status: 'status', totalAmountCents: 'total_amount_cents', platformFeeCents: 'platform_fee_cents', disbursements: 'disbursements', rollbackReason: 'rollback_reason', processedAt: 'processed_at', createdAt: 'created_at' },
  tools: { id: 'id', developerId: 'developer_id' },
  developers: { id: 'id', revenueSharePct: 'revenue_share_pct', balanceCents: 'balance_cents', updatedAt: 'updated_at' },
  organizations: { id: 'id', monthlyBudgetCents: 'monthly_budget_cents', currentMonthSpendCents: 'current_month_spend_cents' },
  outcomeVerifications: {
    id: 'id', invocationId: 'invocation_id', toolId: 'tool_id', consumerId: 'consumer_id',
    outcomeType: 'outcome_type', successCriteria: 'success_criteria', fullPriceCents: 'full_price_cents',
    failurePriceCents: 'failure_price_cents', actualOutcome: 'actual_outcome', outcomeScore: 'outcome_score',
    passed: 'passed', settledPriceCents: 'settled_price_cents', verifiedAt: 'verified_at',
    disputeStatus: 'dispute_status', disputeReason: 'dispute_reason', disputeResolvedAt: 'dispute_resolved_at',
    disputeDeadline: 'dispute_deadline', createdAt: 'created_at',
  },
  complianceExports: {
    id: 'id', requestType: 'request_type', entityType: 'entity_type', entityId: 'entity_id',
    status: 'status', resultUrl: 'result_url', completedAt: 'completed_at', createdAt: 'created_at',
  },
  agentIdentities: {
    id: 'id', providerId: 'provider_id', agentName: 'agent_name', identityType: 'identity_type',
    publicKey: 'public_key', fingerprint: 'fingerprint', verificationLevel: 'verification_level',
    capabilities: 'capabilities', spendingLimitCents: 'spending_limit_cents', status: 'status',
    metadata: 'metadata', lastSeenAt: 'last_seen_at', createdAt: 'created_at',
  },
  organizationMembers: { id: 'id', orgId: 'org_id', userId: 'user_id', role: 'role', createdAt: 'created_at' },
  costAllocations: { id: 'id', orgId: 'org_id' },
}))

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
  tryRedis: mockTryRedis,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(
    vi.fn().mockImplementation((...args: unknown[]) => args),
    { join: vi.fn(), raw: vi.fn() }
  ),
  lt: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ lt: [a, b] })),
  gte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ gte: [a, b] })),
  lte: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ lte: [a, b] })),
}))

// ─── Imports ────────────────────────────────────────────────────────────────

import { computeTrustScore } from '@/lib/settlement/identity'
import type { TrustScoreInput } from '@/lib/settlement/identity'
import { evaluateOutcome, getOutcomesByTool } from '@/lib/settlement/outcomes'
import type { OutcomeCriteria } from '@/lib/settlement/outcomes'
import { verifyLedgerIntegrity } from '@/lib/settlement/ledger'
import { checkSessionBudget, createSession } from '@/lib/settlement/sessions'
import { processDataExport, processDataDeletion } from '@/lib/settlement/compliance'
import {
  formatCurrency,
  convertCurrency,
  FALLBACK_RATES,
  SUPPORTED_CURRENCIES,
} from '@/lib/settlement/currency'
import { logger } from '@/lib/logger'

// ─── Helpers ────────────────────────────────────────────────────────────────

function setupSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  }
  mockDbSelect.mockReturnValue(chain)
  return chain
}

function setupInsertChain(result: unknown[]) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  }
  mockDbInsert.mockReturnValue(chain)
  return chain
}

function setupUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }
  mockDbUpdate.mockReturnValue(chain)
  return chain
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. LEDGER INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

describe('verifyLedgerIntegrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
      try { return await fn() } catch { return null }
    })
  })

  it('returns balanced=true when debits equal credits', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([{
        totalDebits: 50000,
        totalCredits: 50000,
        entryCount: 100,
      }]),
    })

    const result = await verifyLedgerIntegrity()

    expect(result.balanced).toBe(true)
    expect(result.discrepancy).toBe(0)
    expect(result.totalDebits).toBe(50000)
    expect(result.totalCredits).toBe(50000)
    expect(result.entryCount).toBe(100)
  })

  it('returns balanced=false when debits exceed credits', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([{
        totalDebits: 50100,
        totalCredits: 50000,
        entryCount: 101,
      }]),
    })

    const result = await verifyLedgerIntegrity()

    expect(result.balanced).toBe(false)
    expect(result.discrepancy).toBe(100)
  })

  it('returns balanced=false when credits exceed debits', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([{
        totalDebits: 49000,
        totalCredits: 50000,
        entryCount: 98,
      }]),
    })

    const result = await verifyLedgerIntegrity()

    expect(result.balanced).toBe(false)
    expect(result.discrepancy).toBe(-1000)
  })

  it('returns balanced=true for empty ledger', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([{
        totalDebits: 0,
        totalCredits: 0,
        entryCount: 0,
      }]),
    })

    const result = await verifyLedgerIntegrity()

    expect(result.balanced).toBe(true)
    expect(result.entryCount).toBe(0)
    expect(result.discrepancy).toBe(0)
  })

  it('logs error on integrity failure', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockResolvedValue([{
        totalDebits: 100,
        totalCredits: 50,
        entryCount: 3,
      }]),
    })

    await verifyLedgerIntegrity()

    expect(logger.error).toHaveBeenCalledWith(
      'ledger.integrity_failure',
      expect.objectContaining({ discrepancy: 50 })
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. SESSION TIMEOUT HANDLING
// ═══════════════════════════════════════════════════════════════════════════

describe('Session expiry enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
      try { return await fn() } catch { return null }
    })
  })

  it('checkSessionBudget rejects expired sessions via DB fallback', async () => {
    mockRedis.get.mockResolvedValue(null)

    setupSelectChain([{
      budgetCents: 10000,
      spentCents: 0,
      reservedCents: 0,
      status: 'active',
      expiresAt: new Date(Date.now() - 60000), // expired 1 min ago
    }])

    const result = await checkSessionBudget('sess-expired', 100)

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('SESSION_EXPIRED')
  })

  it('checkSessionBudget rejects non-active sessions', async () => {
    mockRedis.get.mockResolvedValue(null)

    setupSelectChain([{
      budgetCents: 10000,
      spentCents: 0,
      reservedCents: 0,
      status: 'expired',
      expiresAt: null,
    }])

    const result = await checkSessionBudget('sess-done', 100)

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('SESSION_INACTIVE')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. OUTCOME ANALYTICS (getOutcomesByTool)
// ═══════════════════════════════════════════════════════════════════════════

describe('getOutcomesByTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
      try { return await fn() } catch { return null }
    })
  })

  it('computes pass rate and averages for a tool with mixed outcomes', async () => {
    const outcomes = [
      { id: 'v1', toolId: 'tool-a', passed: true, verifiedAt: new Date(), outcomeScore: 95, settledPriceCents: 100, disputeStatus: null },
      { id: 'v2', toolId: 'tool-a', passed: true, verifiedAt: new Date(), outcomeScore: 80, settledPriceCents: 100, disputeStatus: null },
      { id: 'v3', toolId: 'tool-a', passed: false, verifiedAt: new Date(), outcomeScore: 30, settledPriceCents: 0, disputeStatus: null },
      { id: 'v4', toolId: 'tool-a', passed: null, verifiedAt: null, outcomeScore: null, settledPriceCents: null, disputeStatus: null },
      { id: 'v5', toolId: 'tool-a', passed: false, verifiedAt: new Date(), outcomeScore: 10, settledPriceCents: 0, disputeStatus: 'opened' },
    ]

    setupSelectChain(outcomes)

    const result = await getOutcomesByTool('tool-a')

    expect(result.toolId).toBe('tool-a')
    expect(result.totalCount).toBe(5)
    expect(result.passedCount).toBe(2)
    expect(result.failedCount).toBe(2)
    expect(result.pendingCount).toBe(1)
    expect(result.disputedCount).toBe(1)
    expect(result.passRate).toBe(50)
    expect(result.avgScore).toBe(54)
    expect(result.totalSettledCents).toBe(200)
    expect(result.outcomes).toHaveLength(5)
  })

  it('returns zeros for a tool with no outcomes', async () => {
    setupSelectChain([])

    const result = await getOutcomesByTool('tool-empty')

    expect(result.totalCount).toBe(0)
    expect(result.passedCount).toBe(0)
    expect(result.failedCount).toBe(0)
    expect(result.passRate).toBe(0)
    expect(result.avgScore).toBeNull()
    expect(result.totalSettledCents).toBe(0)
  })

  it('returns 100% pass rate when all outcomes pass', async () => {
    const outcomes = [
      { id: 'v1', toolId: 'tool-b', passed: true, verifiedAt: new Date(), outcomeScore: 100, settledPriceCents: 50, disputeStatus: null },
      { id: 'v2', toolId: 'tool-b', passed: true, verifiedAt: new Date(), outcomeScore: 90, settledPriceCents: 50, disputeStatus: null },
    ]

    setupSelectChain(outcomes)

    const result = await getOutcomesByTool('tool-b')

    expect(result.passRate).toBe(100)
    expect(result.avgScore).toBe(95)
  })

  it('returns null avgScore when no outcomes have scores', async () => {
    const outcomes = [
      { id: 'v1', toolId: 'tool-c', passed: true, verifiedAt: new Date(), outcomeScore: null, settledPriceCents: 100, disputeStatus: null },
    ]

    setupSelectChain(outcomes)

    const result = await getOutcomesByTool('tool-c')

    expect(result.avgScore).toBeNull()
    expect(result.passRate).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. ORGANIZATION BUDGET ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('Organization budget enforcement in createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
      try { return await fn() } catch { return null }
    })
  })

  it('rejects session creation when org budget is exceeded', async () => {
    setupSelectChain([{
      monthlyBudgetCents: 10000,
      currentMonthSpendCents: 9500,
    }])

    await expect(
      createSession({
        customerId: 'cust-1',
        budgetCents: 1000,
        orgId: 'org-1',
      })
    ).rejects.toThrow('Organization monthly budget exceeded')
  })

  it('rejects session when org does not exist', async () => {
    setupSelectChain([])

    await expect(
      createSession({
        customerId: 'cust-1',
        budgetCents: 100,
        orgId: 'org-missing',
      })
    ).rejects.toThrow('Organization not found')
  })

  it('allows session when org has unlimited budget (null)', async () => {
    // First call: org lookup (unlimited)
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn()
        .mockResolvedValueOnce([{ monthlyBudgetCents: null, currentMonthSpendCents: 50000 }]),
    }
    mockDbSelect.mockReturnValue(chain)

    // Session insert
    setupInsertChain([{
      id: 'sess-1',
      customerId: 'cust-1',
      parentSessionId: null,
      budgetCents: 5000,
      spentCents: 0,
      reservedCents: 0,
      status: 'active',
      expiresAt: new Date(Date.now() + 3600000),
    }])

    const result = await createSession({
      customerId: 'cust-1',
      budgetCents: 5000,
      orgId: 'org-unlimited',
    })

    expect(result.id).toBe('sess-1')
    expect(result.budgetCents).toBe(5000)
  })

  it('skips org check when orgId is not provided', async () => {
    setupInsertChain([{
      id: 'sess-3',
      customerId: 'cust-3',
      parentSessionId: null,
      budgetCents: 2000,
      spentCents: 0,
      reservedCents: 0,
      status: 'active',
      expiresAt: new Date(Date.now() + 3600000),
    }])

    const result = await createSession({
      customerId: 'cust-3',
      budgetCents: 2000,
    })

    expect(result.budgetCents).toBe(2000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. CURRENCY CONVERSION PRECISION
// ═══════════════════════════════════════════════════════════════════════════

describe('Currency conversion precision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.OPEN_EXCHANGE_RATES_API_KEY
    mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
      try { return await fn() } catch { return null }
    })
  })

  it('rounds to nearest cent for USD -> EUR', async () => {
    const result = await convertCurrency(1234, 'USD', 'EUR')
    expect(result).toBe(Math.round(1234 * FALLBACK_RATES['USD/EUR']))
    expect(Number.isInteger(result)).toBe(true)
  })

  it('rounds to nearest cent for EUR -> USD', async () => {
    const result = await convertCurrency(999, 'EUR', 'USD')
    expect(result).toBe(Math.round(999 * FALLBACK_RATES['EUR/USD']))
    expect(Number.isInteger(result)).toBe(true)
  })

  it('never produces fractional cents for USD -> GBP', async () => {
    const result = await convertCurrency(777, 'USD', 'GBP')
    expect(Number.isInteger(result)).toBe(true)
  })

  it('never produces fractional values for USD -> JPY', async () => {
    const result = await convertCurrency(100, 'USD', 'JPY')
    expect(Number.isInteger(result)).toBe(true)
  })

  it('preserves 1:1 for USDC -> USD', async () => {
    const result = await convertCurrency(5000, 'USDC', 'USD')
    expect(result).toBe(5000)
  })

  it('preserves 1:1 for USD -> USDC', async () => {
    const result = await convertCurrency(5000, 'USD', 'USDC')
    expect(result).toBe(5000)
  })

  it('handles 1 cent conversion without losing precision', async () => {
    const result = await convertCurrency(1, 'USD', 'EUR')
    expect(result).toBe(Math.round(1 * FALLBACK_RATES['USD/EUR']))
    expect(result).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('handles very large amounts without floating point issues', async () => {
    const largeAmount = 99999999
    const result = await convertCurrency(largeAmount, 'USD', 'EUR')
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBe(Math.round(largeAmount * FALLBACK_RATES['USD/EUR']))
  })

  it('same currency returns exact same amount for any value', async () => {
    expect(await convertCurrency(1, 'USD', 'USD')).toBe(1)
    expect(await convertCurrency(0, 'USD', 'USD')).toBe(0)
    expect(await convertCurrency(99999999, 'USD', 'USD')).toBe(99999999)
  })

  it('rounds correctly for GBP -> EUR cross rate', async () => {
    const result = await convertCurrency(500, 'GBP', 'EUR')
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBe(Math.round(500 * FALLBACK_RATES['GBP/EUR']))
  })

  it('all supported currencies format correctly', () => {
    for (const code of Object.keys(SUPPORTED_CURRENCIES)) {
      const formatted = formatCurrency(12345, code as 'USD' | 'EUR' | 'GBP' | 'JPY' | 'USDC')
      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. COMPLIANCE PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

describe('processDataExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
      try { return await fn() } catch { return null }
    })
  })

  it('processes a pending export and returns completed with URL', async () => {
    setupSelectChain([{
      id: 'exp-1',
      requestType: 'data-export',
      entityType: 'customer',
      entityId: 'cust-1',
      status: 'pending',
    }])
    setupUpdateChain()

    const result = await processDataExport('exp-1')

    expect(result.status).toBe('completed')
    expect(result.resultUrl).toContain('exp-1')
    expect(result.resultUrl).toContain('data.json')
  })

  it('throws when export not found', async () => {
    setupSelectChain([])

    await expect(processDataExport('missing')).rejects.toThrow('Export request not found')
  })

  it('throws when record is not a data-export type', async () => {
    setupSelectChain([{
      id: 'del-1',
      requestType: 'data-deletion',
      status: 'pending',
    }])

    await expect(processDataExport('del-1')).rejects.toThrow('Not a data-export request')
  })

  it('throws when export already processed', async () => {
    setupSelectChain([{
      id: 'exp-2',
      requestType: 'data-export',
      status: 'completed',
    }])

    await expect(processDataExport('exp-2')).rejects.toThrow('Export already processed')
  })
})

describe('processDataDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTryRedis.mockImplementation(async (fn: () => Promise<unknown>) => {
      try { return await fn() } catch { return null }
    })
  })

  it('processes a pending deletion and returns completed', async () => {
    setupSelectChain([{
      id: 'del-1',
      requestType: 'data-deletion',
      entityType: 'customer',
      entityId: 'cust-1',
      status: 'pending',
    }])
    setupUpdateChain()

    const result = await processDataDeletion('del-1')

    expect(result.status).toBe('completed')
  })

  it('throws when deletion not found', async () => {
    setupSelectChain([])

    await expect(processDataDeletion('missing')).rejects.toThrow('Deletion request not found')
  })

  it('throws when record is not a data-deletion type', async () => {
    setupSelectChain([{
      id: 'exp-1',
      requestType: 'data-export',
      status: 'pending',
    }])

    await expect(processDataDeletion('exp-1')).rejects.toThrow('Not a data-deletion request')
  })

  it('throws when deletion already processed', async () => {
    setupSelectChain([{
      id: 'del-2',
      requestType: 'data-deletion',
      status: 'completed',
    }])

    await expect(processDataDeletion('del-2')).rejects.toThrow('Deletion already processed')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. ENHANCED TRUST SCORE
// ═══════════════════════════════════════════════════════════════════════════

describe('computeTrustScore - enhanced signals', () => {
  const baseAgent: TrustScoreInput = {
    verificationLevel: 'none',
    createdAt: new Date(),
    lastSeenAt: null,
  }

  it('rewards high transaction success rate', () => {
    const score = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 950,
      failedTransactions: 50,
      totalDisputes: 0,
    })
    expect(score).toBeGreaterThan(computeTrustScore(baseAgent))
  })

  it('penalizes high failure rate', () => {
    const highSuccess = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 950,
      failedTransactions: 50,
      totalDisputes: 0,
    })
    const highFailure = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 50,
      failedTransactions: 950,
      totalDisputes: 0,
    })
    expect(highSuccess).toBeGreaterThan(highFailure)
  })

  it('gives volume bonus for high transaction count', () => {
    const lowVolume = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 10,
      failedTransactions: 0,
      totalDisputes: 0,
    })
    const highVolume = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 1000,
      failedTransactions: 0,
      totalDisputes: 0,
    })
    expect(highVolume).toBeGreaterThan(lowVolume)
  })

  it('gives full dispute points for clean record with transactions', () => {
    const cleanRecord = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 100,
      failedTransactions: 0,
      totalDisputes: 0,
    })
    const disputedRecord = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 100,
      failedTransactions: 0,
      totalDisputes: 10,
    })
    expect(cleanRecord).toBeGreaterThan(disputedRecord)
  })

  it('penalizes high dispute rate (>=10%)', () => {
    const score = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 80,
      failedTransactions: 20,
      totalDisputes: 20,
    })
    expect(score).toBeLessThan(50)
  })

  it('gives moderate dispute points for low dispute rate (<1%)', () => {
    const lowDispute = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 990,
      failedTransactions: 10,
      totalDisputes: 5,
      resolvedDisputes: 5,
    })
    const highDispute = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 990,
      failedTransactions: 10,
      totalDisputes: 100,
      resolvedDisputes: 100,
    })
    expect(lowDispute).toBeGreaterThan(highDispute)
  })

  it('gives resolution bonus when all disputes are resolved', () => {
    const allResolved = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 100,
      failedTransactions: 0,
      totalDisputes: 5,
      resolvedDisputes: 5,
    })
    const noneResolved = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 100,
      failedTransactions: 0,
      totalDisputes: 5,
      resolvedDisputes: 0,
    })
    expect(allResolved).toBeGreaterThan(noneResolved)
  })

  it('penalizes recent disputes (< 7 days)', () => {
    const recentDispute = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 100,
      failedTransactions: 0,
      totalDisputes: 1,
      lastDisputeAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    })
    const oldDispute = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 100,
      failedTransactions: 0,
      totalDisputes: 1,
      lastDisputeAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    })
    expect(oldDispute).toBeGreaterThan(recentDispute)
  })

  it('never goes below 0', () => {
    const worstCase = computeTrustScore({
      verificationLevel: 'none',
      createdAt: new Date(),
      lastSeenAt: null,
      successfulTransactions: 0,
      failedTransactions: 100,
      totalDisputes: 100,
      lastDisputeAt: new Date(),
    })
    expect(worstCase).toBeGreaterThanOrEqual(0)
  })

  it('never exceeds 100 with all positive signals', () => {
    const bestCase = computeTrustScore({
      verificationLevel: 'individual',
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      lastSeenAt: new Date(),
      successfulTransactions: 10000,
      failedTransactions: 0,
      totalDisputes: 0,
    })
    expect(bestCase).toBeLessThanOrEqual(100)
  })

  it('neutral dispute score for no-transaction agents', () => {
    const score = computeTrustScore({
      verificationLevel: 'none',
      createdAt: new Date(),
      lastSeenAt: null,
    })
    expect(score).toBe(10)
  })

  it('handles zero successful + zero failed (no tx data)', () => {
    const score = computeTrustScore({
      ...baseAgent,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalDisputes: 0,
    })
    expect(score).toBe(10)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BONUS: evaluateOutcome edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('evaluateOutcome edge cases', () => {
  it('boolean: 0 is truthy in this implementation', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean' }
    const result = evaluateOutcome(criteria, 0)
    expect(result.passed).toBe(true)
  })

  it('boolean: empty string is truthy', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean' }
    const result = evaluateOutcome(criteria, '')
    expect(result.passed).toBe(true)
  })

  it('score: exactly 1.0 normalizes to 100', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'score', minScore: 0.5 }
    const result = evaluateOutcome(criteria, 1.0)
    expect(result.score).toBe(100)
    expect(result.passed).toBe(true)
  })

  it('score: 0.0 gives score 0', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'score', minScore: 0.1 }
    const result = evaluateOutcome(criteria, 0.0)
    expect(result.score).toBe(0)
    expect(result.passed).toBe(false)
  })

  it('latency: exactly at maxLatencyMs passes', () => {
    const criteria: OutcomeCriteria = { outcomeType: 'boolean', maxLatencyMs: 500 }
    const result = evaluateOutcome(criteria, true, 500)
    expect(result.passed).toBe(true)
  })
})
