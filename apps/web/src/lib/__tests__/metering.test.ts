import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(1),
  decrby: vi.fn(),
  incrby: vi.fn(),
}

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
  tryRedis: vi.fn(async (fn: () => Promise<unknown>) => {
    try { return await fn() } catch { return null }
  }),
}))

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 'inv-1' }]) }) }),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  consumerToolBalances: { consumerId: 'consumer_id', toolId: 'tool_id', balanceCents: 'balance_cents', spendingLimitCents: 'spending_limit_cents', currentPeriodSpendCents: 'current_period_spend_cents', periodResetAt: 'period_reset_at', id: 'id' },
  invocations: { id: 'id', toolId: 'tool_id', consumerId: 'consumer_id', apiKeyId: 'api_key_id', method: 'method', costCents: 'cost_cents', latencyMs: 'latency_ms', status: 'status' },
  tools: { id: 'id', totalInvocations: 'total_invocations', totalRevenueCents: 'total_revenue_cents', developerId: 'developer_id', updatedAt: 'updated_at' },
  developers: { id: 'id', balanceCents: 'balance_cents', updatedAt: 'updated_at' },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}))

describe('Metering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkBudget', () => {
    it('allows when no budget limit is set in Redis', async () => {
      mockRedis.get.mockResolvedValue(null)
      const { checkBudget } = await import('../metering')
      const result = await checkBudget('c1', 't1', 100)
      expect(result.allowed).toBe(true)
    })

    it('allows when spend is within limit', async () => {
      mockRedis.get
        .mockResolvedValueOnce('1000') // limit
        .mockResolvedValueOnce('200')  // spend
        .mockResolvedValueOnce(null)   // reset
      const { checkBudget } = await import('../metering')
      const result = await checkBudget('c1', 't1', 100)
      expect(result.allowed).toBe(true)
      expect(result.currentSpendCents).toBe(200)
      expect(result.limitCents).toBe(1000)
    })

    it('blocks when spend exceeds limit', async () => {
      mockRedis.get
        .mockResolvedValueOnce('1000') // limit
        .mockResolvedValueOnce('950')  // spend
        .mockResolvedValueOnce(null)   // reset
      const { checkBudget } = await import('../metering')
      const result = await checkBudget('c1', 't1', 100)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('BUDGET_EXCEEDED')
    })

    it('blocks when spend exactly equals limit', async () => {
      mockRedis.get
        .mockResolvedValueOnce('1000') // limit
        .mockResolvedValueOnce('950')  // spend
        .mockResolvedValueOnce(null)   // reset
      const { checkBudget } = await import('../metering')
      const result = await checkBudget('c1', 't1', 51)
      expect(result.allowed).toBe(false)
    })

    it('resets period when resetAt has passed', async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString()
      mockRedis.get
        .mockResolvedValueOnce('1000')   // limit
        .mockResolvedValueOnce('900')    // spend
        .mockResolvedValueOnce(pastDate) // reset (in the past)
      const { checkBudget } = await import('../metering')
      const result = await checkBudget('c1', 't1', 100)
      expect(result.allowed).toBe(true)
      expect(result.currentSpendCents).toBe(0)
    })

    it('allows when limit is non-numeric', async () => {
      mockRedis.get
        .mockResolvedValueOnce('not-a-number')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
      const { checkBudget } = await import('../metering')
      const result = await checkBudget('c1', 't1', 100)
      expect(result.allowed).toBe(true)
    })
  })

  describe('deductCreditsRedis', () => {
    it('returns remaining balance on successful deduction', async () => {
      mockRedis.exists.mockResolvedValue(1)
      mockRedis.decrby.mockResolvedValue(900)
      const { deductCreditsRedis } = await import('../metering')
      const result = await deductCreditsRedis('c1', 't1', 100)
      expect(result).toBe(900)
    })

    it('returns null and rolls back when balance goes negative', async () => {
      mockRedis.exists.mockResolvedValue(1)
      mockRedis.decrby.mockResolvedValue(-50)
      mockRedis.incrby.mockResolvedValue(50)
      const { deductCreditsRedis } = await import('../metering')
      const result = await deductCreditsRedis('c1', 't1', 100)
      expect(result).toBeNull()
      expect(mockRedis.incrby).toHaveBeenCalled()
    })
  })

  describe('getBalance', () => {
    it('returns cached value from Redis', async () => {
      mockRedis.get.mockResolvedValue(5000)
      const { getBalance } = await import('../metering')
      const result = await getBalance('c1', 't1')
      expect(result).toBe(5000)
    })
  })

  describe('invalidateBalanceCache', () => {
    it('deletes Redis balance key', async () => {
      const { invalidateBalanceCache } = await import('../metering')
      await invalidateBalanceCache('c1', 't1')
      expect(mockRedis.del).toHaveBeenCalled()
    })
  })

  describe('syncBudgetToRedis', () => {
    it('sets budget keys when limit is provided', async () => {
      const { syncBudgetToRedis } = await import('../metering')
      await syncBudgetToRedis('c1', 't1', 1000, 200, new Date())
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('deletes budget keys when limit is null', async () => {
      const { syncBudgetToRedis } = await import('../metering')
      await syncBudgetToRedis('c1', 't1', null, 0, null)
      expect(mockRedis.del).toHaveBeenCalled()
    })
  })

  describe('recordInvocationAsync', () => {
    it('does not throw on call', async () => {
      const { recordInvocationAsync } = await import('../metering')
      expect(() =>
        recordInvocationAsync({
          toolId: 't1',
          consumerId: 'c1',
          keyId: 'k1',
          method: 'test',
          costCents: 100,
          latencyMs: 50,
          developerId: 'd1',
          revenueSharePct: 85,
        })
      ).not.toThrow()
    })
  })
})
