import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const mockSendEmail = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email')>()
  return {
    ...actual,
    sendEmail: (...args: Parameters<typeof mockSendEmail>) => mockSendEmail(...args),
  }
})

import { sendAlertEmail } from '@/lib/alert-email'
import { logger } from '@/lib/logger'

describe('Alert email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendEmail.mockResolvedValue(true)
  })

  it('sends low_balance email via lowBalanceAlertEmail template', async () => {
    await sendAlertEmail('user@example.com', 'Test Tool', 'low_balance', 500)

    expect(mockSendEmail).toHaveBeenCalledOnce()
    const call = mockSendEmail.mock.calls[0][0]
    expect(call.to).toBe('user@example.com')
    expect(call.subject).toContain('Low balance alert')
    expect(call.subject).toContain('Test Tool')
    expect(call.html).toContain('Test Tool')
    expect(call.from).toBe('SettleGrid <alerts@settlegrid.ai>')
  })

  it('uses shared base template', async () => {
    await sendAlertEmail('user@example.com', 'Tool', 'low_balance', 100)

    const call = mockSendEmail.mock.calls[0][0]
    // baseEmailTemplate produces dark mode support
    expect(call.html).toContain('prefers-color-scheme: dark')
    // baseEmailTemplate includes enhanced footer
    expect(call.html).toContain('https://settlegrid.ai/docs')
    expect(call.html).toContain('support@settlegrid.ai')
  })

  it('handles budget_exceeded alert type', async () => {
    await sendAlertEmail('user@example.com', 'My API', 'budget_exceeded', 1000)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.subject).toContain('Budget Exceeded')
    expect(call.html).toContain('spending budget')
  })

  it('handles usage_spike alert type', async () => {
    await sendAlertEmail('user@example.com', 'My API', 'usage_spike', 50)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.subject).toContain('Usage Spike')
    expect(call.html).toContain('usage spike')
  })

  it('handles unknown alert type gracefully', async () => {
    await sendAlertEmail('user@example.com', 'Tool', 'custom_alert', 100)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.subject).toContain('custom_alert')
  })

  it('escapes HTML in tool name to prevent XSS', async () => {
    await sendAlertEmail('user@example.com', '<script>alert(1)</script>', 'low_balance', 100)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).not.toContain('<script>')
    expect(call.html).toContain('&lt;script&gt;')
  })

  it('logs success after sending', async () => {
    await sendAlertEmail('user@example.com', 'Tool', 'low_balance', 100)

    expect(logger.info).toHaveBeenCalledWith('alert.email_sent', expect.objectContaining({
      email: 'user@example.com',
      alertType: 'low_balance',
      toolName: 'Tool',
    }))
  })

  it('logs error when sendEmail throws', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('network error'))

    await sendAlertEmail('user@example.com', 'Tool', 'low_balance', 100)

    expect(logger.error).toHaveBeenCalledWith(
      'alert.email_failed',
      expect.objectContaining({ email: 'user@example.com' }),
      expect.any(Error)
    )
  })

  it('sanitizes CRLF in toolName to prevent email header injection', async () => {
    await sendAlertEmail('user@example.com', 'Tool\r\nBcc: evil@hack.com', 'low_balance', 100)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.subject).not.toContain('\r')
    expect(call.subject).not.toContain('\n')
    expect(call.subject).toContain('Tool')
  })

  it('sanitizes CRLF in alertType to prevent email header injection', async () => {
    await sendAlertEmail('user@example.com', 'Tool', 'custom\r\nBcc: evil@hack.com', 100)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.subject).not.toContain('\r')
    expect(call.subject).not.toContain('\n')
  })

  it('includes preheader text for low_balance via lowBalanceAlertEmail', async () => {
    await sendAlertEmail('user@example.com', 'MyTool', 'low_balance', 500)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).toContain('MyTool')
    expect(call.html).toContain('low')
  })

  it('includes preheader text for non-low_balance alert types', async () => {
    await sendAlertEmail('user@example.com', 'MyTool', 'budget_exceeded', 500)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).toContain('Alert:')
    expect(call.html).toContain('Budget Exceeded')
    expect(call.html).toContain('MyTool')
  })

  it('includes bulletproof CTA button', async () => {
    await sendAlertEmail('user@example.com', 'Tool', 'low_balance', 100)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).toContain('Add Credits')
    expect(call.html).toContain('https://settlegrid.ai/consumer')
    expect(call.html).toContain('v:roundrect')
  })

  it('includes auto-refill tip for low_balance', async () => {
    await sendAlertEmail('user@example.com', 'Tool', 'low_balance', 100)

    const call = mockSendEmail.mock.calls[0][0]
    expect(call.html).toContain('auto-refill')
  })
})
