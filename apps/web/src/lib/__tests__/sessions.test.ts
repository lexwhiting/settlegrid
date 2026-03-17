import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  workflowSessions: {
    id: 'id',
    customerId: 'customer_id',
    parentSessionId: 'parent_session_id',
    budgetCents: 'budget_cents',
    spentCents: 'spent_cents',
    reservedCents: 'reserved_cents',
    status: 'status',
    protocol: 'protocol',
    metadata: 'metadata',
    expiresAt: 'expires_at',
    completedAt: 'completed_at',
    createdAt: 'created_at',
  },
}))

const mockRedis = {
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  incrby: vi.fn().mockResolvedValue(0),
  del: vi.fn().mockResolvedValue(1),
}

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
  tryRedis: async (fn: () => Promise<unknown>) => {
    try { return await fn() } catch { return null }
  },
}))

import { checkSessionBudget } from '@/lib/settlement/sessions'

describe('checkSessionBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows when Redis shows sufficient budget', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('budget')) return Promise.resolve('10000')
      if (key.includes('spent')) return Promise.resolve('3000')
      if (key.includes('reserved')) return Promise.resolve('2000')
      return Promise.resolve(null)
    })

    const result = await checkSessionBudget('sess-1', 100)
    expect(result.allowed).toBe(true)
    expect(result.availableCents).toBe(4900) // 10000 - 3000 - 2000 - 100
  })

  it('rejects when Redis shows insufficient budget', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('budget')) return Promise.resolve('1000')
      if (key.includes('spent')) return Promise.resolve('800')
      if (key.includes('reserved')) return Promise.resolve('100')
      return Promise.resolve(null)
    })

    const result = await checkSessionBudget('sess-1', 200)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('SESSION_BUDGET_EXCEEDED')
    expect(result.availableCents).toBe(100) // 1000 - 800 - 100
  })

  it('falls back to DB when Redis returns null', async () => {
    mockRedis.get.mockResolvedValue(null)

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            budgetCents: 5000,
            spentCents: 1000,
            reservedCents: 500,
            status: 'active',
            expiresAt: new Date(Date.now() + 3600000),
          }]),
        }),
      }),
    })

    const result = await checkSessionBudget('sess-1', 100)
    expect(result.allowed).toBe(true)
    expect(result.availableCents).toBe(3400) // 5000 - 1000 - 500 - 100
  })

  it('returns SESSION_NOT_FOUND for missing session in DB fallback', async () => {
    mockRedis.get.mockResolvedValue(null)

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    const result = await checkSessionBudget('missing', 100)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('SESSION_NOT_FOUND')
  })

  it('returns SESSION_INACTIVE for completed session', async () => {
    mockRedis.get.mockResolvedValue(null)

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            budgetCents: 5000,
            spentCents: 5000,
            reservedCents: 0,
            status: 'completed',
            expiresAt: null,
          }]),
        }),
      }),
    })

    const result = await checkSessionBudget('sess-done', 100)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('SESSION_INACTIVE')
  })

  it('returns SESSION_EXPIRED for expired session', async () => {
    mockRedis.get.mockResolvedValue(null)

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            budgetCents: 5000,
            spentCents: 0,
            reservedCents: 0,
            status: 'active',
            expiresAt: new Date(Date.now() - 60000), // expired 1 min ago
          }]),
        }),
      }),
    })

    const result = await checkSessionBudget('sess-expired', 100)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('SESSION_EXPIRED')
  })

  it('handles zero cost check', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('budget')) return Promise.resolve('1000')
      if (key.includes('spent')) return Promise.resolve('0')
      if (key.includes('reserved')) return Promise.resolve('0')
      return Promise.resolve(null)
    })

    const result = await checkSessionBudget('sess-1', 0)
    expect(result.allowed).toBe(true)
    expect(result.availableCents).toBe(1000)
  })

  it('handles exact budget match', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('budget')) return Promise.resolve('100')
      if (key.includes('spent')) return Promise.resolve('0')
      if (key.includes('reserved')) return Promise.resolve('0')
      return Promise.resolve(null)
    })

    const result = await checkSessionBudget('sess-1', 100)
    expect(result.allowed).toBe(true)
    expect(result.availableCents).toBe(0)
  })

  it('rejects when cost exceeds budget by 1 cent', async () => {
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('budget')) return Promise.resolve('100')
      if (key.includes('spent')) return Promise.resolve('0')
      if (key.includes('reserved')) return Promise.resolve('0')
      return Promise.resolve(null)
    })

    const result = await checkSessionBudget('sess-1', 101)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('SESSION_BUDGET_EXCEEDED')
  })
})
