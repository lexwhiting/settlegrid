import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted so the mockDb is available when vi.mock factories run (they are hoisted)
const { mockDb, mockCheckRateLimit, mockHashPassword, mockComparePassword, mockCreateToken, mockSetSessionCookie } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
  return {
    mockDb,
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 }),
    mockHashPassword: vi.fn().mockResolvedValue('$2a$12$hashed'),
    mockComparePassword: vi.fn().mockResolvedValue(true),
    mockCreateToken: vi.fn().mockResolvedValue('mock-jwt-token'),
    mockSetSessionCookie: vi.fn().mockImplementation((response: unknown) => response),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    email: 'email',
    name: 'name',
    passwordHash: 'password_hash',
    stripeConnectStatus: 'stripe_connect_status',
    balanceCents: 'balance_cents',
    payoutSchedule: 'payout_schedule',
    payoutMinimumCents: 'payout_minimum_cents',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}))

vi.mock('@/lib/auth', () => ({
  hashPassword: mockHashPassword,
  comparePassword: mockComparePassword,
  createToken: mockCreateToken,
  setSessionCookie: mockSetSessionCookie,
  clearSessionCookie: vi.fn().mockImplementation((response: unknown) => response),
}))

vi.mock('@/lib/rate-limit', () => ({
  authLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
}))

import { POST as registerHandler } from '@/app/api/auth/developer/register/route'
import { POST as loginHandler } from '@/app/api/auth/developer/login/route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3005/api/auth/developer/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Developer Register (POST /api/auth/developer/register)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.returning.mockResolvedValue([
      {
        id: 'dev-new-id',
        email: 'newdev@example.com',
        name: 'New Dev',
        stripeConnectStatus: 'not_started',
        balanceCents: 0,
        payoutSchedule: 'monthly',
        createdAt: new Date('2026-01-01'),
      },
    ])
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
  })

  it('registers a new developer successfully', async () => {
    const request = makeRequest({
      email: 'newdev@example.com',
      name: 'New Dev',
      password: 'securepass123',
    })

    const response = await registerHandler(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.developer).toBeDefined()
    expect(data.developer.email).toBe('newdev@example.com')
    expect(data.token).toBe('mock-jwt-token')
  })

  it('returns 409 for duplicate email', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 'existing-id' }])

    const request = makeRequest({
      email: 'existing@example.com',
      name: 'Dupe Dev',
      password: 'securepass123',
    })

    const response = await registerHandler(request)
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('already exists')
    expect(data.code).toBe('EMAIL_EXISTS')
  })

  it('returns 422 for invalid email format', async () => {
    const request = makeRequest({
      email: 'not-an-email',
      name: 'Bad Dev',
      password: 'securepass123',
    })

    const response = await registerHandler(request)
    expect(response.status).toBe(422)
  })

  it('returns 422 for short password', async () => {
    const request = makeRequest({
      email: 'dev@example.com',
      name: 'Dev',
      password: 'short',
    })

    const response = await registerHandler(request)
    expect(response.status).toBe(422)
  })

  it('returns 422 for missing name field', async () => {
    const request = makeRequest({
      email: 'dev@example.com',
      password: 'securepass123',
    })

    const response = await registerHandler(request)
    expect(response.status).toBe(422)
  })

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 5, remaining: 0, reset: 60000 })

    const request = makeRequest({
      email: 'dev@example.com',
      name: 'Dev',
      password: 'securepass123',
    })

    const response = await registerHandler(request)
    expect(response.status).toBe(429)
  })
})

describe('Developer Login (POST /api/auth/developer/login)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
  })

  it('logs in with valid credentials', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'dev-123',
        email: 'dev@example.com',
        name: 'Test Dev',
        passwordHash: '$2a$12$existing_hash',
        stripeConnectStatus: 'active',
        balanceCents: 5000,
        payoutSchedule: 'monthly',
        createdAt: new Date('2026-01-01'),
      },
    ])

    const request = makeRequest({
      email: 'dev@example.com',
      password: 'correctpassword',
    })

    const response = await loginHandler(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.developer).toBeDefined()
    expect(data.developer.email).toBe('dev@example.com')
    expect(data.token).toBe('mock-jwt-token')
    expect(data.developer.passwordHash).toBeUndefined()
  })

  it('returns 401 for non-existent email', async () => {
    mockDb.limit.mockResolvedValueOnce([])

    const request = makeRequest({
      email: 'nobody@example.com',
      password: 'somepassword1',
    })

    const response = await loginHandler(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('INVALID_CREDENTIALS')
  })

  it('returns 401 for wrong password', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'dev-123',
        email: 'dev@example.com',
        name: 'Test Dev',
        passwordHash: '$2a$12$existing_hash',
        stripeConnectStatus: 'active',
        balanceCents: 5000,
        payoutSchedule: 'monthly',
        createdAt: new Date('2026-01-01'),
      },
    ])
    mockComparePassword.mockResolvedValueOnce(false)

    const request = makeRequest({
      email: 'dev@example.com',
      password: 'wrongpassword1',
    })

    const response = await loginHandler(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.code).toBe('INVALID_CREDENTIALS')
  })

  it('returns 422 for missing password', async () => {
    const request = makeRequest({
      email: 'dev@example.com',
    })

    const response = await loginHandler(request)
    expect(response.status).toBe(422)
  })
})
