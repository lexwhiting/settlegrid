/**
 * Edge case tests for the REST middleware.
 * Covers: missing headers, malformed keys, network timeouts,
 * SettleGrid unavailable errors, input validation, and Retry-After headers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMiddleware } = vi.hoisted(() => {
  const mockMiddleware = {
    execute: vi.fn().mockImplementation(
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
  extractApiKey: vi.fn().mockImplementation(
    (headers?: Record<string, string | string[] | undefined>) => {
      if (!headers) return null
      const apiKeyHeader = headers['x-api-key'] ?? headers['X-Api-Key']
      if (apiKeyHeader)
        return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] ?? null : apiKeyHeader
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
import {
  InvalidKeyError,
  InsufficientCreditsError,
  RateLimitedError,
  TimeoutError,
  NetworkError,
  SettleGridUnavailableError,
  ToolNotFoundError,
  ToolDisabledError,
} from '../errors'

describe('settlegridMiddleware input validation', () => {
  it('throws when toolSlug is empty', () => {
    expect(() => settlegridMiddleware({ toolSlug: '' }))
      .toThrow('toolSlug')
  })

  it('throws when toolSlug is whitespace', () => {
    expect(() => settlegridMiddleware({ toolSlug: '   ' }))
      .toThrow('toolSlug')
  })

  it('error message includes settlegrid.ai URL', () => {
    expect(() => settlegridMiddleware({ toolSlug: '' }))
      .toThrow('settlegrid.ai')
  })

  it('succeeds with valid toolSlug', () => {
    const mw = settlegridMiddleware({ toolSlug: 'valid-tool' })
    expect(typeof mw).toBe('function')
  })
})

describe('settlegridMiddleware error responses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMiddleware.execute.mockImplementation(
      (_key: string, _method: string, handler: () => unknown) => handler()
    )
  })

  it('returns 503 for TimeoutError', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(new TimeoutError(5000))

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test', {
      headers: { 'x-api-key': 'sg_live_test' },
    })

    const response = await withBilling(request, async () => {
      return new Response('should not reach')
    })

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('TIMEOUT')
    expect(body.error).toContain('temporarily unavailable')
  })

  it('returns 503 for NetworkError', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(new NetworkError())

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test', {
      headers: { 'x-api-key': 'sg_live_test' },
    })

    const response = await withBilling(request, async () => {
      return new Response('should not reach')
    })

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('NETWORK_ERROR')
  })

  it('returns 503 for SettleGridUnavailableError', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(new SettleGridUnavailableError())

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test', {
      headers: { 'x-api-key': 'sg_live_test' },
    })

    const response = await withBilling(request, async () => {
      return new Response('should not reach')
    })

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe('SERVER_ERROR')
  })

  it('returns 429 with Retry-After header for RateLimitedError', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(new RateLimitedError(10000))

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test', {
      headers: { 'x-api-key': 'sg_live_test' },
    })

    const response = await withBilling(request, async () => {
      return new Response('should not reach')
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('10')
    const body = await response.json()
    expect(body.retryAfterMs).toBe(10000)
  })

  it('returns 404 for ToolNotFoundError', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(new ToolNotFoundError('missing-tool'))

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test', {
      headers: { 'x-api-key': 'sg_live_test' },
    })

    const response = await withBilling(request, async () => {
      return new Response('should not reach')
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe('TOOL_NOT_FOUND')
  })

  it('returns 403 for ToolDisabledError', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(new ToolDisabledError('disabled-tool'))

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test', {
      headers: { 'x-api-key': 'sg_live_test' },
    })

    const response = await withBilling(request, async () => {
      return new Response('should not reach')
    })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('TOOL_DISABLED')
  })

  it('rethrows non-SettleGrid errors unchanged', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(new TypeError('unexpected'))

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test', {
      headers: { 'x-api-key': 'sg_live_test' },
    })

    await expect(
      withBilling(request, async () => new Response('should not reach'))
    ).rejects.toThrow('unexpected')
  })

  it('returns 401 when no x-api-key header is present', async () => {
    mockMiddleware.execute.mockRejectedValueOnce(
      new InvalidKeyError('No API key provided')
    )

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test')

    const response = await withBilling(request, async () => {
      return new Response('should not reach')
    })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.code).toBe('INVALID_KEY')
  })

  it('all error responses have Content-Type application/json', async () => {
    const errors = [
      new InvalidKeyError(),
      new InsufficientCreditsError(5, 0),
      new RateLimitedError(1000),
      new TimeoutError(5000),
      new NetworkError(),
      new SettleGridUnavailableError(),
      new ToolNotFoundError('x'),
      new ToolDisabledError('x'),
    ]

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })

    for (const error of errors) {
      mockMiddleware.execute.mockRejectedValueOnce(error)
      const request = new Request('https://example.com/api/test', {
        headers: { 'x-api-key': 'sg_live_test' },
      })
      const response = await withBilling(request, async () => new Response('nope'))
      expect(response.headers.get('Content-Type')).toBe('application/json')
    }
  })
})

describe('settlegridMiddleware request handling', () => {
  it('passes through successful response with valid key', async () => {
    vi.clearAllMocks()
    mockMiddleware.execute.mockReset()
    mockMiddleware.execute.mockImplementation(
      (_key: string, _method: string, handler: () => unknown) => handler()
    )

    const withBilling = settlegridMiddleware({ toolSlug: 'test-api', costCents: 5 })
    const request = new Request('https://example.com/api/test', {
      headers: { 'x-api-key': 'sg_live_valid' },
    })

    const response = await withBilling(request, async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
  })

  it('handles request with custom options passed through', () => {
    const mw = settlegridMiddleware({
      toolSlug: 'test-api',
      costCents: 10,
      debug: true,
      cacheTtlMs: 1000,
      timeoutMs: 15000,
      apiUrl: 'https://custom.settlegrid.ai',
    })
    expect(typeof mw).toBe('function')
  })
})
