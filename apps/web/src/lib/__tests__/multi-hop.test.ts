import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── In-memory store ────────────────────────────────────────────────────────

interface MockSession {
  id: string
  customerId: string
  parentSessionId: string | null
  budgetCents: number
  spentCents: number
  reservedCents: number
  status: string
  settlementMode: string
  protocol: string | null
  hops: unknown[]
  atomicSettlementId: string | null
  metadata: unknown
  expiresAt: Date | null
  completedAt: Date | null
  finalizedAt: Date | null
  settledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface MockBatch {
  id: string
  sessionId: string
  totalAmountCents: number
  platformFeeCents: number
  status: string
  disbursements: unknown[]
  rollbackReason: string | null
  processedAt: Date | null
  createdAt: Date
}

interface MockDeveloper {
  id: string
  balanceCents: number
  revenueSharePct: number
  updatedAt: Date
}

interface MockTool {
  id: string
  developerId: string
}

let sessions: MockSession[] = []
let batches: MockBatch[] = []
let mockDevelopers: MockDeveloper[] = []
let mockTools: MockTool[] = []

function resetStores() {
  sessions = []
  batches = []
  mockDevelopers = []
  mockTools = []
}

// ─── Mock Redis ─────────────────────────────────────────────────────────────

const redisStore: Record<string, number> = {}

const mockRedis = {
  get: vi.fn(async (key: string) => redisStore[key] ?? null),
  set: vi.fn(async (key: string, value: number | string) => {
    redisStore[key] = typeof value === 'string' ? parseInt(value, 10) : value
    return 'OK'
  }),
  del: vi.fn(async (key: string) => {
    delete redisStore[key]
    return 1
  }),
  incrby: vi.fn(async (key: string, amount: number) => {
    redisStore[key] = (redisStore[key] ?? 0) + amount
    return redisStore[key]
  }),
  decrby: vi.fn(async (key: string, amount: number) => {
    redisStore[key] = (redisStore[key] ?? 0) - amount
    return redisStore[key]
  }),
}

function resetRedis() {
  Object.keys(redisStore).forEach(k => delete redisStore[k])
}

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
  tryRedis: vi.fn(async (fn: () => Promise<unknown>) => {
    try { return await fn() } catch { return null }
  }),
}))

// ─── Mock Logger ────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// ─── Mock DB ────────────────────────────────────────────────────────────────

let idCounter = 0
function nextId(): string {
  idCounter++
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`
}

function createMockDbChain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}

  // select().from(table).where(cond).limit(n) chain
  chain.select = vi.fn(() => chain)
  chain.from = vi.fn((table: { toString?: () => string } | string) => {
    chain._table = table
    return chain
  })
  chain.where = vi.fn((cond: unknown) => {
    chain._cond = cond
    return chain
  })
  chain.limit = vi.fn((n: number) => {
    chain._limit = n
    // Return based on which table we queried
    if (chain._table === 'workflow_sessions' || chain._table?.toString?.()?.includes?.('workflow')) {
      return Promise.resolve(sessions.slice(0, n))
    }
    if (chain._table === 'settlement_batches') {
      return Promise.resolve(batches.slice(0, n))
    }
    return Promise.resolve([])
  })

  // insert().values(data).returning() chain
  chain.insert = vi.fn(() => chain)
  chain.values = vi.fn((data: Record<string, unknown>) => {
    chain._insertData = data
    return chain
  })
  chain.returning = vi.fn((fields?: Record<string, unknown>) => {
    const data = chain._insertData
    if (!data) return Promise.resolve([])

    // Detect which table based on the data shape
    if ('budgetCents' in data && 'customerId' in data) {
      // workflowSessions insert
      const s: MockSession = {
        id: nextId(),
        customerId: data.customerId as string,
        parentSessionId: (data.parentSessionId as string) ?? null,
        budgetCents: data.budgetCents as number,
        spentCents: (data.spentCents as number) ?? 0,
        reservedCents: (data.reservedCents as number) ?? 0,
        status: (data.status as string) ?? 'active',
        settlementMode: (data.settlementMode as string) ?? 'immediate',
        protocol: (data.protocol as string) ?? null,
        hops: (data.hops as unknown[]) ?? [],
        atomicSettlementId: null,
        metadata: data.metadata ?? null,
        expiresAt: data.expiresAt as Date ?? null,
        completedAt: null,
        finalizedAt: null,
        settledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      sessions.push(s)
      if (fields) {
        const result: Record<string, unknown> = {}
        for (const key of Object.keys(fields)) {
          result[key] = (s as unknown as Record<string, unknown>)[key]
        }
        return Promise.resolve([result])
      }
      return Promise.resolve([s])
    }

    if ('sessionId' in data && 'totalAmountCents' in data) {
      // settlementBatches insert
      const b: MockBatch = {
        id: nextId(),
        sessionId: data.sessionId as string,
        totalAmountCents: data.totalAmountCents as number,
        platformFeeCents: data.platformFeeCents as number,
        status: 'pending',
        disbursements: (data.disbursements as unknown[]) ?? [],
        rollbackReason: null,
        processedAt: null,
        createdAt: new Date(),
      }
      batches.push(b)
      if (fields) {
        const result: Record<string, unknown> = {}
        for (const key of Object.keys(fields)) {
          result[key] = (b as unknown as Record<string, unknown>)[key]
        }
        return Promise.resolve([result])
      }
      return Promise.resolve([b])
    }

    return Promise.resolve([{ id: nextId() }])
  })

  // update(table).set(data).where(cond).returning() chain
  chain.update = vi.fn(() => chain)
  chain.set = vi.fn((data: Record<string, unknown>) => {
    chain._updateData = data
    return chain
  })

  return chain
}

// Build a sophisticated DB mock that works with the sessions module
vi.mock('@/lib/db', () => {
  const selectFromFn = (table: string) => {
    return {
      where: (condFn?: unknown) => ({
        limit: (n: number) => {
          if (table === 'sessions') {
            // Filter based on condFn context if available
            return Promise.resolve(sessions.slice(0, n))
          }
          if (table === 'batches') {
            return Promise.resolve(batches.slice(0, n))
          }
          if (table === 'tools') {
            return Promise.resolve(mockTools.slice(0, n))
          }
          if (table === 'developers') {
            return Promise.resolve(mockDevelopers.slice(0, n))
          }
          void condFn
          return Promise.resolve([])
        },
      }),
    }
  }

  return {
    db: {
      select: vi.fn((..._fields: unknown[]) => ({
        from: vi.fn((tableRef: unknown) => {
          // Determine table from tableRef
          void tableRef
          return selectFromFn('sessions')
        }),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((data: Record<string, unknown>) => ({
          returning: vi.fn((fields?: Record<string, unknown>) => {
            if ('budgetCents' in data && 'customerId' in data) {
              const s: MockSession = {
                id: nextId(),
                customerId: data.customerId as string,
                parentSessionId: (data.parentSessionId as string) ?? null,
                budgetCents: data.budgetCents as number,
                spentCents: 0,
                reservedCents: 0,
                status: 'active',
                settlementMode: (data.settlementMode as string) ?? 'immediate',
                protocol: (data.protocol as string) ?? null,
                hops: (data.hops as unknown[]) ?? [],
                atomicSettlementId: null,
                metadata: data.metadata ?? null,
                expiresAt: data.expiresAt as Date ?? null,
                completedAt: null,
                finalizedAt: null,
                settledAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              }
              sessions.push(s)
              if (fields) {
                const result: Record<string, unknown> = {}
                for (const key of Object.keys(fields)) {
                  result[key] = (s as unknown as Record<string, unknown>)[key]
                }
                return Promise.resolve([result])
              }
              return Promise.resolve([s])
            }
            if ('sessionId' in data && 'totalAmountCents' in data) {
              const b: MockBatch = {
                id: nextId(),
                sessionId: data.sessionId as string,
                totalAmountCents: data.totalAmountCents as number,
                platformFeeCents: data.platformFeeCents as number,
                status: 'pending',
                disbursements: (data.disbursements as unknown[]) ?? [],
                rollbackReason: null,
                processedAt: null,
                createdAt: new Date(),
              }
              batches.push(b)
              if (fields) {
                const result: Record<string, unknown> = {}
                for (const key of Object.keys(fields)) {
                  result[key] = (b as unknown as Record<string, unknown>)[key]
                }
                return Promise.resolve([result])
              }
              return Promise.resolve([b])
            }
            return Promise.resolve([{ id: nextId() }])
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    },
  }
})

vi.mock('@/lib/db/schema', () => ({
  workflowSessions: {
    id: 'id',
    customerId: 'customer_id',
    parentSessionId: 'parent_session_id',
    budgetCents: 'budget_cents',
    spentCents: 'spent_cents',
    reservedCents: 'reserved_cents',
    status: 'status',
    settlementMode: 'settlement_mode',
    protocol: 'protocol',
    hops: 'hops',
    atomicSettlementId: 'atomic_settlement_id',
    metadata: 'metadata',
    expiresAt: 'expires_at',
    completedAt: 'completed_at',
    finalizedAt: 'finalized_at',
    settledAt: 'settled_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  settlementBatches: {
    id: 'id',
    sessionId: 'session_id',
    totalAmountCents: 'total_amount_cents',
    platformFeeCents: 'platform_fee_cents',
    status: 'status',
    disbursements: 'disbursements',
    rollbackReason: 'rollback_reason',
    processedAt: 'processed_at',
    createdAt: 'created_at',
  },
  tools: {
    id: 'id',
    developerId: 'developer_id',
  },
  developers: {
    id: 'id',
    balanceCents: 'balance_cents',
    revenueSharePct: 'revenue_share_pct',
    updatedAt: 'updated_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  lt: vi.fn((...args: unknown[]) => args),
  relations: vi.fn(() => ({})),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      return { strings, values, __isSql: true }
    }),
    {
      join: vi.fn((...args: unknown[]) => args),
    }
  ),
}))

vi.mock('drizzle-orm/pg-core', () => ({
  pgTable: vi.fn((name: string, columns: Record<string, unknown>) => {
    // Return a proxy that has all column names as properties
    const table = { __tableName: name }
    for (const key of Object.keys(columns)) {
      (table as Record<string, unknown>)[key] = key
    }
    return table
  }),
  uuid: vi.fn((name: string) => ({
    primaryKey: () => ({ defaultRandom: () => name }),
    notNull: () => ({ references: () => ({ onDelete: () => name }) }),
    references: () => ({ onDelete: () => name }),
  })),
  text: vi.fn((name: string) => ({
    notNull: () => ({ default: () => name, unique: () => name }),
    unique: () => name,
  })),
  varchar: vi.fn((name: string) => ({
    notNull: () => ({ default: () => name }),
  })),
  integer: vi.fn((name: string) => ({
    notNull: () => ({ default: () => name }),
  })),
  boolean: vi.fn((name: string) => ({
    notNull: () => ({ default: () => name }),
  })),
  timestamp: vi.fn((name: string) => ({
    notNull: () => ({ defaultNow: () => name }),
  })),
  jsonb: vi.fn((name: string) => ({
    notNull: () => ({ default: () => name }),
    default: () => name,
  })),
  smallint: vi.fn((name: string) => ({
    notNull: () => name,
  })),
  uniqueIndex: vi.fn(() => ({ on: () => ({}) })),
  index: vi.fn(() => ({ on: () => ({}) })),
}))

// ─── Import modules under test (after mocks) ───────────────────────────────

// We use dynamic imports to ensure mocks are in place
async function getModules() {
  const mod = await import('../settlement/sessions')
  return mod
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Multi-Hop Settlement (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStores()
    resetRedis()
    idCounter = 0
  })

  // ─── Session Types ──────────────────────────────────────────────────────

  describe('Session Types', () => {
    it('SettlementMode accepts valid values', () => {
      // Compile-time type check: these assignments must work
      const modes: Array<import('../settlement/session-types').SettlementMode> =
        ['immediate', 'deferred', 'atomic']
      expect(modes).toHaveLength(3)
      expect(modes).toContain('immediate')
      expect(modes).toContain('deferred')
      expect(modes).toContain('atomic')
    })

    it('BatchStatus accepts valid values', () => {
      const statuses: Array<import('../settlement/session-types').BatchStatus> =
        ['pending', 'processing', 'completed', 'failed', 'rolled_back']
      expect(statuses).toHaveLength(5)
      expect(statuses).toContain('rolled_back')
    })

    it('SessionHop interface has required fields', () => {
      const hop: import('../settlement/session-types').SessionHop = {
        hopId: 'h1',
        serviceId: 's1',
        toolId: 't1',
        method: 'invoke',
        costCents: 50,
        timestamp: new Date().toISOString(),
        status: 'success',
        latencyMs: 120,
        metadata: null,
      }
      expect(hop.hopId).toBe('h1')
      expect(hop.costCents).toBe(50)
      expect(hop.status).toBe('success')
    })

    it('SessionDisbursement interface has required fields', () => {
      const d: import('../settlement/session-types').SessionDisbursement = {
        developerId: 'd1',
        toolId: 't1',
        amountCents: 85,
        platformFeeCents: 15,
        stripeTransferId: null,
        status: 'pending',
      }
      expect(d.amountCents).toBe(85)
      expect(d.platformFeeCents).toBe(15)
    })

    it('RecordHopInput allows optional fields', () => {
      const input: import('../settlement/session-types').RecordHopInput = {
        serviceId: 's1',
        toolId: 't1',
        method: 'run',
        costCents: 100,
      }
      expect(input.latencyMs).toBeUndefined()
      expect(input.metadata).toBeUndefined()
    })
  })

  // ─── createSession ─────────────────────────────────────────────────────

  describe('createSession', () => {
    it('creates a session with correct defaults', async () => {
      const { createSession } = await getModules()
      const result = await createSession({
        customerId: 'cust-1',
        budgetCents: 10000,
      })
      expect(result.id).toBeDefined()
      expect(result.customerId).toBe('cust-1')
      expect(result.budgetCents).toBe(10000)
      expect(result.spentCents).toBe(0)
      expect(result.reservedCents).toBe(0)
      expect(result.availableCents).toBe(10000)
      expect(result.status).toBe('active')
    })

    it('throws for zero budget', async () => {
      const { createSession } = await getModules()
      await expect(createSession({
        customerId: 'cust-1',
        budgetCents: 0,
      })).rejects.toThrow('Session budget must be positive')
    })

    it('throws for negative budget', async () => {
      const { createSession } = await getModules()
      await expect(createSession({
        customerId: 'cust-1',
        budgetCents: -100,
      })).rejects.toThrow('Session budget must be positive')
    })

    it('hydrates Redis with session budget keys', async () => {
      const { createSession } = await getModules()
      const result = await createSession({
        customerId: 'cust-1',
        budgetCents: 5000,
      })
      expect(redisStore[`session:budget:${result.id}`]).toBe(5000)
      expect(redisStore[`session:spent:${result.id}`]).toBe(0)
      expect(redisStore[`session:reserved:${result.id}`]).toBe(0)
    })

    it('returns correct expiresAt', async () => {
      const { createSession } = await getModules()
      const before = Date.now()
      const result = await createSession({
        customerId: 'cust-1',
        budgetCents: 1000,
        expiresIn: 7200,
      })
      expect(result.expiresAt).toBeDefined()
      const expiresTime = new Date(result.expiresAt!).getTime()
      expect(expiresTime).toBeGreaterThanOrEqual(before + 7200 * 1000 - 1000)
      expect(expiresTime).toBeLessThanOrEqual(before + 7200 * 1000 + 1000)
    })

    it('stores session with empty hops array', async () => {
      const { createSession } = await getModules()
      await createSession({
        customerId: 'cust-1',
        budgetCents: 1000,
      })
      expect(sessions.length).toBe(1)
      expect(sessions[0].hops).toEqual([])
    })
  })

  // ─── recordHop ────────────────────────────────────────────────────────

  describe('recordHop', () => {
    it('records a hop and returns hopId', async () => {
      const { recordHop } = await getModules()

      // Seed Redis with session budget
      redisStore['session:budget:sess-1'] = 10000
      redisStore['session:spent:sess-1'] = 0
      redisStore['session:reserved:sess-1'] = 0

      const result = await recordHop('sess-1', {
        serviceId: 'weather-api',
        toolId: 'tool-1',
        method: 'getForecast',
        costCents: 500,
        latencyMs: 120,
      })

      expect(result.hopId).toBeDefined()
      expect(typeof result.hopId).toBe('string')
    })

    it('increments spentCents in Redis', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:sess-2'] = 10000
      redisStore['session:spent:sess-2'] = 0
      redisStore['session:reserved:sess-2'] = 0

      await recordHop('sess-2', {
        serviceId: 'nlp-api',
        toolId: 'tool-2',
        method: 'analyze',
        costCents: 300,
      })

      expect(redisStore['session:spent:sess-2']).toBe(300)
    })

    it('returns remaining budget after hop', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:sess-3'] = 5000
      redisStore['session:spent:sess-3'] = 0
      redisStore['session:reserved:sess-3'] = 0

      const result = await recordHop('sess-3', {
        serviceId: 'search-api',
        toolId: 'tool-3',
        method: 'search',
        costCents: 200,
      })

      expect(result.remainingBudgetCents).toBe(4800)
    })

    it('throws on insufficient budget', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:sess-4'] = 100
      redisStore['session:spent:sess-4'] = 0
      redisStore['session:reserved:sess-4'] = 0

      await expect(recordHop('sess-4', {
        serviceId: 'expensive-api',
        toolId: 'tool-4',
        method: 'process',
        costCents: 500,
      })).rejects.toThrow('Insufficient session budget')
    })

    it('rolls back Redis spent on budget exceeded', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:sess-5'] = 100
      redisStore['session:spent:sess-5'] = 50
      redisStore['session:reserved:sess-5'] = 0

      try {
        await recordHop('sess-5', {
          serviceId: 'api',
          toolId: 'tool-5',
          method: 'run',
          costCents: 200,
        })
      } catch {
        // Expected to throw
      }

      // Redis decrby should have been called to roll back
      expect(mockRedis.decrby).toHaveBeenCalledWith('session:spent:sess-5', 200)
    })

    it('tracks multiple hops incrementally', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:sess-6'] = 10000
      redisStore['session:spent:sess-6'] = 0
      redisStore['session:reserved:sess-6'] = 0

      await recordHop('sess-6', {
        serviceId: 'api-a',
        toolId: 'tool-a',
        method: 'step1',
        costCents: 100,
      })

      await recordHop('sess-6', {
        serviceId: 'api-b',
        toolId: 'tool-b',
        method: 'step2',
        costCents: 200,
      })

      await recordHop('sess-6', {
        serviceId: 'api-c',
        toolId: 'tool-c',
        method: 'step3',
        costCents: 300,
      })

      expect(redisStore['session:spent:sess-6']).toBe(600)
    })

    it('respects reserved budget when calculating available', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:sess-7'] = 1000
      redisStore['session:spent:sess-7'] = 0
      redisStore['session:reserved:sess-7'] = 800

      await expect(recordHop('sess-7', {
        serviceId: 'api',
        toolId: 'tool-7',
        method: 'run',
        costCents: 300,
      })).rejects.toThrow('Insufficient session budget')
    })

    it('allows zero-cost hops', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:sess-8'] = 1000
      redisStore['session:spent:sess-8'] = 0
      redisStore['session:reserved:sess-8'] = 0

      const result = await recordHop('sess-8', {
        serviceId: 'free-api',
        toolId: 'tool-8',
        method: 'ping',
        costCents: 0,
      })

      expect(result.hopId).toBeDefined()
      expect(result.remainingBudgetCents).toBe(1000)
    })

    it('includes optional metadata in hop', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:sess-9'] = 5000
      redisStore['session:spent:sess-9'] = 0
      redisStore['session:reserved:sess-9'] = 0

      const result = await recordHop('sess-9', {
        serviceId: 'data-api',
        toolId: 'tool-9',
        method: 'fetch',
        costCents: 100,
        latencyMs: 45,
        metadata: { region: 'us-east-1', model: 'gpt-4' },
      })

      expect(result.hopId).toBeDefined()
    })
  })

  // ─── finalizeSession ──────────────────────────────────────────────────

  describe('finalizeSession', () => {
    it('throws when session not found', async () => {
      const { finalizeSession } = await getModules()
      // DB mock returns empty by default for update().returning()
      await expect(finalizeSession('nonexistent'))
        .rejects.toThrow('Session not found')
    })

    it('throws when session already finalized', async () => {
      const { finalizeSession } = await getModules()
      // The update with status='active' condition returns empty
      // Then select finds the session with wrong status
      sessions.push({
        id: 'sess-fin-1',
        customerId: 'cust-1',
        parentSessionId: null,
        budgetCents: 1000,
        spentCents: 500,
        reservedCents: 0,
        status: 'settled',
        settlementMode: 'deferred',
        protocol: null,
        hops: [],
        atomicSettlementId: null,
        metadata: null,
        expiresAt: null,
        completedAt: null,
        finalizedAt: null,
        settledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // The mock update will return empty (no rows matched the active condition)
      // Then select finds the session and reports its status
      await expect(finalizeSession('sess-fin-1'))
        .rejects.toThrow()
    })
  })

  // ─── processSettlementBatch ───────────────────────────────────────────

  describe('processSettlementBatch', () => {
    it('throws when batch not found', async () => {
      const { processSettlementBatch } = await getModules()
      await expect(processSettlementBatch('nonexistent'))
        .rejects.toThrow('Settlement batch not found or not in pending status')
    })
  })

  // ─── rollbackSettlementBatch ──────────────────────────────────────────

  describe('rollbackSettlementBatch', () => {
    it('throws when batch not found', async () => {
      const { rollbackSettlementBatch } = await getModules()
      await expect(rollbackSettlementBatch('nonexistent', 'test failure'))
        .rejects.toThrow('Settlement batch not found')
    })
  })

  // ─── expireStaleSessionsBatch ─────────────────────────────────────────

  describe('expireStaleSessionsBatch', () => {
    it('returns 0 when no stale sessions exist', async () => {
      const { expireStaleSessionsBatch } = await getModules()
      // DB select returns empty by default
      const count = await expireStaleSessionsBatch()
      expect(count).toBe(0)
    })
  })

  // ─── Settlement Batch Schema ──────────────────────────────────────────

  describe('settlementBatches table', () => {
    it('is exported from schema', async () => {
      const schema = await import('../db/schema')
      expect(schema.settlementBatches).toBeDefined()
    })

    it('has required columns', async () => {
      const schema = await import('../db/schema')
      const table = schema.settlementBatches
      // Check the table object has the expected column definitions
      expect(table).toHaveProperty('id')
      expect(table).toHaveProperty('sessionId')
      expect(table).toHaveProperty('totalAmountCents')
      expect(table).toHaveProperty('platformFeeCents')
      expect(table).toHaveProperty('status')
      expect(table).toHaveProperty('disbursements')
      expect(table).toHaveProperty('rollbackReason')
      expect(table).toHaveProperty('processedAt')
      expect(table).toHaveProperty('createdAt')
    })
  })

  // ─── WorkflowSessions Schema Extensions ───────────────────────────────

  describe('workflowSessions schema extensions', () => {
    it('has settlementMode column', async () => {
      const schema = await import('../db/schema')
      expect(schema.workflowSessions).toHaveProperty('settlementMode')
    })

    it('has hops column', async () => {
      const schema = await import('../db/schema')
      expect(schema.workflowSessions).toHaveProperty('hops')
    })

    it('has atomicSettlementId column', async () => {
      const schema = await import('../db/schema')
      expect(schema.workflowSessions).toHaveProperty('atomicSettlementId')
    })

    it('has finalizedAt column', async () => {
      const schema = await import('../db/schema')
      expect(schema.workflowSessions).toHaveProperty('finalizedAt')
    })

    it('has settledAt column', async () => {
      const schema = await import('../db/schema')
      expect(schema.workflowSessions).toHaveProperty('settledAt')
    })

    it('has updatedAt column', async () => {
      const schema = await import('../db/schema')
      expect(schema.workflowSessions).toHaveProperty('updatedAt')
    })
  })

  // ─── Exports ──────────────────────────────────────────────────────────

  describe('settlement/index exports', () => {
    it('exports recordHop', async () => {
      const mod = await import('../settlement/index')
      expect(mod.recordHop).toBeDefined()
      expect(typeof mod.recordHop).toBe('function')
    })

    it('exports finalizeSession', async () => {
      const mod = await import('../settlement/index')
      expect(mod.finalizeSession).toBeDefined()
      expect(typeof mod.finalizeSession).toBe('function')
    })

    it('exports processSettlementBatch', async () => {
      const mod = await import('../settlement/index')
      expect(mod.processSettlementBatch).toBeDefined()
      expect(typeof mod.processSettlementBatch).toBe('function')
    })

    it('exports rollbackSettlementBatch', async () => {
      const mod = await import('../settlement/index')
      expect(mod.rollbackSettlementBatch).toBeDefined()
      expect(typeof mod.rollbackSettlementBatch).toBe('function')
    })

    it('exports expireStaleSessionsBatch', async () => {
      const mod = await import('../settlement/index')
      expect(mod.expireStaleSessionsBatch).toBeDefined()
      expect(typeof mod.expireStaleSessionsBatch).toBe('function')
    })

    it('exports getSettlementBatch', async () => {
      const mod = await import('../settlement/index')
      expect(mod.getSettlementBatch).toBeDefined()
      expect(typeof mod.getSettlementBatch).toBe('function')
    })
  })

  // ─── Session Lifecycle ────────────────────────────────────────────────

  describe('session lifecycle: create -> hop -> hop -> finalize', () => {
    it('creates session then records hops reducing budget', async () => {
      const { createSession, recordHop } = await getModules()

      const session = await createSession({
        customerId: 'cust-lifecycle',
        budgetCents: 10000,
      })

      expect(session.availableCents).toBe(10000)

      // Record first hop
      const hop1 = await recordHop(session.id, {
        serviceId: 'api-1',
        toolId: 'tool-1',
        method: 'step1',
        costCents: 2000,
      })
      expect(hop1.remainingBudgetCents).toBe(8000)

      // Record second hop
      const hop2 = await recordHop(session.id, {
        serviceId: 'api-2',
        toolId: 'tool-2',
        method: 'step2',
        costCents: 3000,
      })
      expect(hop2.remainingBudgetCents).toBe(5000)

      // Verify Redis state
      expect(redisStore[`session:budget:${session.id}`]).toBe(10000)
      expect(redisStore[`session:spent:${session.id}`]).toBe(5000)
    })

    it('prevents hop that would exceed remaining budget', async () => {
      const { createSession, recordHop } = await getModules()

      const session = await createSession({
        customerId: 'cust-exceed',
        budgetCents: 500,
      })

      // First hop uses most of the budget
      await recordHop(session.id, {
        serviceId: 'api-1',
        toolId: 'tool-1',
        method: 'step1',
        costCents: 400,
      })

      // Second hop exceeds remaining
      await expect(recordHop(session.id, {
        serviceId: 'api-2',
        toolId: 'tool-2',
        method: 'step2',
        costCents: 200,
      })).rejects.toThrow('Insufficient session budget')
    })
  })

  // ─── Budget Accounting ────────────────────────────────────────────────

  describe('budget accounting', () => {
    it('tracks cumulative spend across multiple hops', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:multi-hop'] = 10000
      redisStore['session:spent:multi-hop'] = 0
      redisStore['session:reserved:multi-hop'] = 0

      const costs = [100, 200, 300, 400, 500]
      let totalSpent = 0

      for (const cost of costs) {
        totalSpent += cost
        const result = await recordHop('multi-hop', {
          serviceId: `api-${cost}`,
          toolId: `tool-${cost}`,
          method: 'run',
          costCents: cost,
        })
        expect(result.remainingBudgetCents).toBe(10000 - totalSpent)
      }

      expect(redisStore['session:spent:multi-hop']).toBe(1500)
    })

    it('correctly calculates available with reserved budget', async () => {
      const { recordHop } = await getModules()

      redisStore['session:budget:reserved-test'] = 10000
      redisStore['session:spent:reserved-test'] = 2000
      redisStore['session:reserved:reserved-test'] = 5000

      // Available = 10000 - 2000 - 5000 = 3000
      const result = await recordHop('reserved-test', {
        serviceId: 'api',
        toolId: 'tool',
        method: 'run',
        costCents: 1000,
      })

      // After hop: available = 10000 - 3000 - 5000 = 2000
      expect(result.remainingBudgetCents).toBe(2000)
    })
  })
})
