import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  webhookEndpoints: {},
  webhookDeliveries: {},
  developers: {},
}))

import { computeNextRetryAt, isWebhookUrlSafe, attemptWebhookDelivery } from '@/lib/webhooks'
import { logger } from '@/lib/logger'

const originalFetch = global.fetch

describe('computeNextRetryAt', () => {
  it('computes exponential backoff for attempt 1', () => {
    const before = Date.now()
    const result = computeNextRetryAt(1)
    const expectedDelay = Math.pow(2, 1) * 60 * 1000 // 120_000 ms
    expect(result.getTime()).toBeGreaterThanOrEqual(before + expectedDelay - 50)
    expect(result.getTime()).toBeLessThanOrEqual(before + expectedDelay + 1000)
  })

  it('computes exponential backoff for attempt 3', () => {
    const before = Date.now()
    const result = computeNextRetryAt(3)
    const expectedDelay = Math.pow(2, 3) * 60 * 1000 // 480_000 ms
    expect(result.getTime()).toBeGreaterThanOrEqual(before + expectedDelay - 50)
    expect(result.getTime()).toBeLessThanOrEqual(before + expectedDelay + 1000)
  })

  it('computes exponential backoff for attempt 0', () => {
    const before = Date.now()
    const result = computeNextRetryAt(0)
    const expectedDelay = Math.pow(2, 0) * 60 * 1000 // 60_000 ms
    expect(result.getTime()).toBeGreaterThanOrEqual(before + expectedDelay - 50)
    expect(result.getTime()).toBeLessThanOrEqual(before + expectedDelay + 1000)
  })

  it('returns a Date object', () => {
    const result = computeNextRetryAt(1)
    expect(result).toBeInstanceOf(Date)
  })
})

describe('isWebhookUrlSafe', () => {
  it('allows valid HTTPS URLs', () => {
    expect(isWebhookUrlSafe('https://example.com/webhook')).toBe(true)
    expect(isWebhookUrlSafe('https://api.myapp.io/hooks/settlegrid')).toBe(true)
  })

  it('blocks HTTP URLs', () => {
    expect(isWebhookUrlSafe('http://example.com/webhook')).toBe(false)
  })

  it('blocks localhost', () => {
    expect(isWebhookUrlSafe('https://localhost/webhook')).toBe(false)
    expect(isWebhookUrlSafe('https://localhost:3000/webhook')).toBe(false)
  })

  it('blocks 127.0.0.1', () => {
    expect(isWebhookUrlSafe('https://127.0.0.1/webhook')).toBe(false)
  })

  it('blocks 0.0.0.0', () => {
    expect(isWebhookUrlSafe('https://0.0.0.0/webhook')).toBe(false)
  })

  it('blocks IPv6 loopback', () => {
    expect(isWebhookUrlSafe('https://[::1]/webhook')).toBe(false)
  })

  it('blocks private 10.x IPs', () => {
    expect(isWebhookUrlSafe('https://10.0.0.1/webhook')).toBe(false)
    expect(isWebhookUrlSafe('https://10.255.255.255/webhook')).toBe(false)
  })

  it('blocks private 172.16-31.x IPs', () => {
    expect(isWebhookUrlSafe('https://172.16.0.1/webhook')).toBe(false)
    expect(isWebhookUrlSafe('https://172.31.255.255/webhook')).toBe(false)
  })

  it('blocks private 192.168.x IPs', () => {
    expect(isWebhookUrlSafe('https://192.168.1.1/webhook')).toBe(false)
  })

  it('blocks link-local 169.254.x IPs', () => {
    expect(isWebhookUrlSafe('https://169.254.169.254/latest/meta-data')).toBe(false)
  })

  it('blocks .local domains', () => {
    expect(isWebhookUrlSafe('https://myservice.local/webhook')).toBe(false)
  })

  it('blocks .internal domains', () => {
    expect(isWebhookUrlSafe('https://api.internal/webhook')).toBe(false)
  })

  it('blocks .corp domains', () => {
    expect(isWebhookUrlSafe('https://intranet.corp/webhook')).toBe(false)
  })

  it('returns false for invalid URLs', () => {
    expect(isWebhookUrlSafe('not-a-url')).toBe(false)
    expect(isWebhookUrlSafe('')).toBe(false)
  })

  it('allows public cloud IPs', () => {
    expect(isWebhookUrlSafe('https://54.210.167.28/webhook')).toBe(true)
  })
})

describe('attemptWebhookDelivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('delivers successfully to a valid HTTPS URL', async () => {
    const result = await attemptWebhookDelivery(
      'https://example.com/webhook',
      'test-secret',
      'test.event',
      { foo: 'bar' }
    )
    expect(result.status).toBe('delivered')
    expect(result.httpStatus).toBe(200)
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('includes HMAC signature header', async () => {
    await attemptWebhookDelivery(
      'https://example.com/webhook',
      'test-secret',
      'test.event',
      { data: 'value' }
    )
    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(opts.headers['X-SettleGrid-Signature']).toBeDefined()
    expect(opts.headers['X-SettleGrid-Signature']).toMatch(/^[a-f0-9]{64}$/)
    expect(opts.headers['X-SettleGrid-Event']).toBe('test.event')
  })

  it('blocks SSRF attempts to localhost', async () => {
    const result = await attemptWebhookDelivery(
      'https://localhost/webhook',
      'secret',
      'test.event',
      {}
    )
    expect(result.status).toBe('failed')
    expect(result.httpStatus).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'webhook.ssrf_blocked',
      expect.objectContaining({ url: 'https://localhost/webhook' })
    )
  })

  it('blocks SSRF attempts to private IPs', async () => {
    const result = await attemptWebhookDelivery(
      'https://192.168.1.1/webhook',
      'secret',
      'test.event',
      {}
    )
    expect(result.status).toBe('failed')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('blocks SSRF attempts to metadata endpoint', async () => {
    const result = await attemptWebhookDelivery(
      'https://169.254.169.254/latest/meta-data',
      'secret',
      'test.event',
      {}
    )
    expect(result.status).toBe('failed')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles non-OK response as failed', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 })

    const result = await attemptWebhookDelivery(
      'https://example.com/webhook',
      'secret',
      'test.event',
      {}
    )
    expect(result.status).toBe('failed')
    expect(result.httpStatus).toBe(500)
  })

  it('handles network error as failed', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'))

    const result = await attemptWebhookDelivery(
      'https://example.com/webhook',
      'secret',
      'test.event',
      {}
    )
    expect(result.status).toBe('failed')
    expect(result.httpStatus).toBeNull()
  })
})
