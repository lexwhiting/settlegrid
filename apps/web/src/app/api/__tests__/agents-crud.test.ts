import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const { mockRevokeAgent, mockUpdateAgent, mockCheckRateLimit } = vi.hoisted(() => ({
  mockRevokeAgent: vi.fn(),
  mockUpdateAgent: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
}))

vi.mock('@/lib/settlement/identity', () => ({
  revokeAgent: mockRevokeAgent,
  updateAgent: mockUpdateAgent,
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/middleware/cors', () => ({
  OPTIONS: vi.fn(),
  addCorsHeaders: (res: unknown) => res,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/db', () => ({
  db: { select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) },
}))

vi.mock('@/lib/db/schema', () => ({
  agentIdentities: { id: 'id', providerId: 'provider_id', fingerprint: 'fingerprint', status: 'status' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
}))

import { DELETE, PATCH } from '@/app/api/agents/[id]/route'

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

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const mockAgent = {
  id: VALID_UUID,
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

// ─── DELETE /api/agents/[id] Tests ──────────────────────────────────────────

describe('DELETE /api/agents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('revokes an agent successfully', async () => {
    mockRevokeAgent.mockResolvedValue(true)

    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'DELETE', undefined, {
      'x-provider-id': 'provider-1',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: VALID_UUID }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.revoked).toBe(true)
    expect(mockRevokeAgent).toHaveBeenCalledWith(VALID_UUID, 'provider-1')
  })

  it('returns 401 without provider ID', async () => {
    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'DELETE')

    const response = await DELETE(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(401)
  })

  it('returns 404 when agent not found', async () => {
    mockRevokeAgent.mockResolvedValue(false)

    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'DELETE', undefined, {
      'x-provider-id': 'provider-1',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(404)
  })

  it('returns 400 for invalid UUID', async () => {
    const request = makeRequest('/api/agents/bad-id', 'DELETE', undefined, {
      'x-provider-id': 'provider-1',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: 'bad-id' }) })
    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 60 })

    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'DELETE', undefined, {
      'x-provider-id': 'provider-1',
    })

    const response = await DELETE(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(429)
  })
})

// ─── PATCH /api/agents/[id] Tests ───────────────────────────────────────────

describe('PATCH /api/agents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('updates an agent successfully', async () => {
    mockUpdateAgent.mockResolvedValue({ ...mockAgent, agentName: 'UpdatedAgent' })

    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'PATCH', {
      agentName: 'UpdatedAgent',
    }, { 'x-provider-id': 'provider-1' })

    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.agentName).toBe('UpdatedAgent')
  })

  it('updates capabilities', async () => {
    const caps = {
      tools: ['tool-1'],
      methods: ['m1'],
      pricing: { model: 'flat' },
      protocols: ['mcp'],
    }
    mockUpdateAgent.mockResolvedValue({ ...mockAgent, capabilities: caps })

    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'PATCH', {
      capabilities: caps,
    }, { 'x-provider-id': 'provider-1' })

    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(200)
    expect(mockUpdateAgent).toHaveBeenCalledWith(
      VALID_UUID,
      'provider-1',
      expect.objectContaining({ capabilities: caps })
    )
  })

  it('updates spending limit', async () => {
    mockUpdateAgent.mockResolvedValue({ ...mockAgent, spendingLimitCents: 5000 })

    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'PATCH', {
      spendingLimitCents: 5000,
    }, { 'x-provider-id': 'provider-1' })

    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(200)
  })

  it('returns 401 without provider ID', async () => {
    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'PATCH', {
      agentName: 'Updated',
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(401)
  })

  it('returns 404 when agent not found', async () => {
    mockUpdateAgent.mockResolvedValue(null)

    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'PATCH', {
      agentName: 'Updated',
    }, { 'x-provider-id': 'provider-1' })

    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(404)
  })

  it('validates body with Zod', async () => {
    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'PATCH', {
      spendingLimitCents: -100, // invalid: must be >= 0
    }, { 'x-provider-id': 'provider-1' })

    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(422)
  })

  it('returns 400 for invalid UUID', async () => {
    const request = makeRequest('/api/agents/bad-id', 'PATCH', {
      agentName: 'Updated',
    }, { 'x-provider-id': 'provider-1' })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'bad-id' }) })
    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 60 })

    const request = makeRequest(`/api/agents/${VALID_UUID}`, 'PATCH', {
      agentName: 'Updated',
    }, { 'x-provider-id': 'provider-1' })

    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) })
    expect(response.status).toBe(429)
  })
})
