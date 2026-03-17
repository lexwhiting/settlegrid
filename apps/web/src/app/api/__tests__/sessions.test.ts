import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const { mockCreateSession, mockGetSessionState, mockCompleteSession, mockCheckRateLimit, mockDb } = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockGetSessionState: vi.fn(),
  mockCompleteSession: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/settlement/sessions', () => ({
  createSession: mockCreateSession,
  getSessionState: mockGetSessionState,
  completeSession: mockCompleteSession,
}))

vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/middleware/cors', () => ({
  withCors: (handler: (req: NextRequest) => Promise<Response>) => handler,
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
  db: mockDb,
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
    expiresAt: 'expires_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  sql: vi.fn(),
}))

import { POST as createSessionRoute } from '@/app/api/sessions/route'
import { GET as getSessionRoute } from '@/app/api/sessions/[id]/route'
import { POST as delegateRoute } from '@/app/api/sessions/[id]/delegate/route'
import { POST as completeRoute } from '@/app/api/sessions/[id]/complete/route'

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

const mockSession = {
  id: 'sess-001',
  customerId: 'cust-1',
  parentSessionId: null,
  budgetCents: 10000,
  spentCents: 0,
  reservedCents: 0,
  availableCents: 10000,
  status: 'active',
  expiresAt: '2026-03-17T12:00:00.000Z',
  children: [],
}

// ─── POST /api/sessions Tests ────────────────────────────────────────────────

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('creates a session with valid data', async () => {
    mockCreateSession.mockResolvedValue(mockSession)

    const request = makeRequest('/api/sessions', 'POST', {
      customerId: 'cust-1',
      budgetCents: 10000,
    })

    const response = await createSessionRoute(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.id).toBe('sess-001')
    expect(data.budgetCents).toBe(10000)
  })

  it('validates body with Zod (missing customerId)', async () => {
    const request = makeRequest('/api/sessions', 'POST', {
      budgetCents: 10000,
    })

    const response = await createSessionRoute(request)
    expect(response.status).toBe(422)
  })

  it('validates body with Zod (invalid budgetCents)', async () => {
    const request = makeRequest('/api/sessions', 'POST', {
      customerId: 'cust-1',
      budgetCents: -100,
    })

    const response = await createSessionRoute(request)
    expect(response.status).toBe(422)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 60 })

    const request = makeRequest('/api/sessions', 'POST', {
      customerId: 'cust-1',
      budgetCents: 10000,
    })

    const response = await createSessionRoute(request)
    expect(response.status).toBe(429)
  })
})

// ─── GET /api/sessions/[id] Tests ────────────────────────────────────────────

describe('GET /api/sessions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('returns session state', async () => {
    mockGetSessionState.mockResolvedValue(mockSession)

    const request = makeRequest('/api/sessions/sess-001')
    const response = await getSessionRoute(request, {
      params: Promise.resolve({ id: 'sess-001' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe('sess-001')
    expect(data.budgetCents).toBe(10000)
  })

  it('returns 404 for unknown session', async () => {
    mockGetSessionState.mockResolvedValue(null)

    const request = makeRequest('/api/sessions/unknown')
    const response = await getSessionRoute(request, {
      params: Promise.resolve({ id: 'unknown' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 60 })

    const request = makeRequest('/api/sessions/sess-001')
    const response = await getSessionRoute(request, {
      params: Promise.resolve({ id: 'sess-001' }),
    })

    expect(response.status).toBe(429)
  })
})

// ─── POST /api/sessions/[id]/delegate Tests ──────────────────────────────────

describe('POST /api/sessions/[id]/delegate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
  })

  it('delegates budget to child session', async () => {
    mockDb.limit.mockResolvedValue([{ customerId: 'cust-1' }])
    const childSession = { ...mockSession, id: 'sess-002', parentSessionId: 'sess-001', budgetCents: 3000 }
    mockCreateSession.mockResolvedValue(childSession)

    const request = makeRequest('/api/sessions/sess-001/delegate', 'POST', {
      budgetCents: 3000,
    })

    const response = await delegateRoute(request, {
      params: Promise.resolve({ id: 'sess-001' }),
    })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.parentSessionId).toBe('sess-001')
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      budgetCents: 3000,
      parentSessionId: 'sess-001',
    }))
  })

  it('returns 404 when parent session not found', async () => {
    mockDb.limit.mockResolvedValue([])

    const request = makeRequest('/api/sessions/nonexistent/delegate', 'POST', {
      budgetCents: 3000,
    })

    const response = await delegateRoute(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 400 when delegation exceeds parent budget', async () => {
    mockDb.limit.mockResolvedValue([{ customerId: 'cust-1' }])
    mockCreateSession.mockRejectedValue(new Error('Delegation budget (50000) exceeds parent available budget (10000)'))

    const request = makeRequest('/api/sessions/sess-001/delegate', 'POST', {
      budgetCents: 50000,
    })

    const response = await delegateRoute(request, {
      params: Promise.resolve({ id: 'sess-001' }),
    })

    expect(response.status).toBe(400)
  })

  it('validates body with Zod', async () => {
    const request = makeRequest('/api/sessions/sess-001/delegate', 'POST', {
      // Missing budgetCents
    })

    const response = await delegateRoute(request, {
      params: Promise.resolve({ id: 'sess-001' }),
    })

    expect(response.status).toBe(422)
  })

  it('passes agentId in metadata', async () => {
    mockDb.limit.mockResolvedValue([{ customerId: 'cust-1' }])
    const childSession = { ...mockSession, id: 'sess-003' }
    mockCreateSession.mockResolvedValue(childSession)

    const request = makeRequest('/api/sessions/sess-001/delegate', 'POST', {
      budgetCents: 2000,
      agentId: '550e8400-e29b-41d4-a716-446655440000',
    })

    const response = await delegateRoute(request, {
      params: Promise.resolve({ id: 'sess-001' }),
    })

    expect(response.status).toBe(201)
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        agentId: '550e8400-e29b-41d4-a716-446655440000',
        delegatedFrom: 'sess-001',
      }),
    }))
  })
})

// ─── POST /api/sessions/[id]/complete Tests ──────────────────────────────────

describe('POST /api/sessions/[id]/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  })

  it('completes a session', async () => {
    mockCompleteSession.mockResolvedValue(undefined)

    const request = makeRequest('/api/sessions/sess-001/complete', 'POST')
    const response = await completeRoute(request, {
      params: Promise.resolve({ id: 'sess-001' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('completed')
    expect(data.sessionId).toBe('sess-001')
  })

  it('returns 404 when session not found', async () => {
    mockCompleteSession.mockRejectedValue(new Error('Session not found: unknown'))

    const request = makeRequest('/api/sessions/unknown/complete', 'POST')
    const response = await completeRoute(request, {
      params: Promise.resolve({ id: 'unknown' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 60 })

    const request = makeRequest('/api/sessions/sess-001/complete', 'POST')
    const response = await completeRoute(request, {
      params: Promise.resolve({ id: 'sess-001' }),
    })

    expect(response.status).toBe(429)
  })
})
