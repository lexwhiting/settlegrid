import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const mockGetResendApiKey = vi.fn()
vi.mock('@/lib/env', () => ({
  getResendApiKey: () => mockGetResendApiKey(),
}))

// Mock global fetch
const originalFetch = global.fetch

import { sendAlertEmail } from '@/lib/alert-email'
import { logger } from '@/lib/logger'

describe('Alert email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    mockGetResendApiKey.mockReturnValue('re_test_key')
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('sends email via Resend when API key is configured', async () => {
    await sendAlertEmail('user@example.com', 'Test Tool', 'low_balance', 500)

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Authorization']).toBe('Bearer re_test_key')

    const body = JSON.parse(opts.body)
    expect(body.to).toEqual(['user@example.com'])
    expect(body.subject).toContain('Low Balance')
    expect(body.subject).toContain('Test Tool')
    expect(body.html).toContain('Test Tool')
  })

  it('skips email when Resend API key is not configured', async () => {
    mockGetResendApiKey.mockImplementation(() => { throw new Error('not set') })

    await sendAlertEmail('user@example.com', 'Tool', 'low_balance', 100)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('alert.email_sent', expect.any(Object))
  })

  it('handles budget_exceeded alert type', async () => {
    await sendAlertEmail('user@example.com', 'My API', 'budget_exceeded', 1000)

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.subject).toContain('Budget Exceeded')
    expect(body.html).toContain('spending budget')
  })

  it('handles usage_spike alert type', async () => {
    await sendAlertEmail('user@example.com', 'My API', 'usage_spike', 50)

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.subject).toContain('Usage Spike')
    expect(body.html).toContain('usage spike')
  })

  it('handles unknown alert type gracefully', async () => {
    await sendAlertEmail('user@example.com', 'Tool', 'custom_alert', 100)

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.subject).toContain('custom_alert')
  })

  it('escapes HTML in tool name to prevent XSS', async () => {
    await sendAlertEmail('user@example.com', '<script>alert(1)</script>', 'low_balance', 100)

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.html).not.toContain('<script>')
    expect(body.html).toContain('&lt;script&gt;')
  })

  it('logs error when fetch fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'))

    await sendAlertEmail('user@example.com', 'Tool', 'low_balance', 100)

    expect(logger.error).toHaveBeenCalledWith(
      'alert.email_failed',
      expect.objectContaining({ email: 'user@example.com' }),
      expect.any(Error)
    )
  })
})
