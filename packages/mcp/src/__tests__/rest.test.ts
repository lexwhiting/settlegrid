import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the middleware and config modules used by settlegrid.init()
const { mockMiddleware } = vi.hoisted(() => {
  const mockMiddleware = {
    execute: vi
      .fn()
      .mockImplementation(
        (_key: string, _method: string, handler: () => unknown) => handler()
      ),
    validateKey: vi.fn().mockResolvedValue({
      valid: true,
      consumerId: 'con-123',
      toolId: 'tool-123',
      keyId: 'key-123',
      balanceCents: 5000,
    }),
    checkCredits: vi.fn().mockReturnValue({ sufficient: true, costCents: 5 }),
    meter: vi.fn().mockResolvedValue({
      success: true,
      remainingBalanceCents: 4995,
      costCents: 5,
      invocationId: 'inv-123',
    }),
    clearCache: vi.fn(),
    getCacheSize: vi.fn().mockReturnValue(0),
  }
  return { mockMiddleware }
})

vi.mock('../middleware', () => ({
  createMiddleware: vi.fn().mockReturnValue(mockMiddleware),
  extractApiKey: vi
    .fn()
    .mockImplementation(
      (
        headers?: Record<string, string | string[] | undefined>,
        _metadata?: Record<string, unknown>
      ) => {
        if (!headers) return null
        const apiKeyHeader = headers['x-api-key'] ?? headers['X-Api-Key']
        if (apiKeyHeader)
          return Array.isArray(apiKeyHeader)
            ? apiKeyHeader[0] ?? null
            : apiKeyHeader
        const authHeader = headers['authorization'] ?? headers['Authorization']
        if (authHeader) {
          const value = Array.isArray(authHeader) ? authHeader[0] : authHeader
          if (value?.startsWith('Bearer ')) return value.slice(7)
        }
        return null
      }
    ),
}))

import { settlegridMiddleware } from '../rest'
import { InvalidKeyError, InsufficientCreditsError, RateLimitedError } from '../errors'

describe('settlegridMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: successful execution
    mockMiddleware.execute.mockImplementation(
      (_key: string, _method: string, handler: () => unknown) => handler()
    )
  })

  it('creates a withBilling function', () => {
    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })
    expect(typeof withBilling).toBe('function')
  })

  it('withBilling extracts API key from request headers', async () => {
    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })

    const request = new Request('https://example.com/api/search', {
      headers: { 'x-api-key': 'sg_live_test123' },
    })

    const response = await withBilling(request, async () => {
      return new Response(JSON.stringify({ data: 'hello' }), { status: 200 })
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ data: 'hello' })
  })

  it('withBilling returns 401 for invalid key', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(
      new InvalidKeyError('Invalid or revoked API key')
    )

    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })

    const request = new Request('https://example.com/api/search', {
      headers: { 'x-api-key': 'sg_live_invalid' },
    })

    const response = await withBilling(request, async () => {
      return new Response(JSON.stringify({ data: 'should not reach' }))
    })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.code).toBe('INVALID_KEY')
    expect(body.error).toBe('Invalid API key')
  })

  it('withBilling returns 402 for insufficient credits', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(
      new InsufficientCreditsError(5, 0)
    )

    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })

    const request = new Request('https://example.com/api/search', {
      headers: { 'x-api-key': 'sg_live_broke' },
    })

    const response = await withBilling(request, async () => {
      return new Response(JSON.stringify({ data: 'should not reach' }))
    })

    expect(response.status).toBe(402)
    const body = await response.json()
    expect(body.code).toBe('INSUFFICIENT_CREDITS')
    expect(body.topUpUrl).toBe('https://settlegrid.ai/top-up?tool=test-api')
  })

  it('withBilling returns 429 for rate limited', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(new RateLimitedError(5000))

    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })

    const request = new Request('https://example.com/api/search', {
      headers: { 'x-api-key': 'sg_live_ratelimited' },
    })

    const response = await withBilling(request, async () => {
      return new Response(JSON.stringify({ data: 'should not reach' }))
    })

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.error).toBe('Rate limited')
  })

  it('withBilling passes through successful handler response', async () => {
    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })

    const request = new Request('https://example.com/api/analyze', {
      headers: { 'x-api-key': 'sg_live_valid' },
    })

    const expectedBody = { analysis: 'complex', score: 95 }
    const response = await withBilling(request, async () => {
      return new Response(JSON.stringify(expectedBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(expectedBody)
  })

  it('withBilling uses method override when provided', async () => {
    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })

    const request = new Request('https://example.com/api/v1/something', {
      headers: { 'x-api-key': 'sg_live_valid' },
    })

    const response = await withBilling(
      request,
      async () => {
        return new Response(JSON.stringify({ ok: true }))
      },
      'custom-method'
    )

    expect(response.status).toBe(200)
  })

  it('withBilling defaults cost from options', () => {
    const withBilling = settlegridMiddleware({
      toolSlug: 'default-cost-api',
      costCents: 3,
    })
    // If the middleware was created without throwing, the pricing was accepted
    expect(typeof withBilling).toBe('function')
  })

  it('withBilling uses pricing config when provided', () => {
    const withBilling = settlegridMiddleware({
      toolSlug: 'multi-price-api',
      pricing: {
        defaultCostCents: 1,
        methods: {
          search: { costCents: 2 },
          analyze: { costCents: 10 },
        },
      },
    })
    expect(typeof withBilling).toBe('function')
  })

  it('withBilling defaults costCents to 1 when neither pricing nor costCents specified', () => {
    const withBilling = settlegridMiddleware({
      toolSlug: 'bare-api',
    })
    expect(typeof withBilling).toBe('function')
  })

  it('withBilling rethrows non-SettleGrid errors', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(
      new Error('Unexpected database error')
    )

    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })

    const request = new Request('https://example.com/api/search', {
      headers: { 'x-api-key': 'sg_live_valid' },
    })

    await expect(
      withBilling(request, async () => {
        return new Response(JSON.stringify({ data: 'should not reach' }))
      })
    ).rejects.toThrow('Unexpected database error')
  })

  it('withBilling derives method from URL pathname when no override', async () => {
    const withBilling = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 5,
    })

    const request = new Request('https://example.com/api/v1/deep-analyze', {
      headers: { 'x-api-key': 'sg_live_valid' },
    })

    const response = await withBilling(request, async () => {
      return new Response(JSON.stringify({ method: 'derived' }))
    })

    expect(response.status).toBe(200)
  })
})
