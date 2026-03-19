import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// Mock env before importing email module
const mockGetResendApiKey = vi.fn()
vi.mock('@/lib/env', () => ({
  getResendApiKey: () => mockGetResendApiKey(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const originalFetch = global.fetch

import {
  welcomeDeveloperEmail,
  welcomeConsumerEmail,
  stripeConnectCompleteEmail,
  payoutNotificationEmail,
  lowBalanceAlertEmail,
  creditPurchaseConfirmationEmail,
  paymentFailedEmail,
  autoRefillConfirmationEmail,
  apiKeyCreatedEmail,
  apiKeyRevokedEmail,
  webhookFailureEmail,
  baseEmailTemplate,
  ctaButton,
  sanitizeSubject,
  escapeHtml,
  sendEmail,
  FROM_TRANSACTIONAL,
} from '@/lib/email'
import { logger } from '@/lib/logger'

// ── Base template ────────────────────────────────────────────────────────────

describe('baseEmailTemplate', () => {
  it('wraps content in a full HTML document', () => {
    const html = baseEmailTemplate('<p>Hello</p>')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<p>Hello</p>')
    expect(html).toContain('</html>')
  })

  it('includes dark mode meta tag', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).toContain('name="color-scheme"')
    expect(html).toContain('content="light dark"')
  })

  it('includes dark mode CSS media query', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain('.sg-body')
    expect(html).toContain('#111827')
  })

  it('includes system font stack', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).toContain('-apple-system')
    expect(html).toContain('BlinkMacSystemFont')
    expect(html).toContain("'Segoe UI'")
    expect(html).toContain("'Outfit'")
  })

  it('includes SettleGrid logo', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).toContain('Settle')
    expect(html).toContain('Grid')
    expect(html).toContain('#1A1F3A')
    expect(html).toContain('#10B981')
  })

  it('includes enhanced footer with links', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).toContain('https://settlegrid.ai')
    expect(html).toContain('https://settlegrid.ai/docs')
    expect(html).toContain('support@settlegrid.ai')
    expect(html).toContain('All rights reserved')
  })

  it('includes copyright year', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).toContain(`${new Date().getFullYear()}`)
  })

  it('includes preheader when provided', () => {
    const html = baseEmailTemplate('<p>test</p>', { preheader: 'Preview text here' })
    expect(html).toContain('Preview text here')
    expect(html).toContain('display:none')
    expect(html).toContain('&#847;')
  })

  it('omits preheader div when not provided', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).not.toContain('&#847;')
  })

  it('escapes HTML in preheader text', () => {
    const html = baseEmailTemplate('<p>test</p>', { preheader: '<script>alert(1)</script>' })
    expect(html).toContain('&lt;script&gt;')
  })

  it('includes Outlook VML support', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).toContain('urn:schemas-microsoft-com:vml')
  })
})

// ── CTA button ───────────────────────────────────────────────────────────────

describe('ctaButton', () => {
  it('creates a table-based button', () => {
    const html = ctaButton('Click Me', 'https://example.com')
    expect(html).toContain('Click Me')
    expect(html).toContain('https://example.com')
    expect(html).toContain('<table')
    expect(html).toContain('#059669') // default color
  })

  it('supports custom colors', () => {
    const html = ctaButton('Retry', 'https://example.com', '#ef4444')
    expect(html).toContain('#ef4444')
  })

  it('includes Outlook VML fallback', () => {
    const html = ctaButton('Test', 'https://example.com')
    expect(html).toContain('v:roundrect')
    expect(html).toContain('[if mso]')
  })

  it('escapes HTML in button text', () => {
    const html = ctaButton('<b>Click</b>', 'https://example.com')
    expect(html).toContain('&lt;b&gt;Click&lt;/b&gt;')
  })

  it('escapes HTML in href', () => {
    const html = ctaButton('Go', 'https://example.com?a=1&b=2')
    expect(html).toContain('https://example.com?a=1&amp;b=2')
  })
})

// ── sendEmail helper ─────────────────────────────────────────────────────────

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    mockGetResendApiKey.mockReturnValue('re_test_key')
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('sends email via Resend API', async () => {
    const result = await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(result).toBe(true)
    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Authorization']).toBe('Bearer re_test_key')

    const body = JSON.parse(opts.body)
    expect(body.from).toBe(FROM_TRANSACTIONAL)
    expect(body.to).toEqual(['user@test.com'])
    expect(body.subject).toBe('Test')
    expect(body.html).toBe('<p>Hello</p>')
  })

  it('supports array of recipients', async () => {
    await sendEmail({
      to: ['a@test.com', 'b@test.com'],
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.to).toEqual(['a@test.com', 'b@test.com'])
  })

  it('uses custom from address when provided', async () => {
    await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      from: 'Custom <custom@settlegrid.ai>',
    })

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.from).toBe('Custom <custom@settlegrid.ai>')
  })

  it('includes replyTo when provided', async () => {
    await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      replyTo: 'reply@test.com',
    })

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.reply_to).toBe('reply@test.com')
  })

  it('returns true and skips when Resend is not configured', async () => {
    mockGetResendApiKey.mockImplementation(() => { throw new Error('not set') })

    const result = await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(result).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith('email.skipped', expect.any(Object))
  })

  it('returns false when Resend API returns error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: () => Promise.resolve('invalid'),
    })

    const result = await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(result).toBe(false)
    expect(logger.error).toHaveBeenCalledWith('email.send_failed', expect.objectContaining({ status: 422 }))
  })

  it('returns false when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'))

    const result = await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(result).toBe(false)
    expect(logger.error).toHaveBeenCalledWith('email.send_error', expect.any(Object), expect.any(Error))
  })
})

// ── FROM_TRANSACTIONAL constant ──────────────────────────────────────────────

describe('FROM_TRANSACTIONAL', () => {
  it('has the correct format', () => {
    expect(FROM_TRANSACTIONAL).toBe('SettleGrid <notifications@settlegrid.ai>')
  })
})

// ── Template tests ───────────────────────────────────────────────────────────

describe('welcomeDeveloperEmail', () => {
  it('generates correct subject line', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.subject).toBe('Welcome to SettleGrid — Start monetizing your tools')
  })

  it('includes developer name in HTML body', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.html).toContain('Alice')
  })

  it('includes base layout structure', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
    expect(result.html).toContain('settlegrid.ai')
    expect(result.html).toContain('All rights reserved')
  })

  it('escapes HTML characters in name', () => {
    const result = welcomeDeveloperEmail('<script>alert("xss")</script>')
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('includes dashboard link', () => {
    const result = welcomeDeveloperEmail('Bob')
    expect(result.html).toContain('https://settlegrid.ai/dashboard')
  })

  it('includes dark mode support', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.html).toContain('prefers-color-scheme: dark')
  })

  it('includes preheader text', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.html).toContain('Get started monetizing')
  })

  it('includes bulletproof CTA button', () => {
    const result = welcomeDeveloperEmail('Alice')
    expect(result.html).toContain('v:roundrect')
    expect(result.html).toContain('Go to Dashboard')
  })
})

describe('welcomeConsumerEmail', () => {
  it('generates correct subject', () => {
    const result = welcomeConsumerEmail('user@test.com')
    expect(result.subject).toBe('Welcome to SettleGrid — Start using AI tools')
  })

  it('includes getting started steps', () => {
    const result = welcomeConsumerEmail('user@test.com')
    expect(result.html).toContain('Browse available tools')
    expect(result.html).toContain('Add credits')
    expect(result.html).toContain('Generate an API key')
  })

  it('includes consumer link', () => {
    const result = welcomeConsumerEmail('user@test.com')
    expect(result.html).toContain('https://settlegrid.ai/consumer')
  })

  it('includes preheader text', () => {
    const result = welcomeConsumerEmail('user@test.com')
    expect(result.html).toContain('Discover and use AI tools')
  })

  it('includes dark mode support', () => {
    const result = welcomeConsumerEmail('user@test.com')
    expect(result.html).toContain('prefers-color-scheme: dark')
  })
})

describe('stripeConnectCompleteEmail', () => {
  it('generates correct subject line', () => {
    const result = stripeConnectCompleteEmail('Dev')
    expect(result.subject).toContain('Stripe Connect')
    expect(result.subject).toContain('active')
  })

  it('includes developer name in body', () => {
    const result = stripeConnectCompleteEmail('Carol')
    expect(result.html).toContain('Carol')
  })

  it('includes base template wrapper', () => {
    const result = stripeConnectCompleteEmail('Dev')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('includes settings link CTA', () => {
    const result = stripeConnectCompleteEmail('Dev')
    expect(result.html).toContain('https://settlegrid.ai/dashboard/developer/settings')
  })

  it('includes preheader', () => {
    const result = stripeConnectCompleteEmail('Dev')
    expect(result.html).toContain('Stripe Connect account is live')
  })
})

describe('payoutNotificationEmail', () => {
  it('generates subject with formatted amount', () => {
    const result = payoutNotificationEmail('Dev', 5000)
    expect(result.subject).toContain('$50.00')
  })

  it('includes formatted amount in body', () => {
    const result = payoutNotificationEmail('Dev', 2500)
    expect(result.html).toContain('$25.00')
  })

  it('includes payouts link', () => {
    const result = payoutNotificationEmail('Dev', 1000)
    expect(result.html).toContain('https://settlegrid.ai/dashboard/payouts')
  })

  it('escapes name in body', () => {
    const result = payoutNotificationEmail('O\'Brien & Co', 1000)
    expect(result.html).toContain('O&#39;Brien &amp; Co')
  })

  it('includes preheader with amount', () => {
    const result = payoutNotificationEmail('Dev', 5000)
    expect(result.html).toContain('$50.00')
    expect(result.html).toContain('on its way')
  })
})

describe('lowBalanceAlertEmail', () => {
  it('generates subject with tool name and balance', () => {
    const result = lowBalanceAlertEmail('user@test.com', 'MyTool', 300)
    expect(result.subject).toContain('MyTool')
    expect(result.subject).toContain('$3.00')
  })

  it('includes consumer link', () => {
    const result = lowBalanceAlertEmail('user@test.com', 'MyTool', 300)
    expect(result.html).toContain('https://settlegrid.ai/consumer')
  })

  it('escapes tool name in body', () => {
    const result = lowBalanceAlertEmail('user@test.com', '<b>Bad</b>', 100)
    expect(result.html).not.toContain('<b>Bad</b>')
    expect(result.html).toContain('&lt;b&gt;Bad&lt;/b&gt;')
  })

  it('includes auto-refill tip', () => {
    const result = lowBalanceAlertEmail('user@test.com', 'MyTool', 100)
    expect(result.html).toContain('auto-refill')
  })
})

describe('creditPurchaseConfirmationEmail', () => {
  it('generates subject with amount and tool name', () => {
    const result = creditPurchaseConfirmationEmail('user@test.com', 2000, 'AnalyzeTool')
    expect(result.subject).toContain('$20.00')
    expect(result.subject).toContain('AnalyzeTool')
  })

  it('includes base template in HTML', () => {
    const result = creditPurchaseConfirmationEmail('user@test.com', 1000, 'Tool')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('includes consumer link', () => {
    const result = creditPurchaseConfirmationEmail('user@test.com', 500, 'Tool')
    expect(result.html).toContain('https://settlegrid.ai/consumer')
  })
})

describe('paymentFailedEmail', () => {
  it('generates subject with amount and tool name', () => {
    const result = paymentFailedEmail('user@test.com', 1500, 'Card declined', 'MyTool')
    expect(result.subject).toContain('$15.00')
    expect(result.subject).toContain('MyTool')
    expect(result.subject).toContain('failed')
  })

  it('includes failure reason', () => {
    const result = paymentFailedEmail('user@test.com', 1000, 'Insufficient funds', 'Tool')
    expect(result.html).toContain('Insufficient funds')
  })

  it('includes red error styling', () => {
    const result = paymentFailedEmail('user@test.com', 1000, 'Error', 'Tool')
    expect(result.html).toContain('#ef4444')
    expect(result.html).toContain('#fef2f2')
  })

  it('includes retry CTA', () => {
    const result = paymentFailedEmail('user@test.com', 1000, 'Error', 'Tool')
    expect(result.html).toContain('Retry Payment')
    expect(result.html).toContain('https://settlegrid.ai/consumer')
  })

  it('escapes HTML in reason', () => {
    const result = paymentFailedEmail('user@test.com', 1000, '<b>Error</b>', 'Tool')
    expect(result.html).toContain('&lt;b&gt;Error&lt;/b&gt;')
  })

  it('escapes HTML in tool name', () => {
    const result = paymentFailedEmail('user@test.com', 1000, 'Error', '<script>x</script>')
    expect(result.html).not.toContain('<script>x</script>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('includes preheader text', () => {
    const result = paymentFailedEmail('user@test.com', 1000, 'Error', 'Tool')
    expect(result.html).toContain('failed')
  })
})

describe('autoRefillConfirmationEmail', () => {
  it('generates subject with amount and tool name', () => {
    const result = autoRefillConfirmationEmail('user@test.com', 2000, 'MyTool', 5000)
    expect(result.subject).toContain('$20.00')
    expect(result.subject).toContain('MyTool')
    expect(result.subject).toContain('Auto-refill')
  })

  it('includes new balance', () => {
    const result = autoRefillConfirmationEmail('user@test.com', 1000, 'Tool', 3000)
    expect(result.html).toContain('$30.00')
    expect(result.html).toContain('New balance')
  })

  it('includes amount charged', () => {
    const result = autoRefillConfirmationEmail('user@test.com', 1000, 'Tool', 3000)
    expect(result.html).toContain('$10.00')
    expect(result.html).toContain('Amount charged')
  })

  it('includes green success styling', () => {
    const result = autoRefillConfirmationEmail('user@test.com', 1000, 'Tool', 3000)
    expect(result.html).toContain('#f0fdf4')
    expect(result.html).toContain('#166534')
  })

  it('escapes tool name', () => {
    const result = autoRefillConfirmationEmail('user@test.com', 1000, '<b>Tool</b>', 3000)
    expect(result.html).toContain('&lt;b&gt;Tool&lt;/b&gt;')
  })
})

describe('apiKeyCreatedEmail', () => {
  it('generates subject with tool name', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_live_abc', 'MyTool')
    expect(result.subject).toContain('MyTool')
    expect(result.subject).toContain('API key created')
  })

  it('includes masked key prefix', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_live_abc', 'Tool')
    expect(result.html).toContain('sk_live_abc...')
  })

  it('includes security warning', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_test', 'Tool')
    expect(result.html).toContain('didn\'t create this key')
    expect(result.html).toContain('revoke it immediately')
  })

  it('uses code font for key prefix', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_test', 'Tool')
    expect(result.html).toContain('SFMono-Regular')
  })

  it('escapes HTML in key prefix', () => {
    const result = apiKeyCreatedEmail('user@test.com', '<img src=x>', 'Tool')
    expect(result.html).toContain('&lt;img src=x&gt;')
  })
})

describe('apiKeyRevokedEmail', () => {
  it('generates subject with tool name', () => {
    const result = apiKeyRevokedEmail('user@test.com', 'sk_live_abc', 'MyTool')
    expect(result.subject).toContain('MyTool')
    expect(result.subject).toContain('revoked')
  })

  it('includes key prefix', () => {
    const result = apiKeyRevokedEmail('user@test.com', 'sk_live_abc', 'Tool')
    expect(result.html).toContain('sk_live_abc...')
  })

  it('includes update warning', () => {
    const result = apiKeyRevokedEmail('user@test.com', 'sk_test', 'Tool')
    expect(result.html).toContain('applications using this key')
  })

  it('uses warning colors', () => {
    const result = apiKeyRevokedEmail('user@test.com', 'sk_test', 'Tool')
    expect(result.html).toContain('#fef3c7')
    expect(result.html).toContain('#92400e')
  })
})

describe('webhookFailureEmail', () => {
  it('generates subject with masked URL', () => {
    const result = webhookFailureEmail('user@test.com', 'https://api.example.com/webhook/123', 5, 500)
    expect(result.subject).toContain('https://api.example.com/***')
  })

  it('includes failure count', () => {
    const result = webhookFailureEmail('user@test.com', 'https://api.example.com/hook', 3, 502)
    expect(result.html).toContain('3 consecutive')
  })

  it('includes last status code', () => {
    const result = webhookFailureEmail('user@test.com', 'https://api.example.com/hook', 5, 504)
    expect(result.html).toContain('504')
  })

  it('handles invalid URLs gracefully', () => {
    const result = webhookFailureEmail('user@test.com', 'not-a-url', 2, 0)
    expect(result.html).toContain('(invalid URL)')
  })

  it('includes webhooks dashboard link', () => {
    const result = webhookFailureEmail('user@test.com', 'https://example.com/hook', 1, 500)
    expect(result.html).toContain('https://settlegrid.ai/dashboard/developer/webhooks')
  })

  it('uses warning color for CTA', () => {
    const result = webhookFailureEmail('user@test.com', 'https://example.com/hook', 1, 500)
    expect(result.html).toContain('#d97706')
  })

  it('escapes masked URL in HTML', () => {
    const result = webhookFailureEmail('user@test.com', 'https://example.com/hook?a=1&b=2', 1, 500)
    // URL in code tag should be escaped
    expect(result.html).toContain('https://example.com/***')
  })
})

// ── Utility tests ────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;')
  })

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('handles empty strings', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('sanitizeSubject', () => {
  it('strips CR characters to prevent header injection', () => {
    const result = sanitizeSubject('Hello\rBcc: attacker@evil.com')
    expect(result).not.toContain('\r')
    expect(result).toBe('Hello Bcc: attacker@evil.com')
  })

  it('strips LF characters to prevent header injection', () => {
    const result = sanitizeSubject('Hello\nBcc: attacker@evil.com')
    expect(result).not.toContain('\n')
    expect(result).toBe('Hello Bcc: attacker@evil.com')
  })

  it('strips CRLF characters', () => {
    const result = sanitizeSubject('Hello\r\nBcc: attacker@evil.com')
    expect(result).not.toContain('\r')
    expect(result).not.toContain('\n')
  })

  it('strips tab characters', () => {
    const result = sanitizeSubject('Hello\tWorld')
    expect(result).not.toContain('\t')
    expect(result).toBe('Hello World')
  })

  it('truncates to 200 characters', () => {
    const long = 'A'.repeat(300)
    const result = sanitizeSubject(long)
    expect(result.length).toBe(200)
  })

  it('trims whitespace', () => {
    const result = sanitizeSubject('  Hello World  ')
    expect(result).toBe('Hello World')
  })

  it('passes through clean strings unchanged', () => {
    const result = sanitizeSubject('SettleGrid Alert: Low Balance')
    expect(result).toBe('SettleGrid Alert: Low Balance')
  })
})

describe('email subject sanitization in templates', () => {
  it('lowBalanceAlertEmail strips CRLF from toolName in subject', () => {
    const result = lowBalanceAlertEmail('user@test.com', 'Tool\r\nBcc: evil@hack.com', 500)
    expect(result.subject).not.toContain('\r')
    expect(result.subject).not.toContain('\n')
    expect(result.subject).toContain('Tool')
  })

  it('creditPurchaseConfirmationEmail strips CRLF from toolName in subject', () => {
    const result = creditPurchaseConfirmationEmail('user@test.com', 1000, 'Tool\r\nBcc: evil@hack.com')
    expect(result.subject).not.toContain('\r')
    expect(result.subject).not.toContain('\n')
    expect(result.subject).toContain('Tool')
  })

  it('paymentFailedEmail strips CRLF from toolName in subject', () => {
    const result = paymentFailedEmail('user@test.com', 1000, 'Error', 'Tool\r\nBcc: evil@hack.com')
    expect(result.subject).not.toContain('\r')
    expect(result.subject).not.toContain('\n')
    expect(result.subject).toContain('Tool')
  })

  it('autoRefillConfirmationEmail strips CRLF from toolName in subject', () => {
    const result = autoRefillConfirmationEmail('user@test.com', 1000, 'Tool\r\nBcc: evil@hack.com', 3000)
    expect(result.subject).not.toContain('\r')
    expect(result.subject).not.toContain('\n')
    expect(result.subject).toContain('Tool')
  })

  it('apiKeyCreatedEmail strips CRLF from toolName in subject', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_test', 'Tool\r\nBcc: evil@hack.com')
    expect(result.subject).not.toContain('\r')
    expect(result.subject).not.toContain('\n')
    expect(result.subject).toContain('Tool')
  })

  it('apiKeyRevokedEmail strips CRLF from toolName in subject', () => {
    const result = apiKeyRevokedEmail('user@test.com', 'sk_test', 'Tool\r\nBcc: evil@hack.com')
    expect(result.subject).not.toContain('\r')
    expect(result.subject).not.toContain('\n')
    expect(result.subject).toContain('Tool')
  })
})
