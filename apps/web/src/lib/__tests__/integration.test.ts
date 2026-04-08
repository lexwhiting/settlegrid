import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Integration/scenario tests that verify end-to-end flows using mock data.
 * Tests the full developer registration -> tool creation -> consumer purchase
 * -> invocation -> payout lifecycle.
 */

// ─── Mock data store ─────────────────────────────────────────────────────────
interface MockDeveloper {
  id: string
  email: string
  name: string
  passwordHash: string
  stripeConnectId: string | null
  stripeConnectStatus: string
  balanceCents: number
  payoutMinimumCents: number
}

interface MockTool {
  id: string
  developerId: string
  name: string
  slug: string
  description: string
  pricingConfig: { model: string; perCallCents: number }
  status: string
  totalInvocations: number
  totalRevenueCents: number
}

interface MockConsumer {
  id: string
  email: string
  passwordHash: string
  stripeCustomerId: string | null
}

interface MockBalance {
  consumerId: string
  toolId: string
  balanceCents: number
}

interface MockInvocation {
  id: string
  toolId: string
  consumerId: string
  method: string
  costCents: number
  status: string
}

interface MockPayout {
  id: string
  developerId: string
  amountCents: number
  status: string
}

interface MockApiKey {
  id: string
  consumerId: string
  toolId: string
  keyHash: string
  status: string
}

let mockDevelopers: MockDeveloper[]
let mockTools: MockTool[]
let mockConsumers: MockConsumer[]
let mockBalances: MockBalance[]
let mockInvocations: MockInvocation[]
let mockPayouts: MockPayout[]
let mockApiKeys: MockApiKey[]

beforeEach(() => {
  mockDevelopers = []
  mockTools = []
  mockConsumers = []
  mockBalances = []
  mockInvocations = []
  mockPayouts = []
  mockApiKeys = []
})

// ─── Mock helper functions ────────────────────────────────────────────────────

function registerDeveloper(email: string, name: string): MockDeveloper {
  const dev: MockDeveloper = {
    id: `dev-${mockDevelopers.length + 1}`,
    email,
    name,
    passwordHash: '$2a$12$mocked',
    stripeConnectId: null,
    stripeConnectStatus: 'not_started',
    balanceCents: 0,
    payoutMinimumCents: 100,
  }
  mockDevelopers.push(dev)
  return dev
}

function registerConsumer(email: string): MockConsumer {
  const con: MockConsumer = {
    id: `con-${mockConsumers.length + 1}`,
    email,
    passwordHash: '$2a$12$mocked',
    stripeCustomerId: null,
  }
  mockConsumers.push(con)
  return con
}

function createTool(developerId: string, name: string, slug: string, perCallCents: number): MockTool {
  const tool: MockTool = {
    id: `tool-${mockTools.length + 1}`,
    developerId,
    name,
    slug,
    description: `${name} description`,
    pricingConfig: { model: 'per_call', perCallCents },
    status: 'draft',
    totalInvocations: 0,
    totalRevenueCents: 0,
  }
  mockTools.push(tool)
  return tool
}

function activateTool(tool: MockTool): void {
  tool.status = 'active'
}

function connectStripe(dev: MockDeveloper): void {
  dev.stripeConnectId = `acct_${dev.id}`
  dev.stripeConnectStatus = 'active'
}

function purchaseCredits(consumer: MockConsumer, tool: MockTool, amountCents: number): void {
  const existing = mockBalances.find(b => b.consumerId === consumer.id && b.toolId === tool.id)
  if (existing) {
    existing.balanceCents += amountCents
  } else {
    mockBalances.push({ consumerId: consumer.id, toolId: tool.id, balanceCents: amountCents })
  }
}

function createApiKey(consumer: MockConsumer, tool: MockTool): MockApiKey {
  const key: MockApiKey = {
    id: `key-${mockApiKeys.length + 1}`,
    consumerId: consumer.id,
    toolId: tool.id,
    keyHash: `hash_${mockApiKeys.length + 1}`,
    status: 'active',
  }
  mockApiKeys.push(key)
  return key
}

function invokeToolCall(consumer: MockConsumer, tool: MockTool, method: string, costCents: number): { success: boolean; error?: string } {
  if (tool.status !== 'active') return { success: false, error: 'Tool not active' }

  const balance = mockBalances.find(b => b.consumerId === consumer.id && b.toolId === tool.id)
  if (!balance || balance.balanceCents < costCents) {
    return { success: false, error: 'Insufficient credits' }
  }

  const key = mockApiKeys.find(k => k.consumerId === consumer.id && k.toolId === tool.id && k.status === 'active')
  if (!key) return { success: false, error: 'No active API key' }

  // Deduct credits
  balance.balanceCents -= costCents

  // Progressive take rate: developer receives full costCents at invocation time.
  // Take rate calculated at payout time. See lib/pricing.ts
  const devShare = costCents
  const dev = mockDevelopers.find(d => d.id === tool.developerId)
  if (dev) dev.balanceCents += devShare

  // Record invocation
  tool.totalInvocations += 1
  tool.totalRevenueCents += costCents

  mockInvocations.push({
    id: `inv-${mockInvocations.length + 1}`,
    toolId: tool.id,
    consumerId: consumer.id,
    method,
    costCents,
    status: 'success',
  })

  return { success: true }
}

function triggerPayout(dev: MockDeveloper): { success: boolean; error?: string; payout?: MockPayout } {
  if (dev.stripeConnectStatus !== 'active') return { success: false, error: 'Stripe not active' }
  if (!dev.stripeConnectId) return { success: false, error: 'No Stripe account' }
  if (dev.balanceCents < dev.payoutMinimumCents) return { success: false, error: 'Below minimum' }

  const payout: MockPayout = {
    id: `payout-${mockPayouts.length + 1}`,
    developerId: dev.id,
    amountCents: dev.balanceCents,
    status: 'completed',
  }
  mockPayouts.push(payout)
  dev.balanceCents = 0

  return { success: true, payout }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Developer Registration Flow', () => {
  it('registers a developer with correct defaults', () => {
    const dev = registerDeveloper('alice@example.com', 'Alice')
    expect(dev.email).toBe('alice@example.com')
    expect(dev.stripeConnectStatus).toBe('not_started')
    expect(dev.balanceCents).toBe(0)
  })

  it('assigns unique IDs to multiple developers', () => {
    const dev1 = registerDeveloper('dev1@example.com', 'Dev 1')
    const dev2 = registerDeveloper('dev2@example.com', 'Dev 2')
    expect(dev1.id).not.toBe(dev2.id)
  })

  it('stores developer in registry', () => {
    registerDeveloper('stored@example.com', 'Stored')
    expect(mockDevelopers).toHaveLength(1)
    expect(mockDevelopers[0].email).toBe('stored@example.com')
  })
})

describe('Tool Creation Flow', () => {
  it('creates a tool in draft status', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'My Tool', 'my-tool', 5)

    expect(tool.name).toBe('My Tool')
    expect(tool.status).toBe('draft')
    expect(tool.developerId).toBe(dev.id)
  })

  it('activates a tool', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    activateTool(tool)
    expect(tool.status).toBe('active')
  })

  it('starts with zero invocations and revenue', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 3)
    expect(tool.totalInvocations).toBe(0)
    expect(tool.totalRevenueCents).toBe(0)
  })
})

describe('Consumer Registration and Credit Purchase', () => {
  it('registers a consumer', () => {
    const consumer = registerConsumer('buyer@example.com')
    expect(consumer.email).toBe('buyer@example.com')
    expect(consumer.stripeCustomerId).toBeNull()
  })

  it('adds credits for a tool', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    const consumer = registerConsumer('buyer@example.com')

    purchaseCredits(consumer, tool, 2000)

    const balance = mockBalances.find(b => b.consumerId === consumer.id && b.toolId === tool.id)
    expect(balance).toBeDefined()
    expect(balance!.balanceCents).toBe(2000)
  })

  it('stacks credits on repeat purchases', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    const consumer = registerConsumer('buyer@example.com')

    purchaseCredits(consumer, tool, 1000)
    purchaseCredits(consumer, tool, 1500)

    const balance = mockBalances.find(b => b.consumerId === consumer.id && b.toolId === tool.id)
    expect(balance!.balanceCents).toBe(2500)
  })
})

describe('API Key Management', () => {
  it('creates an API key for a consumer-tool pair', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    const consumer = registerConsumer('buyer@example.com')
    const key = createApiKey(consumer, tool)

    expect(key.consumerId).toBe(consumer.id)
    expect(key.toolId).toBe(tool.id)
    expect(key.status).toBe('active')
  })

  it('generates unique key IDs', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    const consumer = registerConsumer('buyer@example.com')
    const key1 = createApiKey(consumer, tool)
    const key2 = createApiKey(consumer, tool)
    expect(key1.id).not.toBe(key2.id)
  })
})

describe('Tool Invocation Flow', () => {
  it('deducts credits on successful invocation', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    activateTool(tool)
    const consumer = registerConsumer('buyer@example.com')
    purchaseCredits(consumer, tool, 1000)
    createApiKey(consumer, tool)

    const result = invokeToolCall(consumer, tool, 'classify', 5)
    expect(result.success).toBe(true)

    const balance = mockBalances.find(b => b.consumerId === consumer.id && b.toolId === tool.id)
    expect(balance!.balanceCents).toBe(995)
  })

  it('credits developer with full amount (take rate at payout)', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 10)
    activateTool(tool)
    const consumer = registerConsumer('buyer@example.com')
    purchaseCredits(consumer, tool, 1000)
    createApiKey(consumer, tool)

    invokeToolCall(consumer, tool, 'analyze', 10)

    expect(dev.balanceCents).toBe(10) // full amount; progressive take rate applied at payout
  })

  it('fails with insufficient credits', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    activateTool(tool)
    const consumer = registerConsumer('buyer@example.com')
    purchaseCredits(consumer, tool, 3)
    createApiKey(consumer, tool)

    const result = invokeToolCall(consumer, tool, 'classify', 5)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Insufficient credits')
  })

  it('fails for inactive tool', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    // Tool stays in draft
    const consumer = registerConsumer('buyer@example.com')
    purchaseCredits(consumer, tool, 1000)
    createApiKey(consumer, tool)

    const result = invokeToolCall(consumer, tool, 'classify', 5)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Tool not active')
  })

  it('fails without API key', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    activateTool(tool)
    const consumer = registerConsumer('buyer@example.com')
    purchaseCredits(consumer, tool, 1000)
    // No API key created

    const result = invokeToolCall(consumer, tool, 'classify', 5)
    expect(result.success).toBe(false)
    expect(result.error).toBe('No active API key')
  })

  it('increments tool invocation counters', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 5)
    activateTool(tool)
    const consumer = registerConsumer('buyer@example.com')
    purchaseCredits(consumer, tool, 1000)
    createApiKey(consumer, tool)

    invokeToolCall(consumer, tool, 'a', 5)
    invokeToolCall(consumer, tool, 'b', 5)
    invokeToolCall(consumer, tool, 'c', 5)

    expect(tool.totalInvocations).toBe(3)
    expect(tool.totalRevenueCents).toBe(15)
  })

  it('records invocation in log', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Tool', 'tool', 3)
    activateTool(tool)
    const consumer = registerConsumer('buyer@example.com')
    purchaseCredits(consumer, tool, 100)
    createApiKey(consumer, tool)

    invokeToolCall(consumer, tool, 'classify', 3)

    expect(mockInvocations).toHaveLength(1)
    expect(mockInvocations[0].method).toBe('classify')
    expect(mockInvocations[0].costCents).toBe(3)
  })
})

describe('Payout Flow', () => {
  it('creates payout when balance exceeds minimum', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    connectStripe(dev)
    dev.balanceCents = 5000

    const result = triggerPayout(dev)
    expect(result.success).toBe(true)
    expect(result.payout!.amountCents).toBe(5000)
    expect(dev.balanceCents).toBe(0)
  })

  it('fails when Stripe is not connected', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    dev.balanceCents = 5000

    const result = triggerPayout(dev)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Stripe not active')
  })

  it('fails when balance is below minimum', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    connectStripe(dev)
    // Default payoutMinimumCents is 100 ($1). Set below to trigger the
    // minimum-balance check.
    dev.balanceCents = 50

    const result = triggerPayout(dev)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Below minimum')
  })

  it('resets balance to 0 after payout', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    connectStripe(dev)
    dev.balanceCents = 3000

    triggerPayout(dev)
    expect(dev.balanceCents).toBe(0)
  })

  it('records payout in registry', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    connectStripe(dev)
    dev.balanceCents = 4000

    triggerPayout(dev)
    expect(mockPayouts).toHaveLength(1)
    expect(mockPayouts[0].status).toBe('completed')
  })
})

describe('Full Lifecycle Scenario', () => {
  it('developer -> tool -> consumer -> purchase -> invoke -> payout', () => {
    // 1. Developer registers and creates a tool
    const dev = registerDeveloper('alice@startup.com', 'Alice')
    const tool = createTool(dev.id, 'Classifier', 'classifier', 5)
    activateTool(tool)
    connectStripe(dev)

    // 2. Consumer registers and buys credits
    const consumer = registerConsumer('bob@company.com')
    purchaseCredits(consumer, tool, 5000) // $50

    // 3. Consumer creates API key
    createApiKey(consumer, tool)

    // 4. Consumer makes 100 invocations at 5 cents each
    for (let i = 0; i < 100; i++) {
      const result = invokeToolCall(consumer, tool, 'classify', 5)
      expect(result.success).toBe(true)
    }

    // Verify state after invocations
    expect(tool.totalInvocations).toBe(100)
    expect(tool.totalRevenueCents).toBe(500)

    const balance = mockBalances.find(b => b.consumerId === consumer.id && b.toolId === tool.id)
    expect(balance!.balanceCents).toBe(4500) // 5000 - (100 * 5)

    // Developer gets full amount at invocation time (progressive take rate at payout)
    expect(dev.balanceCents).toBe(500) // 100 * 5 cents

    // 5. Balance is 500 cents ($5), above $1 minimum — payout should succeed
    const payout = triggerPayout(dev)
    expect(payout.success).toBe(true)
    expect(payout.payout!.amountCents).toBe(500)
    expect(dev.balanceCents).toBe(0)

    // 6. More invocations to accumulate again
    for (let i = 0; i < 100; i++) {
      invokeToolCall(consumer, tool, 'classify', 5)
    }

    // After payout reset, 100 more invocations at 5c each — dev gets full
    // 500 cents (no take rate at invocation; take rate is applied at payout
    // by the production code, but the mock triggerPayout below pays out the
    // full balance for simplicity).
    expect(dev.balanceCents).toBe(500)

    // 7. Trigger another payout
    const payout2 = triggerPayout(dev)
    expect(payout2.success).toBe(true)
    expect(payout2.payout!.amountCents).toBe(500)
    expect(dev.balanceCents).toBe(0)
  })

  it('multiple consumers using same tool', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'Parser', 'parser', 2)
    activateTool(tool)

    const consumer1 = registerConsumer('user1@example.com')
    const consumer2 = registerConsumer('user2@example.com')

    purchaseCredits(consumer1, tool, 100)
    purchaseCredits(consumer2, tool, 200)

    createApiKey(consumer1, tool)
    createApiKey(consumer2, tool)

    invokeToolCall(consumer1, tool, 'parse', 2)
    invokeToolCall(consumer2, tool, 'parse', 2)
    invokeToolCall(consumer2, tool, 'parse', 2)

    expect(tool.totalInvocations).toBe(3)
    expect(mockInvocations).toHaveLength(3)
  })

  it('developer with multiple tools', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool1 = createTool(dev.id, 'Tool A', 'tool-a', 3)
    const tool2 = createTool(dev.id, 'Tool B', 'tool-b', 7)
    activateTool(tool1)
    activateTool(tool2)

    const consumer = registerConsumer('user@example.com')
    purchaseCredits(consumer, tool1, 500)
    purchaseCredits(consumer, tool2, 500)
    createApiKey(consumer, tool1)
    createApiKey(consumer, tool2)

    invokeToolCall(consumer, tool1, 'do', 3)
    invokeToolCall(consumer, tool2, 'do', 7)

    expect(tool1.totalInvocations).toBe(1)
    expect(tool2.totalInvocations).toBe(1)
    expect(tool1.totalRevenueCents).toBe(3)
    expect(tool2.totalRevenueCents).toBe(7)

    // Developer gets full amount at invocation time (3 + 7 = 10).
    // Take rate is applied at payout time by production code; the mock
    // invokeToolCall above does not apply it (matches the design comment
    // at line 176-177).
    expect(dev.balanceCents).toBe(3 + 7)
  })

  it('zero-cost invocations do not deduct credits', () => {
    const dev = registerDeveloper('dev@example.com', 'Dev')
    const tool = createTool(dev.id, 'FreeTool', 'free-tool', 0)
    activateTool(tool)

    const consumer = registerConsumer('user@example.com')
    purchaseCredits(consumer, tool, 100)
    createApiKey(consumer, tool)

    invokeToolCall(consumer, tool, 'ping', 0)

    const balance = mockBalances.find(b => b.consumerId === consumer.id)
    expect(balance!.balanceCents).toBe(100) // unchanged
  })
})
