import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const { mockRegisterAgent, mockListAgentsByProvider, mockGenerateAgentFactsProfile, mockCheckRateLimit } = vi.hoisted(() => ({
  mockRegisterAgent: vi.fn(),
  mockListAgentsByProvider: vi.fn(),
  mockGenerateAgentFactsProfile: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
}))

vi.mock('@/lib/settlement/identity', () => ({
  registerAgent: mockRegisterAgent,
  listAgentsByProvider: mockListAgentsByProvider,
  generateAgentFactsProfile: mockGenerateAgentFactsProfile,
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/middleware/cors', () => ({
  withCors: (handler: Function) => handler,
  OPTIONS: vi.fn(),
  addCorsHeaders: (res: unknown) => res,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  agentIdentities: {
    id: 'id',
    providerId: 'provider_id',
    fingerprint: 'fingerprint',
    status: 'status',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
}))

import { POST, GET } from '@/app/api/agents/route'
import { GET as getAgentFacts } from '@/app/api/agents/[id]/facts/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
  url: string,
  method: string = 'GET',
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(`http://localhost:3005${url}`, init)
}

const mockAgent = {
  id: 'agent-001',
  providerId: 'provider-1',
  agentName: 'TestAgent',
  identityType: 'api-key',
  publicKey: null,
  fingerprint: 'abc123',
  verificationLevel: 'none',
  capabilities: null,
  spendingLimitCents: null,
  status: 'active',
  lastSeenAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
}

// ─── POST /api/agents Tests ──────────────────────────────────────────────────

describe('POST /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('creates an agent with valid data', async () => {
    mockRegisterAgent.mockResolvedValue(mockAgent)

    const request = makeRequest('/api/agents', 'POST', {
      agentName: 'TestAgent',
      identityType: 'api-key',
    }, { 'x-provider-id': 'provider-1' })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.agentName).toBe('TestAgent')
    expect(mockRegisterAgent).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'provider-1',
      agentName: 'TestAgent',
      identityType: 'api-key',
    }))
  })

  it('returns 401 without provider ID', async () => {
    const request = makeRequest('/api/agents', 'POST', {
      agentName: 'TestAgent',
      identityType: 'api-key',
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 409 on duplicate fingerprint', async () => {
    mockRegisterAgent.mockRejectedValue(new Error('Agent identity already registered with fingerprint: abc'))

    const request = makeRequest('/api/agents', 'POST', {
      agentName: 'TestAgent',
      identityType: 'api-key',
    }, { 'x-provider-id': 'provider-1' })

    const response = await POST(request)
    expect(response.status).toBe(409)
  })

  it('validates body with Zod', async () => {
    const request = makeRequest('/api/agents', 'POST', {
      // Missing agentName
      identityType: 'invalid-type',
    }, { 'x-provider-id': 'provider-1' })

    const response = await POST(request)
    expect(response.status).toBe(422)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 60 })

    const request = makeRequest('/api/agents', 'POST', {
      agentName: 'TestAgent',
      identityType: 'api-key',
    }, { 'x-provider-id': 'provider-1' })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  it('passes capabilities through to registerAgent', async () => {
    mockRegisterAgent.mockResolvedValue(mockAgent)
    const capabilities = {
      tools: ['tool-a'],
      methods: ['m1'],
      pricing: { model: 'per-invocation' },
      protocols: ['mcp'],
    }

    const request = makeRequest('/api/agents', 'POST', {
      agentName: 'TestAgent',
      identityType: 'api-key',
      capabilities,
    }, { 'x-provider-id': 'provider-1' })

    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockRegisterAgent).toHaveBeenCalledWith(expect.objectContaining({
      capabilities,
    }))
  })
})

// ─── GET /api/agents Tests ───────────────────────────────────────────────────

describe('GET /api/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns agent list for a provider', async () => {
    mockListAgentsByProvider.mockResolvedValue([mockAgent])

    const request = makeRequest('/api/agents', 'GET', undefined, {
      'x-provider-id': 'provider-1',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.agents).toHaveLength(1)
    expect(data.agents[0].agentName).toBe('TestAgent')
  })

  it('returns 401 without provider ID', async () => {
    const request = makeRequest('/api/agents')

    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it('returns empty array for provider with no agents', async () => {
    mockListAgentsByProvider.mockResolvedValue([])

    const request = makeRequest('/api/agents', 'GET', undefined, {
      'x-provider-id': 'provider-new',
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.agents).toEqual([])
  })
})

// ─── GET /api/agents/[id]/facts Tests ────────────────────────────────────────

describe('GET /api/agents/[id]/facts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns AgentFacts profile', async () => {
    const profile = {
      coreIdentity: { id: 'fp-123', name: 'TestAgent', version: '1.0.0', provider: 'prov', ttl: 3600 },
      capabilities: { tools: [], methods: [], pricing: { model: 'per-invocation' }, protocols: ['mcp'] },
      authPermissions: { authTypes: ['api-key'], rateLimits: {}, spendingLimits: {} },
      verification: { level: 'none', trustScore: 10 },
    }
    mockGenerateAgentFactsProfile.mockResolvedValue(profile)

    const request = makeRequest('/api/agents/agent-001/facts')
    const response = await getAgentFacts(request, {
      params: Promise.resolve({ id: 'agent-001' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.coreIdentity.name).toBe('TestAgent')
    expect(data.verification.trustScore).toBe(10)
  })

  it('returns 404 for unknown agent', async () => {
    mockGenerateAgentFactsProfile.mockResolvedValue(null)

    const request = makeRequest('/api/agents/unknown/facts')
    const response = await getAgentFacts(request, {
      params: Promise.resolve({ id: 'unknown' }),
    })

    expect(response.status).toBe(404)
  })

  it('includes all 4 AgentFacts categories', async () => {
    const profile = {
      coreIdentity: { id: 'fp-123', name: 'Agent', version: '1.0.0', provider: 'prov', ttl: 3600 },
      capabilities: { tools: ['t1'], methods: ['m1'], pricing: {}, protocols: ['mcp'] },
      authPermissions: { authTypes: ['api-key'], rateLimits: { requestsPerMinute: 60 }, spendingLimits: {} },
      verification: { level: 'basic', trustScore: 25 },
    }
    mockGenerateAgentFactsProfile.mockResolvedValue(profile)

    const request = makeRequest('/api/agents/agent-001/facts')
    const response = await getAgentFacts(request, {
      params: Promise.resolve({ id: 'agent-001' }),
    })
    const data = await response.json()

    expect(data.coreIdentity).toBeDefined()
    expect(data.capabilities).toBeDefined()
    expect(data.authPermissions).toBeDefined()
    expect(data.verification).toBeDefined()
  })
})
