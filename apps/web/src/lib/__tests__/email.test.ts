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
  abandonedCheckoutEmail,
  accountEmailChangedEmail,
  accountDeletedEmail,
  dataExportReadyEmail,
  invoiceReceiptEmail,
  payoutCompletedEmail,
  payoutFailedEmail,
  suspiciousActivityEmail,
  orgMemberInvitedEmail,
  orgMemberRemovedEmail,
  waitlistConfirmationEmail,
  baseEmailTemplate,
  ctaButton,
  statusBadge,
  dataRow,
  alertBanner,
  dividerLine,
  codeBlock,
  sanitizeSubject,
  escapeHtml,
  formatCurrency,
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

  it('uses WCAG AA compliant color #059669 for footer links', () => {
    const html = baseEmailTemplate('<p>test</p>')
    expect(html).toContain('color:#059669')
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

  it('uses #9ca3af only for non-essential footer text', () => {
    const html = baseEmailTemplate('<p>test</p>')
    // #9ca3af should appear in copyright and address lines only
    const matches = html.match(/#9ca3af/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })
})

// ── Design system components ─────────────────────────────────────────────────

describe('statusBadge', () => {
  it('renders settled badge with green colors', () => {
    const html = statusBadge('settled')
    expect(html).toContain('#f0fdf4')
    expect(html).toContain('#166534')
    expect(html).toContain('Settled')
  })

  it('renders active badge with blue colors', () => {
    const html = statusBadge('active')
    expect(html).toContain('#eff6ff')
    expect(html).toContain('#1e40af')
    expect(html).toContain('Active')
  })

  it('renders pending badge with amber colors', () => {
    const html = statusBadge('pending')
    expect(html).toContain('#fffbeb')
    expect(html).toContain('#92400e')
    expect(html).toContain('Pending')
  })

  it('renders failed badge with red colors', () => {
    const html = statusBadge('failed')
    expect(html).toContain('#fef2f2')
    expect(html).toContain('#991b1b')
    expect(html).toContain('Failed')
  })

  it('supports custom label', () => {
    const html = statusBadge('active', 'Admin')
    expect(html).toContain('Admin')
  })

  it('escapes HTML in label', () => {
    const html = statusBadge('active', '<b>Test</b>')
    expect(html).toContain('&lt;b&gt;Test&lt;/b&gt;')
  })

  it('renders as inline pill with border-radius', () => {
    const html = statusBadge('settled')
    expect(html).toContain('border-radius:9999px')
    expect(html).toContain('display:inline-block')
  })
})

describe('dataRow', () => {
  it('renders label and value in a table row', () => {
    const html = dataRow('Item', '$10.00')
    expect(html).toContain('Item')
    expect(html).toContain('$10.00')
    expect(html).toContain('<tr>')
  })

  it('has bottom border for normal rows', () => {
    const html = dataRow('Item', '$5.00')
    expect(html).toContain('border-bottom:1px solid #e5e7eb')
  })

  it('has top border and bold for total rows', () => {
    const html = dataRow('Total', '$50.00', true)
    expect(html).toContain('font-weight:700')
    expect(html).toContain('border-top:2px solid #1A1F3A')
  })

  it('escapes HTML in label and value', () => {
    const html = dataRow('<b>Label</b>', '<i>Value</i>')
    expect(html).toContain('&lt;b&gt;Label&lt;/b&gt;')
    expect(html).toContain('&lt;i&gt;Value&lt;/i&gt;')
  })

  it('right-aligns the value column', () => {
    const html = dataRow('Item', '$10.00')
    expect(html).toContain('align="right"')
  })
})

describe('alertBanner', () => {
  it('renders info banner with blue accent', () => {
    const html = alertBanner('info', 'Notice', 'Something happened')
    expect(html).toContain('#3b82f6')
    expect(html).toContain('#eff6ff')
    expect(html).toContain('Notice')
    expect(html).toContain('Something happened')
  })

  it('renders success banner with green accent', () => {
    const html = alertBanner('success', 'Done', 'It worked')
    expect(html).toContain('#22c55e')
    expect(html).toContain('#f0fdf4')
  })

  it('renders warning banner with amber accent', () => {
    const html = alertBanner('warning', 'Caution', 'Be careful')
    expect(html).toContain('#f59e0b')
    expect(html).toContain('#fffbeb')
  })

  it('renders error banner with red accent', () => {
    const html = alertBanner('error', 'Error', 'Something failed')
    expect(html).toContain('#ef4444')
    expect(html).toContain('#fef2f2')
  })

  it('has left border accent', () => {
    const html = alertBanner('info', 'Test', 'Body')
    expect(html).toContain('border-left:4px solid')
  })

  it('escapes HTML in title and body', () => {
    const html = alertBanner('info', '<script>x</script>', '<img src=x>')
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x&gt;')
  })
})

describe('dividerLine', () => {
  it('renders a horizontal rule table', () => {
    const html = dividerLine()
    expect(html).toContain('border-top:1px solid #e5e7eb')
    expect(html).toContain('sg-divider')
  })

  it('has vertical margin', () => {
    const html = dividerLine()
    expect(html).toContain('margin:24px 0')
  })
})

describe('codeBlock', () => {
  it('renders code in a dark background block', () => {
    const html = codeBlock('const x = 1')
    expect(html).toContain('#1A1F3A')
    expect(html).toContain('const x = 1')
    expect(html).toContain('<pre')
  })

  it('uses monospace font', () => {
    const html = codeBlock('test')
    expect(html).toContain('SFMono-Regular')
  })

  it('escapes HTML in code content', () => {
    const html = codeBlock('<div>hello</div>')
    expect(html).toContain('&lt;div&gt;hello&lt;/div&gt;')
  })

  it('has rounded corners', () => {
    const html = codeBlock('test')
    expect(html).toContain('border-radius:8px')
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

  it('includes custom headers when provided', async () => {
    await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      headers: {
        'List-Unsubscribe': '<mailto:unsubscribe@settlegrid.ai>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.headers).toEqual({
      'List-Unsubscribe': '<mailto:unsubscribe@settlegrid.ai>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })

  it('omits headers when not provided', async () => {
    await sendEmail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.headers).toBeUndefined()
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

  it('defaults to 80% revenue share', () => {
    const result = stripeConnectCompleteEmail('Dev')
    expect(result.html).toContain('You keep 80%')
  })

  it('accepts custom revenueSharePct', () => {
    const result = stripeConnectCompleteEmail('Dev', { revenueSharePct: 85 })
    expect(result.html).toContain('You keep 85%')
    expect(result.html).not.toContain('You keep 80%')
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

  it('includes IP address when provided', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_test', 'Tool', {
      ip: '192.168.1.1',
    })
    expect(result.html).toContain('192.168.1.1')
    expect(result.html).toContain('Security context')
  })

  it('includes user agent when provided', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_test', 'Tool', {
      userAgent: 'Mozilla/5.0 Chrome',
    })
    expect(result.html).toContain('Mozilla/5.0 Chrome')
    expect(result.html).toContain('User agent')
  })

  it('includes both IP and user agent when both provided', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_test', 'Tool', {
      ip: '10.0.0.1',
      userAgent: 'curl/7.81',
    })
    expect(result.html).toContain('10.0.0.1')
    expect(result.html).toContain('curl/7.81')
  })

  it('omits security context when neither ip nor userAgent provided', () => {
    const result = apiKeyCreatedEmail('user@test.com', 'sk_test', 'Tool')
    expect(result.html).not.toContain('Security context')
  })

  it('truncates very long user agents', () => {
    const longUA = 'A'.repeat(200)
    const result = apiKeyCreatedEmail('user@test.com', 'sk_test', 'Tool', { userAgent: longUA })
    // Should truncate to 120 chars before escaping
    expect(result.html).toContain('A'.repeat(120))
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

describe('formatCurrency', () => {
  it('formats cents to dollar string', () => {
    expect(formatCurrency(1000)).toBe('$10.00')
    expect(formatCurrency(2550)).toBe('$25.50')
    expect(formatCurrency(0)).toBe('$0.00')
    expect(formatCurrency(99)).toBe('$0.99')
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

// ── Abandoned Checkout Email ──────────────────────────────────────────────

describe('abandonedCheckoutEmail', () => {
  it('generates correct subject line', () => {
    const result = abandonedCheckoutEmail('user@test.com', 2000, 'AnalyzeTool', 'https://checkout.stripe.com/test')
    expect(result.subject).toBe('You left credits in your cart \u2014 complete your purchase')
  })

  it('includes preheader with amount and tool name', () => {
    const result = abandonedCheckoutEmail('user@test.com', 2000, 'AnalyzeTool', 'https://checkout.stripe.com/test')
    expect(result.html).toContain('$20.00')
    expect(result.html).toContain('AnalyzeTool')
    expect(result.html).toContain('is waiting')
  })

  it('includes formatted amount in body', () => {
    const result = abandonedCheckoutEmail('user@test.com', 5000, 'MyTool', 'https://checkout.stripe.com/test')
    expect(result.html).toContain('$50.00')
  })

  it('includes tool name in info box', () => {
    const result = abandonedCheckoutEmail('user@test.com', 1000, 'SearchAPI', 'https://checkout.stripe.com/test')
    expect(result.html).toContain('SearchAPI')
  })

  it('includes Complete Purchase CTA button', () => {
    const result = abandonedCheckoutEmail('user@test.com', 1000, 'Tool', 'https://checkout.stripe.com/session_123')
    expect(result.html).toContain('Complete Purchase')
    expect(result.html).toContain('https://checkout.stripe.com/session_123')
  })

  it('includes safe-to-ignore fine print', () => {
    const result = abandonedCheckoutEmail('user@test.com', 1000, 'Tool', 'https://checkout.stripe.com/test')
    expect(result.html).toContain('safely ignore this email')
  })

  it('includes friendly non-pushy tone', () => {
    const result = abandonedCheckoutEmail('user@test.com', 1000, 'Tool', 'https://checkout.stripe.com/test')
    expect(result.html).toContain("didn't finish adding credits")
  })

  it('includes base template wrapper', () => {
    const result = abandonedCheckoutEmail('user@test.com', 1000, 'Tool', 'https://checkout.stripe.com/test')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('escapes HTML in tool name', () => {
    const result = abandonedCheckoutEmail('user@test.com', 1000, '<script>x</script>', 'https://checkout.stripe.com/test')
    expect(result.html).not.toContain('<script>x</script>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in checkout URL', () => {
    const result = abandonedCheckoutEmail('user@test.com', 1000, 'Tool', 'https://evil.com?a=1&b=2')
    expect(result.html).toContain('https://evil.com?a=1&amp;b=2')
  })

  it('includes green info box styling', () => {
    const result = abandonedCheckoutEmail('user@test.com', 1000, 'Tool', 'https://checkout.stripe.com/test')
    expect(result.html).toContain('#f0fdf4')
    expect(result.html).toContain('#166534')
  })
})

// ── New templates ────────────────────────────────────────────────────────────

describe('accountEmailChangedEmail', () => {
  it('generates correct subject line', () => {
    const result = accountEmailChangedEmail('old@test.com', 'new@test.com')
    expect(result.subject).toContain('email address was changed')
  })

  it('includes old and new email addresses', () => {
    const result = accountEmailChangedEmail('old@test.com', 'new@test.com')
    expect(result.html).toContain('old@test.com')
    expect(result.html).toContain('new@test.com')
  })

  it('includes security warning about unauthorized changes', () => {
    const result = accountEmailChangedEmail('old@test.com', 'new@test.com')
    expect(result.html).toContain('Not you?')
    expect(result.html).toContain('compromised')
  })

  it('has Contact Support CTA', () => {
    const result = accountEmailChangedEmail('old@test.com', 'new@test.com')
    expect(result.html).toContain('Contact Support')
    expect(result.html).toContain('support@settlegrid.ai')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = accountEmailChangedEmail('old@test.com', 'new@test.com')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = accountEmailChangedEmail('old@test.com', 'new@test.com')
    expect(result.html).toContain('email address was recently changed')
  })

  it('escapes user-provided email addresses', () => {
    const result = accountEmailChangedEmail('<script>xss</script>@evil.com', 'new@test.com')
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
  })
})

describe('accountDeletedEmail', () => {
  it('generates correct subject line', () => {
    const result = accountDeletedEmail('user@test.com')
    expect(result.subject).toContain('account has been deleted')
  })

  it('includes email address in body', () => {
    const result = accountDeletedEmail('user@test.com')
    expect(result.html).toContain('user@test.com')
  })

  it('includes 30-day retention notice', () => {
    const result = accountDeletedEmail('user@test.com')
    expect(result.html).toContain('30 days')
  })

  it('includes data export link when provided', () => {
    const result = accountDeletedEmail('user@test.com', 'https://settlegrid.ai/export/abc')
    expect(result.html).toContain('https://settlegrid.ai/export/abc')
    expect(result.html).toContain('Download Data Export')
  })

  it('omits data export section when not provided', () => {
    const result = accountDeletedEmail('user@test.com')
    expect(result.html).not.toContain('Download Data Export')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = accountDeletedEmail('user@test.com')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = accountDeletedEmail('user@test.com')
    expect(result.html).toContain('permanently deleted')
  })

  it('escapes email address', () => {
    const result = accountDeletedEmail('<b>xss</b>@test.com')
    expect(result.html).toContain('&lt;b&gt;xss&lt;/b&gt;')
  })
})

describe('dataExportReadyEmail', () => {
  it('generates correct subject line', () => {
    const result = dataExportReadyEmail('user@test.com', 'https://settlegrid.ai/export/abc')
    expect(result.subject).toContain('data export is ready')
  })

  it('includes download link', () => {
    const result = dataExportReadyEmail('user@test.com', 'https://settlegrid.ai/export/abc')
    expect(result.html).toContain('Download Data')
    expect(result.html).toContain('https://settlegrid.ai/export/abc')
  })

  it('includes 7-day expiration notice', () => {
    const result = dataExportReadyEmail('user@test.com', 'https://settlegrid.ai/export/abc')
    expect(result.html).toContain('7 days')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = dataExportReadyEmail('user@test.com', 'https://settlegrid.ai/export/abc')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = dataExportReadyEmail('user@test.com', 'https://settlegrid.ai/export/abc')
    expect(result.html).toContain('data export is ready to download')
  })

  it('escapes export URL', () => {
    const result = dataExportReadyEmail('user@test.com', 'https://settlegrid.ai/export?a=1&b=2')
    expect(result.html).toContain('https://settlegrid.ai/export?a=1&amp;b=2')
  })
})

describe('invoiceReceiptEmail', () => {
  const items = [
    { description: 'Credits for AnalyzeTool', amountCents: 2000 },
    { description: 'Credits for SearchAPI', amountCents: 1000 },
  ]

  it('generates correct subject line with invoice number', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '0042', '4242', '2026-03-20')
    expect(result.subject).toContain('Invoice #INV-0042')
    expect(result.subject).toContain('SettleGrid')
  })

  it('includes itemized rows using dataRow', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '0042', '4242', '2026-03-20')
    expect(result.html).toContain('Credits for AnalyzeTool')
    expect(result.html).toContain('$20.00')
    expect(result.html).toContain('Credits for SearchAPI')
    expect(result.html).toContain('$10.00')
  })

  it('includes total row', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '0042', '4242', '2026-03-20')
    expect(result.html).toContain('Total')
    expect(result.html).toContain('$30.00')
  })

  it('includes payment method last 4 digits', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '0042', '4242', '2026-03-20')
    expect(result.html).toContain('**** 4242')
  })

  it('includes date', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '0042', '4242', '2026-03-20')
    expect(result.html).toContain('2026-03-20')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '0042', '4242', '2026-03-20')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '0042', '4242', '2026-03-20')
    expect(result.html).toContain('Receipt for Invoice')
  })

  it('escapes invoice number', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '<script>x</script>', '4242', '2026-03-20')
    expect(result.html).not.toContain('<script>x</script>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('has View in Dashboard CTA', () => {
    const result = invoiceReceiptEmail('user@test.com', items, 3000, '0042', '4242', '2026-03-20')
    expect(result.html).toContain('View in Dashboard')
  })
})

describe('payoutCompletedEmail', () => {
  it('generates correct subject line with amount', () => {
    const result = payoutCompletedEmail('Dev', 5000, 'tr_abc123')
    expect(result.subject).toContain('$50.00')
    expect(result.subject).toContain('arrived')
  })

  it('includes developer name', () => {
    const result = payoutCompletedEmail('Alice', 5000, 'tr_abc123')
    expect(result.html).toContain('Alice')
  })

  it('includes transfer reference', () => {
    const result = payoutCompletedEmail('Dev', 5000, 'tr_abc123')
    expect(result.html).toContain('tr_abc123')
  })

  it('includes success banner', () => {
    const result = payoutCompletedEmail('Dev', 5000, 'tr_abc123')
    expect(result.html).toContain('Deposit confirmed')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = payoutCompletedEmail('Dev', 5000, 'tr_abc123')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = payoutCompletedEmail('Dev', 5000, 'tr_abc123')
    expect(result.html).toContain('payout of $50.00 has been deposited')
  })

  it('escapes developer name', () => {
    const result = payoutCompletedEmail('<b>xss</b>', 5000, 'tr_abc123')
    expect(result.html).toContain('&lt;b&gt;xss&lt;/b&gt;')
  })

  it('has View Payouts CTA', () => {
    const result = payoutCompletedEmail('Dev', 5000, 'tr_abc123')
    expect(result.html).toContain('View Payouts')
    expect(result.html).toContain('https://settlegrid.ai/dashboard/payouts')
  })
})

describe('payoutFailedEmail', () => {
  it('generates correct subject line with amount', () => {
    const result = payoutFailedEmail('Dev', 5000, 'Bank account closed')
    expect(result.subject).toContain('$50.00')
    expect(result.subject).toContain('failed')
  })

  it('includes developer name', () => {
    const result = payoutFailedEmail('Alice', 5000, 'Reason')
    expect(result.html).toContain('Alice')
  })

  it('includes failure reason in error banner', () => {
    const result = payoutFailedEmail('Dev', 5000, 'Bank account closed')
    expect(result.html).toContain('Bank account closed')
    expect(result.html).toContain('Failure reason')
  })

  it('includes resolution steps', () => {
    const result = payoutFailedEmail('Dev', 5000, 'Reason')
    expect(result.html).toContain('Resolution steps')
    expect(result.html).toContain('bank account details')
  })

  it('has red CTA button for View Payout Settings', () => {
    const result = payoutFailedEmail('Dev', 5000, 'Reason')
    expect(result.html).toContain('View Payout Settings')
    expect(result.html).toContain('#ef4444')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = payoutFailedEmail('Dev', 5000, 'Reason')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = payoutFailedEmail('Dev', 5000, 'Reason')
    expect(result.html).toContain('failed')
  })

  it('escapes reason text', () => {
    const result = payoutFailedEmail('Dev', 5000, '<script>x</script>')
    expect(result.html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})

describe('suspiciousActivityEmail', () => {
  const reasons = ['Rate spike: 60 invocations in 60s', 'Rapid duplicate detected']

  it('generates correct subject line', () => {
    const result = suspiciousActivityEmail('user@test.com', reasons, 85)
    expect(result.subject).toContain('Suspicious activity')
    expect(result.subject).toContain('SettleGrid')
  })

  it('includes email address', () => {
    const result = suspiciousActivityEmail('user@test.com', reasons, 85)
    expect(result.html).toContain('user@test.com')
  })

  it('includes risk score', () => {
    const result = suspiciousActivityEmail('user@test.com', reasons, 85)
    expect(result.html).toContain('85/100')
  })

  it('lists all fraud signals', () => {
    const result = suspiciousActivityEmail('user@test.com', reasons, 85)
    expect(result.html).toContain('Rate spike: 60 invocations in 60s')
    expect(result.html).toContain('Rapid duplicate detected')
  })

  it('has Review Account CTA', () => {
    const result = suspiciousActivityEmail('user@test.com', reasons, 85)
    expect(result.html).toContain('Review Account')
    expect(result.html).toContain('https://settlegrid.ai/dashboard')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = suspiciousActivityEmail('user@test.com', reasons, 85)
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text with risk score', () => {
    const result = suspiciousActivityEmail('user@test.com', reasons, 85)
    expect(result.html).toContain('risk score: 85')
  })

  it('escapes HTML in email and reasons', () => {
    const result = suspiciousActivityEmail(
      '<script>xss</script>@test.com',
      ['<img src=x onerror=alert(1)>'],
      90
    )
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})

describe('orgMemberInvitedEmail', () => {
  it('generates correct subject line with org name', () => {
    const result = orgMemberInvitedEmail('user@test.com', 'Acme Corp', 'admin', 'Alice')
    expect(result.subject).toContain('Acme Corp')
    expect(result.subject).toContain('added')
  })

  it('includes inviter name', () => {
    const result = orgMemberInvitedEmail('user@test.com', 'Acme Corp', 'admin', 'Alice')
    expect(result.html).toContain('Alice')
  })

  it('includes org name', () => {
    const result = orgMemberInvitedEmail('user@test.com', 'Acme Corp', 'admin', 'Alice')
    expect(result.html).toContain('Acme Corp')
  })

  it('includes role badge', () => {
    const result = orgMemberInvitedEmail('user@test.com', 'Acme Corp', 'admin', 'Alice')
    expect(result.html).toContain('admin')
  })

  it('includes next steps', () => {
    const result = orgMemberInvitedEmail('user@test.com', 'Acme Corp', 'admin', 'Alice')
    expect(result.html).toContain('Next steps')
  })

  it('has View Organization CTA', () => {
    const result = orgMemberInvitedEmail('user@test.com', 'Acme Corp', 'admin', 'Alice')
    expect(result.html).toContain('View Organization')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = orgMemberInvitedEmail('user@test.com', 'Acme Corp', 'admin', 'Alice')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = orgMemberInvitedEmail('user@test.com', 'Acme Corp', 'admin', 'Alice')
    expect(result.html).toContain('Alice')
    expect(result.html).toContain('Acme Corp')
  })

  it('escapes HTML in org name and inviter name', () => {
    const result = orgMemberInvitedEmail('user@test.com', '<b>Evil Corp</b>', 'admin', '<script>xss</script>')
    expect(result.html).toContain('&lt;b&gt;Evil Corp&lt;/b&gt;')
    expect(result.html).toContain('&lt;script&gt;xss&lt;/script&gt;')
  })
})

describe('orgMemberRemovedEmail', () => {
  it('generates correct subject line with org name', () => {
    const result = orgMemberRemovedEmail('user@test.com', 'Acme Corp')
    expect(result.subject).toContain('removed')
    expect(result.subject).toContain('Acme Corp')
  })

  it('includes org name in body', () => {
    const result = orgMemberRemovedEmail('user@test.com', 'Acme Corp')
    expect(result.html).toContain('Acme Corp')
  })

  it('includes access revoked notice', () => {
    const result = orgMemberRemovedEmail('user@test.com', 'Acme Corp')
    expect(result.html).toContain('Access revoked')
    expect(result.html).toContain('no longer have access')
  })

  it('includes contact admin guidance', () => {
    const result = orgMemberRemovedEmail('user@test.com', 'Acme Corp')
    expect(result.html).toContain('support@settlegrid.ai')
    expect(result.html).toContain('mistake')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = orgMemberRemovedEmail('user@test.com', 'Acme Corp')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = orgMemberRemovedEmail('user@test.com', 'Acme Corp')
    expect(result.html).toContain('revoked')
  })

  it('escapes HTML in org name', () => {
    const result = orgMemberRemovedEmail('user@test.com', '<script>x</script>')
    expect(result.html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})

describe('waitlistConfirmationEmail', () => {
  it('generates correct subject line', () => {
    const result = waitlistConfirmationEmail('user@test.com', 'marketplace')
    expect(result.subject).toContain('waitlist')
  })

  it('includes feature name', () => {
    const result = waitlistConfirmationEmail('user@test.com', 'marketplace')
    expect(result.html).toContain('marketplace')
  })

  it('includes what to expect info', () => {
    const result = waitlistConfirmationEmail('user@test.com', 'marketplace')
    expect(result.html).toContain('What to expect')
  })

  it('has Learn More CTA linking to docs', () => {
    const result = waitlistConfirmationEmail('user@test.com', 'marketplace')
    expect(result.html).toContain('Learn More')
    expect(result.html).toContain('https://settlegrid.ai/docs')
  })

  it('uses baseEmailTemplate wrapper', () => {
    const result = waitlistConfirmationEmail('user@test.com', 'marketplace')
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('SettleGrid')
  })

  it('has preheader text', () => {
    const result = waitlistConfirmationEmail('user@test.com', 'marketplace')
    expect(result.html).toContain('waitlist')
  })

  it('escapes HTML in feature name', () => {
    const result = waitlistConfirmationEmail('user@test.com', '<script>x</script>')
    expect(result.html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })
})
